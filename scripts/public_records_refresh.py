#!/usr/bin/env python3
"""Source-validated metadata snapshots for Public Records (no paid APIs).
This never generates facts: an unavailable upstream source yields stale or
unavailable status. Source PDFs stay on Digital Sansad.
"""
import argparse
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

HF_SOURCE = 'https://huggingface.co/datasets/opensansad/lok-sabha-qa'
HF_API = 'https://datasets-server.huggingface.co/filter'
SANSAD_API = 'https://sansad.in/api_ls/question/qetFilteredQuestionsAns'
TRADE_API = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS'
PARTNERS = {'0':'World','156':'China','842':'United States','784':'United Arab Emirates','50':'Bangladesh'}


def fetch_json(url, timeout=15):
    request = Request(url, headers={'Accept':'application/json',
                'User-Agent':'RaisinaPostPublicResearch/1.0 (source-linked public index)'})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError('External service unavailable')
        raw = response.read(2_500_001)
    if len(raw) > 2_500_000:
        raise ValueError('API result exceeds maximum response size')
    return json.loads(raw.decode('utf-8'))


def valid_sansad(url):
    try:
        x = urlsplit(url)
        return x.scheme == 'https' and x.hostname in ('sansad.in','www.sansad.in') and not x.username and not x.password and bool(x.path)
    except (TypeError,ValueError):
        return False


def question_row(row):
    if not isinstance(row,dict):
        return None
    url = row.get('pdf_url')
    date = str(row.get('date') or '')
    house = row.get('lok_no')
    if not valid_sansad(url) or house not in (16,17,18) or len(date)!=10 or date[4]!='-' or date[7]!='-':
        return None
    subject = row.get('subject')
    ministry = row.get('ministry')
    if not isinstance(subject,str) or not subject.strip() or not isinstance(ministry,str):
        return None
    members = row.get('members')
    return {'subject':subject[:320], 'ministry':ministry[:160],
            'member':', '.join(str(x) for x in members[:8])[:240] if isinstance(members,list) else '',
            'date':date,'lok_no':house,'type':str(row.get('type') or '')[:20],
            'url':url,'id':str(row.get('id') or '')[:90]}


def sansad_list(payload):
    """Exact Digital Sansad API response: [{listOfQuestions:[...]}]."""
    if isinstance(payload,dict):
        rows=payload.get('listOfQuestions')
    elif isinstance(payload,list) and payload and isinstance(payload[0],dict):
        rows=payload[0].get('listOfQuestions')
    else:
        return []
    return [r for r in rows if isinstance(r,dict)] if isinstance(rows,list) else []


def sansad_question_row(row,lok,session):
    if not isinstance(row,dict):
        return None
    try:
        if row.get('lokNo') is not None and int(row['lokNo'])!=lok:
            return None
        if row.get('sessionNo') is not None and int(row['sessionNo'])!=session:
            return None
    except (ValueError,TypeError):
        return None
    raw=str(row.get('questionsFilePath') or '').strip()
    # Sansad publishes either a complete URL or a /getFile/... path.
    if raw.startswith('/getFile/'):
        url='https://sansad.in'+raw
    elif raw.startswith('getFile/'):
        url='https://sansad.in/'+raw
    elif raw.startswith('/loksabhaquestions/'):
        url='https://sansad.in/getFile'+raw
    else:
        url=raw
    if not valid_sansad(url) or not urlsplit(url).path.lower().endswith(('.pdf','.docx','.doc')):
        return None
    subject=row.get('subjects')
    ministry=row.get('ministry')
    if not isinstance(subject,str) or not subject.strip() or not isinstance(ministry,str):
        return None
    date=str(row.get('date') or '').strip()
    try:
        if len(date)==10 and date[4]=='-' and date[7]=='-':
            date=datetime.strptime(date,'%Y-%m-%d').date().isoformat()
        else:
            date=datetime.strptime(date,'%d-%m-%Y').date().isoformat()
    except ValueError:
        return None
    members=row.get('member')
    if not isinstance(members,list):
        members=[]
    qtype=str(row.get('type') or '').strip()
    if qtype not in ('STARRED','UNSTARRED'):
        return None
    try:
        qno=int(row.get('quesNo'))
    except (TypeError,ValueError):
        return None
    return {'subject':subject.strip()[:320],'ministry':ministry.strip()[:160],
            'member':', '.join(str(x) for x in members[:8])[:240],
            'date':date,'lok_no':lok,'type':qtype,
            'url':url,'id':f'LS{lok}-S{session}-{qtype}-{qno}'}


def trade_row(row,partner,flow,year):
    if not isinstance(row,dict): return None
    try:
        if (int(row.get('reporterCode'))!=699 or int(row.get('partnerCode'))!=int(partner) or
            int(row.get('refYear'))!=year or str(row.get('flowCode'))!=flow or
            str(row.get('cmdCode')).upper()!='TOTAL'):
            return None
        amount=float(row.get('primaryValue'))
        if not math.isfinite(amount) or amount<0: return None
    except (ValueError,TypeError): return None
    return {'year':year,'partner':partner,'partner_label':PARTNERS[partner],
            'flow':flow,'commodity':'TOTAL','commodity_label':'All merchandise',
            'value_usd':amount}


