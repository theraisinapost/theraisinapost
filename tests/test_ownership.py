import json
import unittest
from datetime import date
from pathlib import Path

class OwnershipDataTests(unittest.TestCase):
 def test_records_have_consistent_provenance_and_nonoverlapping_categories(self):
  data=json.loads((Path(__file__).parents[1]/'site/data/ownership-companies.json').read_text())
  companies=data['companies']
  self.assertEqual(len(companies),84)
  for required in ('biocon','torrent-power','ashok-leyland','lupin','sterling-wilson','ion-exchange','northern-arc','hal','irfc','powergrid'):
   self.assertIn(required,{c['id'] for c in companies})
  added=[c for c in companies if c.get('sourceExtract')=='NSE 2026-09-30 Table I']
  self.assertGreaterEqual(len(added),19)
  for c in added:
   self.assertEqual(c['asOf'],'2026-09-30')
   self.assertEqual(c['recordType'],'Aggregate categories')
   self.assertAlmostEqual(sum(o['percent'] for o in c['owners']),100,delta=.02)
   self.assertIn('www.nseindia.com/companies-listing/',c['source']['url'])
  ion=next(c for c in companies if c['id']=='ion-exchange')
  self.assertAlmostEqual(ion['categoryTotals']['trust'],16.18)
  irfc=next(c for c in companies if c['id']=='irfc')
  self.assertAlmostEqual(irfc['categoryTotals']['promoter'],82.90)
  hal=next(c for c in companies if c['id']=='hal')
  self.assertAlmostEqual(hal['categoryTotals']['promoter'],71.64)
  power=next(c for c in companies if c['id']=='powergrid')
  self.assertIn('powergrid.in',power['source']['url'])
  self.assertIn('tcs',{c['id'] for c in companies})
  self.assertIn('infosys',{c['id'] for c in companies})
  self.assertIn('sbi',{c['id'] for c in companies})
  self.assertIn('tata-steel',{c['id'] for c in companies})
  self.assertIn('hdfc-bank',{c['id'] for c in companies})
  self.assertIn('asian-paints',{c['id'] for c in companies})
  self.assertIn('hdfc-life',{c['id'] for c in companies})
  self.assertIn('apollo-tyres',{c['id'] for c in companies})
  self.assertIn('kotak-bank',{c['id'] for c in companies})
  self.assertEqual(sum(len(c['owners']) for c in companies),189)
  self.assertEqual(len({c['id'] for c in companies}),len(companies))
  for c in companies:
   date.fromisoformat(c['asOf'])
   self.assertTrue(c['scope'])
   self.assertTrue(c['source']['url'].startswith('https://'))
   self.assertLessEqual(c['asOf'],'2026-11-01')
   self.assertIn(c['recordType'],('Selected named shareholders','Aggregate categories'))
   self.assertGreaterEqual(len(c['owners']),1)
   if c['recordType']=='Aggregate categories':
    self.assertTrue(all(o['kind']=='Aggregate category' for o in c['owners']))
    if 'categoryTotals' in c:
     t=c['categoryTotals']
     self.assertAlmostEqual(t['promoter']+t['public']+t['trust'],100,delta=.021)
     self.assertTrue(c['symbol'])
     self.assertEqual(set(t),{'promoter','public','trust'})
     self.assertAlmostEqual(sum(o['percent'] for o in c['owners']),sum(t.values()),places=2)
   self.assertEqual(len({o['id'] for o in c['owners']}),len(c['owners']))
   for o in c['owners']:
    self.assertEqual(o['target'],c['id'])
    self.assertEqual(o['asOf'],c['asOf'])
    self.assertEqual(o['source'],c['source']['url'])
    self.assertGreater(o['percent'],0)
    self.assertLessEqual(o['percent'],100)
   self.assertLessEqual(sum(o['percent'] for o in c['owners']),100.02)
   self.assertEqual(len({o['kind'] for o in c['owners']}),1)
   if c['id'] in ('asian-paints','hdfc-life','hindalco','apollo-tyres'):
    self.assertEqual(c['asOf'],'2026-09-30')
   if c['id']=='kotak-bank':
    self.assertEqual(c['asOf'],'2026-03-31')

