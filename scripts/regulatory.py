#!/usr/bin/env python3
"""Fetch only named official RSS sources into a reviewable public metadata index."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from html.parser import HTMLParser

SOURCES = (
    ("SEBI", "https://www.sebi.gov.in/sebirss.xml", "www.sebi.gov.in"),
    ("PIB", "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", "pib.gov.in"),
)

class StripMarkup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)

def plain(value):
    try:
        parser = StripMarkup()
        parser.feed(value or "")
        return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()[:260]
    except (ValueError, TypeError):
        return ""

def canonical_link(raw, hostname):
    """Accept only the official host, upgrading old official HTTP feed links to HTTPS."""
    try:
        url = urlsplit((raw or "").strip())
        base = hostname.removeprefix("www.")
        allowed = url.hostname == base or bool(url.hostname and url.hostname.endswith("." + base))
        if (url.scheme not in ("http", "https") or not allowed
                or url.username or url.password or url.port not in (None, 80, 443)):
            return ""
        return urlunsplit(("https", url.hostname, url.path or "/", url.query, ""))
    except ValueError:
        return ""

def safe_link(raw, hostname):
    return bool(canonical_link(raw, hostname))

def local(tag):
    return tag.rsplit("}", 1)[-1].rsplit(":", 1)[-1].lower()

def field(entry, names):
    """Read RSS, Atom or DC namespaced text fields without depending on prefixes."""
    accepted = {x.lower() for x in names}
    for child in entry:
        if local(child.tag) in accepted:
            result = " ".join(child.itertext()).strip()
            if result:
                return result
    return ""

def item_link(entry):
    for child in entry:
        if local(child.tag) in ("link", "guid", "id"):
            link = (child.get("href") or child.text or "").strip()
            if link.startswith(("https://", "http://")):
                return link
    return ""

def parse_date(value):
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.upper().endswith(" IST"):
        cleaned = cleaned[:-4] + " +0530"
    dt = None
    try:
        dt = parsedate_to_datetime(cleaned)
    except (TypeError, ValueError, IndexError):
        pass
    if dt is None:
        try:
            dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        except ValueError:
            pass
    if dt is None:
        for pattern in ("%d %b, %Y %z", "%d %B, %Y %z", "%d %b, %Y",
                        "%d-%b-%Y %H:%M:%S %z", "%d %b %Y %H:%M:%S %z",
                        "%d-%b-%Y %H:%M:%S", "%d %b %Y", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(cleaned, pattern)
                break
            except ValueError:
                continue
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Official notices are dated in the publisher's local calendar, not UTC.
    return dt.date().isoformat()

def parse_source(xml, name, hostname):
    root = ET.fromstring(xml)
    results, seen = [], set()
    for item in root.iter():
        if local(item.tag) not in ("item", "entry"):
            continue
        title = re.sub(r"\s+", " ", field(item, ("title",)))[:260]
        link = canonical_link(item_link(item), hostname)
        date = parse_date(field(item, ("pubdate", "published", "updated", "date", "issued")))
        if not title or not link or (not date and name != "PIB") or link in seen:
            continue
        seen.add(link)
        results.append({
            "institution": name, "title": title,
            "url": link, "date": date,
            "summary": plain(field(item, ("description", "summary", "content"))),
        })
    return results

def describe_unmatched_source(xml):
    """Minimal diagnostics for official feed format changes, without printing raw XML."""
    root = ET.fromstring(xml)
    entries = [x for x in root.iter() if local(x.tag) in ("item", "entry")]
    if not entries:
        return "root=" + local(root.tag) + " entries=0"
    first = entries[0]
    return ("root=" + local(root.tag) +
            " entries=" + str(len(entries)) +
            " fields=" + ",".join(local(child.tag) for child in list(first)[:10]) +
            " first_link_scheme=" + (urlsplit(item_link(first)).scheme or "none") +
            " first_link_host=" + (urlsplit(item_link(first)).hostname or "none") +
            " first_date_sample=" + repr(field(first, ("pubdate", "published", "updated", "date", "issued"))[:55]) +
            " first_date_present=" + str(bool(field(first, ("pubdate", "published", "updated", "date", "issued")))))

def run(output):
    items = []
    source_status = {}
    for name, url, hostname in SOURCES:
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; RaisinaPostResearch/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            })
            with urlopen(req, timeout=16) as response:
                data = response.read(2_000_001)
            if len(data) > 2_000_000:
                raise ValueError("Feed exceeded size limit")
            decoded = data.decode("utf-8-sig")
            source_items = parse_source(decoded, name, hostname)
            if not source_items:
                print(f"Unmatched {name} format: {describe_unmatched_source(decoded)}")
                raise ValueError("No valid dated official entries")
            source_status[name] = "available"
            items.extend(source_items[:70])
        except (OSError, ValueError, ET.ParseError, UnicodeError) as error:
            print(f"Regulatory feed {name} unavailable: {type(error).__name__}")
            source_status[name] = "unavailable"
    items.sort(key=lambda item: item["date"], reverse=True)
    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "sources": source_status,
        "items": items[:100],
        "notice": "Unedited official-source metadata, not independent reporting or legal advice.",
    }
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = run(args.output)
    print(f"Regulatory index: {len(payload['items'])} verified-link entries; {payload['sources']}")

if __name__ == "__main__":
    main()