def refresh_questions(previous, now):
    """Try the dataset service then the original parliamentary API."""
    p={'dataset':'opensansad/lok-sabha-qa','config':'default','split':'train',
       'where':'"lok_no" = 18','orderby':'"date" DESC','offset':'0','length':'100'}
    try:
        payload=fetch_json(HF_API+'?'+urlencode(p),timeout=9)
        if not isinstance(payload.get('rows'),list):
            raise ValueError('Missing dataset rows')
        fresh=[question_row(x.get('row')) for x in payload['rows'] if isinstance(x,dict)]
        fresh=[x for x in fresh if x]
        if not fresh:
            raise ValueError('No validated dataset rows')
        unique={x['id'] or x['url']:x for x in fresh}
        return {'status':'available','checked_at':now,'dataset':HF_SOURCE,
                'notice':'At most 100 recent 18th Lok Sabha questions indexed from OpenSansad, not an exhaustive parliamentary index.',
                'items':list(unique.values())[:100]}
    except Exception as exc:
        print('Question dataset API unavailable:',type(exc).__name__)

    # Same primary source used by the OpenSansad curation pipeline.
    for session in (8,7):
        params={'loksabhaNo':18,'sessionNumber':session,'pageNo':1,
                'pageSize':100,'locale':'en'}
        try:
            response=fetch_json(SANSAD_API+'?'+urlencode(params),timeout=13)
            rows=sansad_list(response)
            selected=[sansad_question_row(row,18,session) for row in rows]
            selected=[x for x in selected if x]
            if not selected:
                raise ValueError('No validated questions or document URLs')
            unique={row['id']:row for row in selected}
            return {'status':'available','checked_at':now,'dataset':SANSAD_API,
                    'notice':f'Official Digital Sansad metadata: up to 100 records from session {session} of the 18th Lok Sabha. Not a complete corpus or an independent analysis.',
                    'items':list(unique.values())[:100]}
        except Exception as exc:
            print('Digital Sansad questions unavailable:',session,type(exc).__name__)

    old=previous.get('items',[])
    old=old if isinstance(old,list) else []
    return {'status':'stale' if old else 'unavailable','checked_at':now,
            'dataset':previous.get('dataset') or HF_SOURCE,
            'notice':'Both the public dataset service and Digital Sansad API were unavailable. Retained older source-verified metadata if present. No missing questions invented.',
            'items':old}


def refresh_trade(previous, now, delay=0.15):
    old=previous.get('items',[])
    found={}
    failures=0
    for year in (2024,2025):
        for partner in PARTNERS:
            for flow in ('M','X'):
                params={'reportercode':'699','period':str(year),'partnerCode':partner,
                        'cmdCode':'TOTAL','flowCode':flow,'maxRecords':'10'}
                url=TRADE_API+'?'+urlencode(params)
                try:
                    payload=fetch_json(url,timeout=12)
                    if not isinstance(payload.get('data'),list): raise ValueError('Invalid trade records')
                    rows=[trade_row(x,partner,flow,year) for x in payload['data']]
                    rows=[x for x in rows if x]
                    for x in rows:
                        found[(year,partner,flow)]=x
                except Exception as exc:
                    failures+=1
                    print('Trade preview unavailable:',year,partner,flow,type(exc).__name__)
                time.sleep(delay)
    for row in old if isinstance(old,list) else []:
        if isinstance(row,dict):
            key=(row.get('year'),row.get('partner'),row.get('flow'))
            if key not in found and key[1] in PARTNERS and key[2] in ('X','M') and key[0] in (2024,2025):
                if isinstance(row.get('value_usd'),(float,int)) and math.isfinite(row['value_usd']) and row['value_usd']>=0:
                    found[key]=row
    items=sorted(found.values(),key=lambda x:(-x['year'],x['partner'],x['flow']))
    if failures==0 and items: state='available'
    elif items and failures: state='partial'
    elif items: state='stale'
    else: state='unavailable'
    return {'status':state,'checked_at':now,'source':TRADE_API,
            'notice':'Validated India reporter, annual TOTAL merchandise preview data for 2024–2025, selected partners and imports/exports only. No inference from missing values. Partial snapshots may retain older observed records.',
            'items':items}


def read_previous(path):
    try:
        data=json.loads(Path(path).read_text(encoding='utf-8'))
        return data if isinstance(data,dict) else {}
    except (OSError,ValueError):
        return {}


def save(path,data):
    target=Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--questions',default='site/data/question-hour.json')
    parser.add_argument('--trade',default='site/data/trade-ledger.json')
    args=parser.parse_args()
    now=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    questions=refresh_questions(read_previous(args.questions),now)
    save(args.questions,questions)
    trade=refresh_trade(read_previous(args.trade),now)
    save(args.trade,trade)
    print('Public records:',len(questions['items']),'questions;',len(trade['items']),'trade observations')
if __name__=='__main__':
    main()
