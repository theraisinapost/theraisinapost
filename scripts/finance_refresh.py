"""Refresh dated World Bank observations and EIA oil history. No keys required."""
import argparse
import calendar
import csv
import io
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SERIES = {
    'growth': ('NY.GDP.MKTP.KD.ZG', 'Real GDP growth', '%'),
    'inflation': ('FP.CPI.TOTL.ZG', 'Consumer price inflation', '%'),
    'manufacturing': ('NV.IND.MANF.ZS', 'Manufacturing share of GDP', '%'),
    'reserves': ('FI.RES.TOTL.CD', 'Total reserves, including gold', 'US$'),
    'cpi': ('FP.CPI.TOTL', 'Consumer price index', '2010 = 100'),
    'gdp': ('NY.GDP.MKTP.CD', 'GDP at current prices', 'US$'),
    'income': ('NY.GDP.PCAP.CD', 'GDP per capita at current prices', 'US$ per person'),
    'exports': ('NE.EXP.GNFS.ZS', 'Exports of goods and services', '% of GDP'),
    'imports': ('NE.IMP.GNFS.ZS', 'Imports of goods and services', '% of GDP'),
    'fdi': ('BX.KLT.DINV.WD.GD.ZS', 'Foreign direct investment, net inflows', '% of GDP'),
    'current_account': ('BN.CAB.XOKA.GD.ZS', 'Current account balance', '% of GDP'),
    'unemployment': ('SL.UEM.TOTL.ZS', 'Unemployment, modelled ILO estimate', '% of labour force'),
    'participation': ('SL.TLF.CACT.ZS', 'Labour force participation, modelled ILO estimate', '% of population aged 15+'),
    'investment': ('NE.GDI.TOTL.ZS', 'Gross capital formation', '% of GDP'),
    'credit': ('FS.AST.PRVT.GD.ZS', 'Domestic credit to private sector', '% of GDP'),
    'remittances': ('BX.TRF.PWKR.DT.GD.ZS', 'Personal remittances received', '% of GDP'),
}
OIL = {
    'brent': 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/brent-daily.csv',
    'wti': 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/wti-daily.csv',
}


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def annual_rows(payload, code):
    if not isinstance(payload, list) or len(payload) < 2 or not isinstance(payload[1], list):
        raise ValueError('Invalid World Bank response')
    rows = {}
    for item in payload[1]:
        if not isinstance(item, dict) or item.get('countryiso3code') != 'IND' or not isinstance(item.get('indicator'), dict) or item['indicator'].get('id') != code:
            continue
        period, value = item.get('date'), item.get('value')
        if not isinstance(period, str) or len(period) != 4 or not period.isdigit() or not numeric(value):
            continue
        if not 1960 <= int(period) <= date.today().year:
            continue
        if (code == 'FP.CPI.TOTL' and value <= 0) or (code == 'FI.RES.TOTL.CD' and value < 0):
            continue
        if period in rows and rows[period] != value:
            raise ValueError('Conflicting annual observations')
        rows[period] = value
    if not rows:
        raise ValueError('No validated annual observations')
    return [{'period': k, 'value': v} for k, v in sorted(rows.items())]


def oil_rows(text):
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames != ['Date', 'Price']:
        raise ValueError('Oil source schema changed')
    rows = {}
    for item in reader:
        try:
            period = date.fromisoformat(item['Date'])
            value = float(item['Price'])
        except (ValueError, TypeError, KeyError):
            continue
        # WTI spot has had negative observations; preserve finite negative prices.
        if period > date.today() or not math.isfinite(value):
            continue
        label = period.isoformat()
        if label in rows and rows[label] != value:
            raise ValueError('Conflicting oil observations')
        rows[label] = value
    if not rows:
        raise ValueError('No validated oil observations')
    latest = date.fromisoformat(max(rows))
    start_year = latest.year - 10
    start = date(start_year, latest.month, min(latest.day, calendar.monthrange(start_year, latest.month)[1]))
    return [{'period': k, 'value': v} for k, v in sorted(rows.items()) if k >= start.isoformat()]


def download(url):
    request = Request(url, headers={'User-Agent': 'RaisinaPostFinance/1.0', 'Accept': 'application/json,text/csv'})
    with urlopen(request, timeout=25) as response:
        raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError('Source response exceeds size limit')
        return raw.decode('utf-8-sig')


def refresh(previous=None, fetch=download):
    previous = previous if isinstance(previous, dict) else {}
    checked = datetime.now(timezone.utc).isoformat(timespec='seconds')
    def collect(task):
        key, category, url, metadata = task
        result = {**metadata, 'url': url, 'checked_at': checked, 'status': 'unavailable', 'rows': []}
        try:
            raw = fetch(url)
            result['rows'] = annual_rows(json.loads(raw), metadata['code']) if category == 'annual' else oil_rows(raw)
            result.update(status='available', retrieved_at=checked)
        except (OSError, ValueError, TypeError, KeyError) as error:
            old_group = previous.get(category, {})
            old = old_group.get(key, {}) if isinstance(old_group, dict) else {}
            old = old if isinstance(old, dict) else {}
            if old.get('url') == url and old.get('rows') and old.get('retrieved_at'):
                # Revalidate saved data before retaining it after a failed refresh.
                try:
                    if category == 'annual':
                        payload = [None, [{'countryiso3code':'IND', 'indicator':{'id':metadata['code']},
                                          'date':r['period'], 'value':r['value']} for r in old['rows']]]
                        rows = annual_rows(payload, metadata['code'])
                    else:
                        rows = oil_rows('Date,Price\n' + '\n'.join(f"{r['period']},{r['value']}" for r in old['rows']))
                    result.update(status='retained', rows=rows, retrieved_at=old['retrieved_at'])
                except (ValueError, TypeError, KeyError):
                    pass
            print(f'{key}: source refresh unavailable ({type(error).__name__})')
        return key, category, result
    tasks = []
    for key, (code, label, unit) in SERIES.items():
        url = f'https://api.worldbank.org/v2/country/IND/indicator/{code}?format=json&per_page=100'
        tasks.append((key, 'annual', url, {'code':code, 'label':label, 'unit':unit,
                       'source':f'https://data.worldbank.org/indicator/{code}?locations=IN'}))
    for key, url in OIL.items():
        tasks.append((key, 'oil', url, {'label':key.upper() if key == 'wti' else 'Brent', 'unit':'US$ per barrel',
                     'source':'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm'}))
    result = {'schema':1, 'checked_at':checked, 'annual':{}, 'oil':{}}
    with ThreadPoolExecutor(max_workers=4) as executor:
        for key, category, value in executor.map(collect, tasks):
            result[category][key] = value
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('site/data/finance.json'))
    args = parser.parse_args()
    try:
        previous = json.loads(args.output.read_text())
    except (OSError, ValueError):
        previous = {}
    result = refresh(previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('Finance snapshot:', ', '.join(f'{k}={v["status"]}' for c in ('annual','oil') for k,v in result[c].items()))


if __name__ == '__main__':
    main()
