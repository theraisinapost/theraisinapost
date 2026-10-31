#!/usr/bin/env python3
"""Conservative page-level checksum monitor for a fixed allowlist of official sources.

A changed checksum is a *review cue*, never a verified policy change. Initial
observations establish baselines only. No HTML is republished.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

BASE=Path(__file__).resolve().parents[1]
OFFICIAL_HOSTS={"www.sebi.gov.in","www.mospi.gov.in","www.pib.gov.in","pib.gov.in"}

def safe_target(raw):
    if not isinstance(raw,str) or len(raw)>600:
        return False
    try:
        parsed=urlsplit(raw)
        return (parsed.scheme=="https" and parsed.hostname in OFFICIAL_HOSTS and
                not parsed.username and not parsed.password and
                parsed.port in (None,443))
    except ValueError:
        return False

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts=[]
        self.suppressed=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","noscript","svg"):
            self.suppressed+=1
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript","svg") and self.suppressed:
            self.suppressed-=1
    def handle_data(self,data):
        if not self.suppressed and data.strip():
            self.parts.append(data)

def checksum(raw):
    if not isinstance(raw,bytes):
        raise TypeError("Expected public HTML bytes")
    if len(raw)>1_500_000:
        raise ValueError("HTML too large")
    parser=VisibleText()
    parser.feed(raw.decode("utf-8","replace"))
    body=re.sub(r"\s+"," "," ".join(parser.parts)).strip()
    if len(body)<150:
        raise ValueError("Response has too little visible text")
    return hashlib.sha256(body.encode("utf-8")).hexdigest()

def transition(previous, key, new_digest, checked_at):
    """A second distinct valid digest creates a review cue; the first never does."""
    previous=previous if isinstance(previous,dict) else {}
    old_digest=previous.get("hash","")
    changed=bool(old_digest and old_digest!=new_digest)
    result=dict(previous)
    result.update({
        "id":key,"hash":new_digest,"last_checked_at":checked_at,"status":"available",
        "change_unreviewed":bool(previous.get("change_unreviewed")) or changed
    })
    if changed:
        result["change_detected_at"]=checked_at
    return result

def fetch_digest(url):
    if not safe_target(url):
        raise ValueError("Unapproved source")
    req=Request(url,headers={
        "User-Agent":"Mozilla/5.0 (compatible; RaisinaSourceMonitor/1.0)",
        "Accept":"text/html,application/xhtml+xml",
    })
    with urlopen(req,timeout=13) as response:
        if not safe_target(response.geturl()):
            raise ValueError("Source redirects to unapproved host")
        raw=response.read(1_500_001)
    return checksum(raw)

def run(registry_path, output_path):
    registry=json.loads(Path(registry_path).read_text(encoding="utf-8"))
    output=Path(output_path)
    previous={}
    if output.exists():
        try:
            prior=json.loads(output.read_text(encoding="utf-8"))
            previous={item["id"]:item for item in prior.get("sources",[])
                      if isinstance(item,dict) and isinstance(item.get("id"),str)}
        except (ValueError,OSError,TypeError,KeyError):
            pass
    now=datetime.now(timezone.utc).isoformat(timespec="seconds")
    sources=[]
    for item in registry.get("sources",[])[:8]:
        if not isinstance(item,dict) or not re.fullmatch(r"[a-z0-9_-]{2,40}",str(item.get("id",""))):
            continue
        url=item.get("url")
        if not safe_target(url):
            continue
        key=item["id"]
        old=previous.get(key,{})
        record={"id":key,"name":str(item.get("name",""))[:80],
                "category":str(item.get("category",""))[:80],"url":url}
        try:
            record.update(transition(old,key,fetch_digest(url),now))
            # Keep display names, categories and public URLs from today's allowlist,
            # not from stale previous metadata.
            record.update({"name":str(item.get("name",""))[:80],
                           "category":str(item.get("category",""))[:80],"url":url})
        except (OSError,ValueError,TypeError) as exc:
            print(f"Source watch {key} unavailable: {type(exc).__name__}")
            record.update({
                "status":"unavailable","last_checked_at":now,
                "hash":old.get("hash",""),
                "change_unreviewed":bool(old.get("change_unreviewed",False)),
                "change_detected_at":old.get("change_detected_at","")
            })
        sources.append(record)
    result={
        "checked_at":now,
        "sources":sources,
        "notice":"Page-level changes, if detected, are UNREVIEWED. An HTML change does not establish a policy or legal change."
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Source watch: {len(sources)} sources, {sum(bool(s.get('change_unreviewed')) for s in sources)} review cues")
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--registry",type=Path,default=BASE/"site/data/monitor-sources.json")
    p.add_argument("--output",type=Path,default=BASE/"site/data/source-watch.json")
    args=p.parse_args()
    run(args.registry,args.output)
