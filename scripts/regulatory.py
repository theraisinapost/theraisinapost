#!/usr/bin/env python3
"""Fetch only named official RSS sources into a reviewable public metadata index."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit
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

def safe_link(raw, hostname):
    try:
        url = urlsplit((raw or "").strip())
        allowed = {hostname, hostname.removeprefix("www."), "www." + hostname.removeprefix("www.")}
        return url.scheme == "https" and url.hostname in allowed and not url.username and not url.password
    except ValueError:
        return False

def parse_source(xml, name, hostname):
    root = ET.fromstring(xml)
    results = []
    seen = set()
    for item in root.findall(".//item"):
        title = re.sub(r"\s+", " ", (item.findtext("title") or "")).strip()[:260]
        link = (item.findtext("link") or "").strip()
        raw_date = (item.findtext("pubDate") or "").strip()
        if not title or not raw_date or not safe_link(link, hostname) or link in seen:
            continue
        try:
            dt = parsedate_to_datetime(raw_date)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            date = dt.astimezone(timezone.utc).date().isoformat()
        except (TypeError, ValueError, IndexError):
            continue
        seen.add(link)
        results.append({
            "institution": name, "title": title,
            "url": link, "date": date,
            "summary": plain(item.findtext("description", "")),
        })
    return results

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
            source_items = parse_source(data.decode("utf-8-sig"), name, hostname)
            if not source_items:
                raise ValueError("No valid dated official entries")
            source_status[name] = "available"
            items.extend(source_items[:70])
        except (OSError, ValueError, ET.ParseError, UnicodeError) as error:
            print(f"Regulatory feed {name} unavailable: {type(error).__name__}")
            source_status[name] = "unavailable"
    items.sort(key=lambda item: (item["date"], item["title"]), reverse=True)
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
