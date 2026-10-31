"""Offline validation: invalid sources must never create published financial values."""
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import finance_refresh as finance
import build


def observation(value=100, period='2020', country='IND', code='FP.CPI.TOTL'):
    return {'date':period,'value':value,'countryiso3code':country,'indicator':{'id':code}}


class FinanceSources(unittest.TestCase):
    def test_annual_series_rejects_wrong_country_code_non_numeric_and_future_values(self):
        data = [None,[observation(), observation(country='USA'), observation(code='OTHER'),
                      observation(value='120'), observation(value=True), observation(value=float('nan')),
                      observation(period='2999'), observation(value=-1)]]
        self.assertEqual(finance.annual_rows(data,'FP.CPI.TOTL'), [{'period':'2020','value':100}])
        with self.assertRaises(ValueError):
            finance.annual_rows([None,[observation(),observation(value=110)]], 'FP.CPI.TOTL')
        with self.assertRaises(ValueError):
            finance.annual_rows([None,[{'indicator':'bad'}]], 'FP.CPI.TOTL')

    def test_oil_preserves_published_negative_prices_and_rejects_bad_schema_and_dates(self):
        text = 'Date,Price\n2020-04-20,-36.98\n2020-04-21,8.91\n2020-04-22,NaN\n2999-01-01,10\nnot-a-date,3\n'
        self.assertEqual(finance.oil_rows(text), [{'period':'2020-04-20','value':-36.98},{'period':'2020-04-21','value':8.91}])
        with self.assertRaises(ValueError): finance.oil_rows('Date,Other\n2020-01-01,10')
        with self.assertRaises(ValueError): finance.oil_rows('Date,Price\n2020-01-01,10\n2020-01-01,11')

    def test_failed_refresh_keeps_only_validated_prior_observations_and_their_retrieval_date(self):
        def fetch(url):
            if 'raw.githubusercontent' in url: return 'Date,Price\n2020-04-20,-36.98\n'
            code = url.split('/indicator/')[1].split('?')[0]
            return json.dumps([None,[observation(code=code)]])
        first = finance.refresh(fetch=fetch)
        first['annual']['cpi']['retrieved_at'] = '2020-01-01T00:00:00+00:00'
        def fail(url): raise OSError('source unavailable')
        retained = finance.refresh(first, fetch=fail)
        self.assertEqual(retained['annual']['cpi']['status'],'retained')
        self.assertEqual(retained['annual']['cpi']['retrieved_at'],'2020-01-01T00:00:00+00:00')
        first['annual']['cpi']['rows'] = [{'period':'2020','value':'invented'}]
        missing = finance.refresh(first, fetch=fail)
        self.assertEqual(missing['annual']['cpi']['status'],'unavailable')
        self.assertEqual(missing['annual']['cpi']['rows'],[])

    def test_build_publishes_finance_assets_without_loading_them_on_the_homepage(self):
        feed='<rss><channel><item><title>Records</title><link>https://raisinapost.substack.com/p/records</link><description>Reporting.</description></item></channel></rss>'
        with TemporaryDirectory() as tmp:
            out=Path(tmp)
            build.render_site(build.parse_feed(feed),out)
            for path in ['finance.js','finance.css','components/finance-model.mjs','data/finance.json']:
                self.assertTrue((out/path).exists(),path)
            for path in ['markets.html','india-data.html']:
                self.assertIn('src="finance.js"',(out/path).read_text())
            self.assertNotIn('src="finance.js"',(out/'index.html').read_text())
            self.assertIn('inflation-form',(out/'india-data.html').read_text())
            self.assertIn('oil-history-chart',(out/'markets.html').read_text())
