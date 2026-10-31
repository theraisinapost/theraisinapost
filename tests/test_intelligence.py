"""Offline source safety and publishing tests for intelligence research products."""
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build

FEED='<rss><channel><item><title>Records</title><link>https://raisinapost.substack.com/p/records</link><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate><description>Public archive.</description></item></channel></rss>'

class IntelligencePages(unittest.TestCase):
    def test_builds_all_three_pages_with_real_links_and_sitemap(self):
        with TemporaryDirectory() as d:
            out=Path(d)
            build.render_site(build.parse_feed(FEED),out)
            home=(out/'index.html').read_text(encoding='utf-8')
            site_map=(out/'sitemap.xml').read_text(encoding='utf-8')
            for name in ('parliament-file','data-room','evidence-desk'):
                page=(out/(name+'.html')).read_text(encoding='utf-8')
                self.assertIn('href="minimal.css"',page)
                self.assertIn('href="intelligence.css"',page)
                self.assertIn('href="https://theraisinapost.github.io/theraisinapost/'+name+'.html"',page)
                self.assertIn('href="'+name+'.html"',home)
                self.assertIn(name+'.html',site_map)
                self.assertNotIn('<!--SITE_URL-->',page)
            self.assertTrue((out/'intelligence.js').exists())
            self.assertTrue((out/'data/parliament.json').exists())
            self.assertTrue((out/'data/source-watch.json').exists())

    def test_parliament_parser_accepts_only_official_document_urls(self):
        import parliament
        records=[
            {"reportNo":17,"SubjectOfTheReport":"Expenditure and oversight",
             "dateOfPresentation":"2026-10-29","url":"https://sansad.in/getFile/report.pdf"},
            {"reportNo":18,"SubjectOfTheReport":"Untrusted link",
             "dateOfPresentation":"2026-10-29","url":"https://example.com/fake.pdf"},
            {"reportNo":19,"SubjectOfTheReport":"<script>alert(1)</script>",
             "dateOfPresentation":"2026-10-29","url":"javascript:alert(1)"},
        ]
        result=parliament.normalize_records(records,"finance",{"name":"Finance","api_code":12})
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["title"],"Expenditure and oversight")
        self.assertEqual(result[0]["url"],"https://sansad.in/getFile/report.pdf")
        self.assertEqual(result[0]["date"],"2026-10-29")

    def test_missing_or_future_parliament_date_not_invented(self):
        import parliament
        records=[{"reportNo":32,"SubjectOfTheReport":"Audit inquiry",
                  "url":"https://sansad.in/getFile/another.pdf"}]
        result=parliament.normalize_records(records,"public_accounts",{"name":"Public Accounts","api_code":26})
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["date"],"")

    def test_watch_does_not_claim_first_scan_is_an_event(self):
        import source_watch
        original={}
        new=source_watch.transition(original, "sebi", "abcdef", "2026-10-31T12:00:00Z")
        self.assertFalse(new["change_unreviewed"])
        self.assertEqual(new["status"],"available")
        changed=source_watch.transition(new, "sebi", "changed", "2026-11-01T12:00:00Z")
        self.assertTrue(changed["change_unreviewed"])
        self.assertEqual(changed["change_detected_at"],"2026-11-01T12:00:00Z")
        repeat=source_watch.transition(changed, "sebi", "changed", "2026-11-02T12:00:00Z")
        self.assertEqual(repeat["change_detected_at"],changed["change_detected_at"])
        self.assertTrue(repeat["change_unreviewed"])

    def test_watch_source_url_restrictions(self):
        import source_watch
        self.assertTrue(source_watch.safe_target("https://www.sebi.gov.in/legal/circulars.html"))
        for bad in ("http://www.sebi.gov.in/", "https://www.sebi.gov.in.evil.com/",
                    "https://localhost/", "file:///etc/passwd", "https://user:pass@www.sebi.gov.in/"):
            self.assertFalse(source_watch.safe_target(bad))

    def test_source_snapshots_are_safe_before_and_after_daily_refresh(self):
        import parliament
        import source_watch
        src=json.loads((ROOT/'site/data/parliament.json').read_text())
        self.assertIn(src["status"],("not_checked","available","partial","stale","unavailable"))
        self.assertIn("editorial",src["notice"].lower())
        if src["status"]=="not_checked":
            self.assertEqual(src["items"],[])
        for report in src.get("items",[]):
            self.assertTrue(parliament.official_link(report.get("url")))
            self.assertTrue(report.get("title"))
            self.assertRegex(report.get("date",""),r"^$|^\d{4}-\d{2}-\d{2}$")
        watch=json.loads((ROOT/'site/data/source-watch.json').read_text())
        self.assertIsInstance(watch["sources"],list)
        for entry in watch["sources"]:
            self.assertTrue(source_watch.safe_target(entry["url"]))
            self.assertIn(entry["status"],("available","unavailable"))

if __name__=="__main__":
    unittest.main()
