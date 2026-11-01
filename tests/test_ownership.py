import json
import unittest
from datetime import date
from pathlib import Path

class OwnershipDataTests(unittest.TestCase):
 def test_records_have_consistent_provenance_and_nonoverlapping_categories(self):
  data=json.loads((Path(__file__).parents[1]/'site/data/ownership-companies.json').read_text())
  companies=data['companies']
  self.assertEqual(len(companies),5)
  self.assertEqual(len({c['id'] for c in companies}),5)
  for c in companies:
   date.fromisoformat(c['asOf'])
   self.assertTrue(c['scope'])
   self.assertTrue(c['source']['url'].startswith('https://'))
   self.assertEqual(len({o['id'] for o in c['owners']}),len(c['owners']))
   for o in c['owners']:
    self.assertEqual(o['target'],c['id'])
    self.assertEqual(o['asOf'],c['asOf'])
    self.assertEqual(o['source'],c['source']['url'])
    self.assertGreater(o['percent'],0)
    self.assertLessEqual(o['percent'],100)
   self.assertLessEqual(sum(o['percent'] for o in c['owners']),100.01)
   self.assertEqual(len({o['kind'] for o in c['owners']}),1)
