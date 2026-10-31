#!/usr/bin/env python3
"""Official parliamentary report metadata export for GitHub Pages.

Adapted in approach (not copied implementation) from the MIT-licensed
ParliamentWatch project by Pranay Kotasthane. No AI interpretation.
"""
import argparse
import concurrent.futures
import json
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ENDPOINT = "https://sansad.in/api_ls/committee/lsRSAllReports"
BASE = Path(__file__).resolve().parents[1]
# Lok Sabha-chaired DRSCs + three financial committees. Rajya Sabha reports
# are not claimed to be fully covered by the LS endpoint.
COMMITTEES = {
    "agriculture": ("Agriculture, Animal Husbandry and Food Processing", 5),
    "chemicals": ("Chemicals & Fertilizers", 45),
    "coal": ("Coal, Mines and Steel", 46),
    "defence": ("Defence", 7),
    "energy": ("Energy", 9),
    "external_affairs": ("External Affairs", 11),
    "finance": ("Finance", 12),
    "consumer_affairs": ("Consumer Affairs, Food and Public Distribution", 13),
    "communications": ("Communications and Information Technology", 18),
    "labour": ("Labour, Textiles and Skill Development", 19),
    "petroleum": ("Petroleum and Natural Gas", 23),
    "railways": ("Railways", 28),
    "rural_development": ("Rural Development and Panchayati Raj", 32),
    "social_justice": ("Social Justice and Empowerment", 47),
    "housing": ("Housing and Urban Affairs", 41),
    "water_resources": ("Water Resources", 44),
    "public_accounts": ("Public Accounts", 26),
    "estimates": ("Estimates", 10),
    "public_undertakings": ("Public Undertakings", 27),
}

def official_link(raw):
    if not isinstance(raw, str):
        return ""
    raw = raw.strip().replace("\\", "/")
    try:
        url = urlsplit(raw)
        if (url.scheme == "https" and
            url.hostname in ("sansad.in", "www.sansad.in", "eparlib.sansad.in") and
            not url.username and not url.password and
            len(raw) <= 1600):
            return raw
    except ValueError:
        pass
    return ""

def parse_date(raw):
    if not isinstance(raw, str) or not raw.strip():
        return ""
    raw=raw.strip()
    try:
        # Most API values use ISO dates.
        return datetime.fromisoformat(raw.replace("Z","+00:00")).date().isoformat()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(raw).date().isoformat()
    except (TypeError,ValueError,IndexError):
        pass
    for fmt in ("%d-%b-%Y","%d/%m/%Y","%d-%m-%Y","%Y/%m/%d"):
        try:
            return datetime.strptime(raw,fmt).date().isoformat()
        except ValueError:
            continue
    return ""

def clean(value, limit=260):
    return re.sub(r"\s+"," ",str(value or "")).strip()[:limit]

def normalize_records(records, key, committee):
    if not isinstance(records,list):
        return []
    out=[]
    seen=set()
    for item in records:
        if not isinstance(item,dict):
            continue
        title=clean(item.get("SubjectOfTheReport") or item.get("subjectOfTheReport"))
        link=official_link(item.get("url") or item.get("pdf_url") or "")
        if not title or not link or link in seen:
            continue
        seen.add(link)
        number=clean(item.get("reportNo") or item.get("report_number"),15)
        date=parse_date(item.get("dateOfPresentation") or item.get("date_of_presentation") or item.get("PresentedInLS") or "")
        out.append({
            "committee":key,"committee_name":committee["name"],
            "report_number":number, "title":title,"date":date,
            "url":link,"house":"Lok Sabha","document_kind":"Committee report"
        })
    return out

def get_committee(key, item):
    name, api_code=item
    params=urlencode({"house":"L","committeeCode":api_code,"lsNo":18,
                      "page":1,"size":100,"sortOn":"reportNo","sortBy":"desc"})
    req=Request(ENDPOINT+"?"+params,headers={
        "User-Agent":"Mozilla/5.0 (compatible; RaisinaResearch/1.0; public document index)",
        "Accept":"application/json", "Referer":"https://sansad.in/"
    })
    with urlopen(req,timeout=20) as response:
        final=urlsplit(response.geturl())
        if final.scheme!="https" or final.hostname not in ("sansad.in","www.sansad.in"):
            raise ValueError("API unexpectedly redirected")
        data=response.read(3_000_001)
    if len(data)>3_000_000:
        raise ValueError("Response too large")
    payload=json.loads(data)
    records=payload.get("records")
    if not isinstance(records,list):
        raise ValueError("Unexpected official response schema")
    return normalize_records(records,key,{"name":name,"api_code":api_code})

def run(output):
    output=Path(output)
    old={}
    if output.exists():
        try:
            old=json.loads(output.read_text(encoding="utf-8"))
        except (ValueError,OSError):
            old={}
    previous=old.get("items") if isinstance(old.get("items"),list) else []
    fresh={}
    failed=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(get_committee,k,v):k for k,v in COMMITTEES.items()}
        for future in concurrent.futures.as_completed(jobs):
            key=jobs[future]
            try:
                fresh[key]=future.result()
            except (OSError,ValueError,KeyError,TypeError) as exc:
                print(f"Unavailable {key}: {type(exc).__name__}")
                failed.append(key)
    # Retain only previous official-domain metadata for committees that fail today.
    records=[]
    for key in COMMITTEES:
        if key in fresh:
            records.extend(fresh[key])
        else:
            records.extend(item for item in previous if
                isinstance(item,dict) and item.get("committee")==key and
                official_link(item.get("url")) and item.get("title"))
    dedup={}
    for item in records:
        if official_link(item.get("url")):
            dedup[item["url"]]=item
    items=sorted(dedup.values(),key=lambda x:(x.get("date") or "",x.get("report_number") or ""),reverse=True)[:700]
    success=len(fresh)
    if success==len(COMMITTEES):
        status="available"
    elif success:
        status="partial"
    elif items:
        status="stale"
    else:
        status="unavailable"
    previous_success=old.get("last_successful_at")
    now=datetime.now(timezone.utc).isoformat(timespec="seconds")
    result={
        "checked_at":now,"last_successful_at":now if success else previous_success,
        "status":status,"committees_checked":len(COMMITTEES),
        "committees_available":success,"failed_committees":sorted(failed),
        "items":items,
        "notice":"Official-source metadata only. A report is not law or verified implementation. Dates may be unavailable. Records of failed committees may be from a previous snapshot."
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Parliament index: {len(items)} links, {success}/{len(COMMITTEES)} sources available")
    return result

if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--output",type=Path,default=BASE/"site/data/parliament.json")
    args=cli.parse_args()
    run(args.output)
