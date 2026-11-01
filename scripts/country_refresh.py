"""Build a dated, validated WDI country panel; retain the last good series on failure."""
import argparse
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
COUNTRIES={'IND':'India','CHN':'China','IDN':'Indonesia','VNM':'Viet Nam','BGD':'Bangladesh','USA':'United States'}
INDICATORS={
 'growth':('NY.GDP.MKTP.KD.ZG','Real GDP growth','%','Annual real output growth; national accounting periods and revisions can differ.'),
 'income':('NY.GDP.PCAP.CD','GDP per person','US$','Current US dollars; exchange-rate changes affect comparisons. This is an average, not a salary.'),
 'inflation':('FP.CPI.TOTL.ZG','Consumer price inflation','%','Annual consumer-price inflation; national baskets and coverage differ.'),
 'manufacturing':('NV.IND.MANF.ZS','Manufacturing share','% of GDP','Manufacturing value added as a share of GDP, not manufacturing growth.'),
 'exports':('NE.EXP.GNFS.ZS','Exports','% of GDP','Includes goods and services; measures trade intensity, not absolute export size.')}
def parse(payload,code):
 if not isinstance(payload,list) or len(payload)<2 or not isinstance(payload[1],list):raise ValueError('Invalid WDI response')
 rows={}
 for r in payload[1]:
  c,y,v=r.get('countryiso3code'),r.get('date'),r.get('value')
  if c not in COUNTRIES or r.get('indicator',{}).get('id')!=code:continue
  if not isinstance(y,str) or not y.isdigit() or not 2000<=int(y)<=datetime.now().year:continue
  if not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v):continue
  key=(c,y)
  if key in rows and rows[key]!=v:raise ValueError('Conflicting observations')
  rows[key]=v
 if not rows:raise ValueError('No validated observations')
 return [dict(country=c,period=y,value=v) for (c,y),v in sorted(rows.items())]
def download(url):
 with urlopen(Request(url,headers={'User-Agent':'RaisinaPostResearch/1.0'}),timeout=25) as r:
  raw=r.read(2000001)
  if len(raw)>2000000:raise ValueError('Oversize response')
  return json.loads(raw)
def refresh(previous=None,fetch=download):
 previous=previous or {};now=datetime.now(timezone.utc).isoformat()
 def collect(item):
  key,(code,label,unit,note)=item
  url=f'https://api.worldbank.org/v2/country/{";".join(COUNTRIES)}/indicator/{code}?date=2000:{datetime.now().year-1}&format=json&per_page=2000'
  result=dict(code=code,label=label,unit=unit,note=note,url=url,source=f'https://data.worldbank.org/indicator/{code}',checked_at=now,status='unavailable',rows=[])
  try:result.update(rows=parse(fetch(url),code),retrieved_at=now,status='available')
  except Exception:
   old=previous.get('series',{}).get(key,{})
   try:rows=parse([{},[dict(countryiso3code=r['country'],date=r['period'],value=r['value'],indicator={'id':code}) for r in old.get('rows',[])]],code)
   except (ValueError,KeyError,TypeError):rows=[]
   if rows:result.update(rows=rows,retrieved_at=old.get('retrieved_at'),status='retained')
  return key,result
 with ThreadPoolExecutor(max_workers=4) as pool:series=dict(pool.map(collect,INDICATORS.items()))
 return dict(schema=1,countries=COUNTRIES,checked_at=now,series=series)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=Path('site/data/countries.json'));args=parser.parse_args()
 try:old=json.loads(args.output.read_text())
 except (OSError,ValueError):old={}
 data=refresh(old);args.output.write_text(json.dumps(data,separators=(',',':'))+'\n')
 print({k:(v['status'],len(v['rows'])) for k,v in data['series'].items()})
