"""Public records release: production build and cited numeric integrity."""
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build
FEED='<rss><channel><item><title>Records</title><link>https://raisinapost.substack.com/p/records</link><description>Public sources</description><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>'

class PublicRecordsTests(unittest.TestCase):
    def test_three_pages_are_real_build_outputs(self):
        with TemporaryDirectory() as temp:
            d=Path(temp)
            build.render_site(build.parse_feed(FEED),d)
            home=(d/'index.html').read_text()
            sitemap=(d/'sitemap.xml').read_text()
            for page in ('question-hour','trade-ledger','public-money'):
                text=(d/(page+'.html')).read_text()
                self.assertIn('href="minimal.css"',text)
                self.assertIn('href="public-records.css"',text)
                self.assertIn('src="public-records.js"',text)
                self.assertIn('href="'+page+'/"',home)
                self.assertIn(page+'/',sitemap)
                self.assertNotIn('<!--SITE_URL-->',text)
                self.assertIn('<!--SITE_URL-->',(ROOT/'site'/(page+'.html')).read_text())
            for file in ('public-records.js','public-records.css','data/public-money.json','data/question-hour.json','data/trade-ledger.json'):
                self.assertTrue((d/file).exists(),file)

    def test_budget_official_summary_adds_up_without_double_counting(self):
        data=json.loads((ROOT/'site/data/public-money.json').read_text())
        self.assertEqual(data['source'],'https://www.indiabudget.gov.in/doc/eb/vol1.pdf')
        self.assertEqual(data['unit'],'INR crore')
        self.assertEqual(data['year_labels'],['2024-25 Actual','2025-26 BE','2025-26 RE','2026-27 BE'])
        rows={r['id']:r for r in data['items']}
        for row in rows.values():
            self.assertEqual(len(row['values']),4)
            self.assertTrue(all(isinstance(v,(int,float)) and v>=0 for v in row['values']))
        for i in range(4):
            self.assertAlmostEqual(rows['total']['values'][i],
                rows['central']['values'][i]+rows['transfers']['values'][i],places=2)
            self.assertAlmostEqual(rows['central']['values'][i],
                sum(rows[k]['values'][i] for k in ('establishment','central_sector','other_central')),places=2)
            self.assertAlmostEqual(rows['transfers']['values'][i],
                sum(rows[k]['values'][i] for k in ('centrally_sponsored','finance_commission','other_transfers')),places=2)

    def test_public_fallback_snapshots_never_invent_trade_values(self):
        trade=json.loads((ROOT/'site/data/trade-ledger.json').read_text())
        questions=json.loads((ROOT/'site/data/question-hour.json').read_text())
        self.assertIn(trade['status'],('not_checked','available','partial','unavailable','stale'))
        self.assertIn(questions['status'],('not_checked','available','partial','unavailable','stale'))
        for item in trade['items']:
            self.assertGreaterEqual(item['value_usd'],0)
            self.assertIn(item['flow'],('X','M'))
        for item in questions['items']:
            self.assertTrue(item['url'].startswith('https://sansad.in/'))

    def test_official_question_metadata_uses_exact_sansad_document_links(self):
        import public_records_refresh as source
        raw={'subjects':'Hospital grants','member':['Member One'],'ministry':'HEALTH AND FAMILY WELFARE',
             'questionsFilePath':'https://sansad.in/getFile/loksabhaquestions/annex/188/AU300.pdf?source=pqals',
             'date':'2026-08-12','type':'UNSTARRED','lokNo':18,'sessionNo':8,'quesNo':300}
        record=source.sansad_question_row(raw,18,8)
        self.assertEqual(record['subject'],'Hospital grants')
        self.assertEqual(record['lok_no'],18)
        self.assertIn('getFile/',record['url'])
        self.assertTrue(source.valid_sansad(record['url']))
        raw['questionsFilePath']='https://sansad.in.attacker.example/not-official.pdf'
        self.assertIsNone(source.sansad_question_row(raw,18,8))

    def test_official_question_source_payload_requires_list_of_questions(self):
        import public_records_refresh as source
        self.assertEqual(source.sansad_list({'listOfQuestions':[{'subjects':'Topic'}]}),[{'subjects':'Topic'}])
        self.assertEqual(source.sansad_list([{'listOfQuestions':[{'subjects':'Topic'}]}]),[{'subjects':'Topic'}])
        self.assertEqual(source.sansad_list({'listOfQuestions':'not a list'}),[])

if __name__=='__main__':
    unittest.main()
