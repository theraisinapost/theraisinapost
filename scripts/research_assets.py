"""Derive research indexes from the same public records used by the website."""
import hashlib
import json
from urllib.parse import urlsplit

def library(data):
 records={}
 def add(title,url,date,kind,publisher,context=''):
  u=urlsplit(url or '')
  if u.scheme!='https' or u.hostname not in {'www.tcs.com','www.hul.co.in','rilstaticasset.akamaized.net','nsearchives.nseindia.com','sansad.in','eparlib.sansad.in','www.meity.gov.in','www.mospi.gov.in'}:return
  if not title:return
  key=hashlib.sha256(url.encode()).hexdigest()[:16]
  if key in records:return
  records[key]=dict(id=key,title=title,url=url,date=date,kind=kind,publisher=publisher,context=context)
 for c in data['ownership-companies']['companies']:add(c['name']+' — '+c['source']['label'],c['source']['url'],c['asOf'],'Company filing',c['name'],c['scope'])
 for r in data['parliament'].get('items',[]):add(r['title'],r['url'],r.get('date',''),'Committee report',r.get('house','Parliament'),r.get('committee_name',''))
 for r in data['dpdp-timeline']['events']:add(r['title'],r['url'],r['date'],'Policy document','Ministry of Electronics and Information Technology',r.get('detail',''))
 r=data['release-calendar'];add(r['source_doc'],r['source_url'],'','Statistical calendar',r['publication'],r['editorial_note'])
 return sorted(records.values(),key=lambda r:(r['date'],r['title']),reverse=True)

def ownership_entities(companies):
 """FollowTheMoney entities for named direct holdings; aggregate categories excluded."""
 entities={};relations=[]
 for c in companies:
  target='company-'+c['id']
  entities[target]=dict(id=target,schema='Company',properties={'name':[c['name']]})
  for o in c['owners']:
   if o['kind']!='Named shareholder':continue
   # Exact disclosed labels only; no inferred entity matching or control chains.
   holder='holder-'+hashlib.sha256(o['label'].casefold().encode()).hexdigest()[:16]
   entities[holder]=dict(id=holder,schema='LegalEntity',properties={'name':[o['label']]})
   relations.append(dict(id='holding-'+c['id']+'-'+o['id'],schema='Ownership',properties={'owner':[holder],'asset':[target],'percentage':[str(o['percent'])],'summary':['Disclosed direct holding as of '+o['asOf']],'ownershipType':['direct'],'sourceUrl':[o['source']]}))
 return list(entities.values())+relations

def write_assets(source,destination):
 names=['ownership-companies','parliament','dpdp-timeline','release-calendar']
 data={n:json.loads((source/(n+'.json')).read_text()) for n in names}
 records=library(data)
 (destination/'document-library.json').write_text(json.dumps({'coverage':'Search covers titles and indexed metadata; PDF body text is not indexed.','records':records},ensure_ascii=False,separators=(',',':'))+'\n')
 (destination/'ownership-entities.ftm.json').write_text(json.dumps(ownership_entities(data['ownership-companies']['companies']),ensure_ascii=False,indent=2)+'\n')
