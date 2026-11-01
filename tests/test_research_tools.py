import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from country_refresh import parse, refresh
from research_assets import library, ownership_entities

class ResearchToolsTests(unittest.TestCase):
 def test_country_parser_rejects_foreign_indicators_duplicates_and_invalid_values(self):
  def row(v,c='IND',year='2024',code='X'):return dict(countryiso3code=c,date=year,value=v,indicator={'id':code})
  result=parse([{},[row(3),row(None),row(True),row(float('nan')),row(5,'ZZZ'),row(8,code='Y')]],'X')
  self.assertEqual(result,[dict(country='IND',period='2024',value=3)])
  with self.assertRaises(ValueError):parse([{},[row(3),row(4)]],'X')
 def test_failed_refresh_preserves_observation_and_retrieval_date(self):
  def failed(url):raise OSError('offline')
  previous={'series':{'growth':{'retrieved_at':'2026-10-31','rows':[dict(country='IND',period='2024',value=4)]}}}
  result=refresh(previous,failed)
  self.assertEqual(result['series']['growth']['status'],'retained')
  self.assertEqual(result['series']['growth']['retrieved_at'],'2026-10-31')
  self.assertEqual(result['series']['exports']['status'],'unavailable')
 def test_ownership_export_excludes_aggregate_categories_and_preserves_provenance(self):
  companies=json.loads((Path(__file__).parents[1]/'site/data/ownership-companies.json').read_text())['companies']
  entities=ownership_entities(companies);ids={r['id'] for r in entities}
  holdings=[r for r in entities if r['schema']=='Ownership']
  self.assertEqual(len(holdings),sum(o['kind']=='Named shareholder' for c in companies for o in c['owners']))
  self.assertEqual(len(entities),len(ids))
  for r in holdings:
   self.assertIn(r['properties']['owner'][0],ids)
   self.assertIn(r['properties']['asset'][0],ids)
   self.assertTrue(r['properties']['sourceUrl'][0].startswith('https://'))
   self.assertNotIn('startDate',r['properties'])
