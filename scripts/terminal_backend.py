"""Optional read-only OpenBB Workspace backend for Raisina's public snapshots.

Run locally: python scripts/terminal_backend.py --port 6900
No credentials, proprietary feeds, subscriptions or live quotes are provided.
"""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
ROOT=Path(__file__).resolve().parents[1]

def read(name,directory=None):
 base=directory or ROOT/'dist'/'data'
 return json.loads((base/(name+'.json')).read_text())

def widgets():
 def widget(name,endpoint,description,params):
  return dict(name=name,endpoint=endpoint,description=description,type='table',category='Raisina research',gridData={'w':12,'h':8},params=[dict(paramName=p,label=p.title(),type='text',value=v) for p,v in params])
 return {
  'raisina_ownership':widget('Raisina ownership','ownership','Dated disclosed holdings. Selected named holders or explicitly labelled aggregate categories; not ultimate control.',[('company','tcs')]),
  'raisina_economy':widget('Raisina economic history','economy','Annual World Bank observations with units, source URLs, retrieval dates and refresh status.',[('indicator','growth'),('country','IND')]),
  'raisina_documents':widget('Raisina original documents','documents','Search document titles and indexed metadata. PDF body text is not indexed.',[('q','')])}

def response(path,query,directory=None):
 if path=='/widgets.json':return widgets()
 if path=='/':return {'name':'Raisina public-source backend','coverage':'Dated local snapshots, not live market data','widgets':'/widgets.json'}
 if path=='/ownership':
  company=next((c for c in read('ownership-companies',directory)['companies'] if c['id']==query.get('company','tcs')),None)
  if not company:raise ValueError('Unknown company')
  return [dict(company=company['name'],holder=o['label'],percent=o['percent'],holding_date=o['asOf'],record_type=o['kind'],source=o['source'],coverage=company['scope']) for o in company['owners']]
 if path=='/economy':
  data=read('countries',directory);key=query.get('indicator','growth');country=query.get('country','IND')
  if key not in data['series'] or country not in data['countries']:raise ValueError('Unknown indicator or country')
  series=data['series'][key]
  return [dict(economy=data['countries'][country],year=r['period'],value=r['value'],unit=series['unit'],source=series['source'],retrieved_at=series.get('retrieved_at'),status=series['status']) for r in series['rows'] if r['country']==country]
 if path=='/documents':
  q=query.get('q','').casefold()
  if len(q)>300:raise ValueError('Query too long')
  return [r for r in read('document-library',directory)['records'] if q in (r['title']+' '+r['publisher']+' '+r['context']).casefold()][:100]
 raise LookupError('Unknown endpoint')

class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   u=urlsplit(self.path);query={k:v[0] for k,v in parse_qs(u.query).items()};payload=response(u.path,query);status=200
  except ValueError:payload={'error':'Invalid parameter'};status=400
  except LookupError:payload={'error':'Endpoint not found'};status=404
  except (OSError,KeyError,TypeError):payload={'error':'Snapshot unavailable. Build the site first.'};status=503
  body=json.dumps(payload,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store')
  if self.headers.get('Origin')=='https://pro.openbb.co':self.send_header('Access-Control-Allow-Origin','https://pro.openbb.co');self.send_header('Vary','Origin')
  self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=6900);args=parser.parse_args()
 with ThreadingHTTPServer(('127.0.0.1',args.port),Handler) as server:
  print('Raisina OpenBB-compatible backend at http://127.0.0.1:'+str(args.port),flush=True);server.serve_forever()
