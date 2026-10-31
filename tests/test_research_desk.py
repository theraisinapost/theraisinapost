"""Research desk acceptance tests: offline, sourced and safe by default."""
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build

FEED = """<rss><channel><item><title>Economic report</title><link>https://raisinapost.substack.com/p/economic-report</link><description>Research.</description><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>"""

class ResearchDeskTests(unittest.TestCase):
    def test_all_research_pages_build_with_canonical_urls_and_internal_links(self):
        with TemporaryDirectory() as directory:
            output = Path(directory)
            build.render_site(build.parse_feed(FEED), output)
            home = (output / 'index.html').read_text(encoding='utf-8')
            for stem in ('policy-monitor', 'india-data', 'release-calendar', 'document-diff'):
                path = output / (stem + '.html')
                self.assertTrue(path.exists(), stem)
                page = path.read_text(encoding='utf-8')
                self.assertIn('href="minimal.css"', page)
                self.assertIn('href="research-desk.css"', page)
                self.assertIn('href="https://theraisinapost.github.io/theraisinapost/' + stem + '.html"', page)
                self.assertIn('href="' + stem + '.html"', home)
                self.assertIn(stem + '.html', (output / 'sitemap.xml').read_text(encoding='utf-8'))
            self.assertTrue((output / 'research-desk.js').exists())
            self.assertTrue((output / 'data' / 'regulatory.json').exists())

    def test_releases_have_primary_source_and_are_not_claimed_published(self):
        payload = json.loads((ROOT / 'site/data/release-calendar.json').read_text(encoding='utf-8'))
        self.assertGreaterEqual(len(payload['events']), 5)
        dates = [event['date'] for event in payload['events']]
        self.assertEqual(dates, sorted(dates))
        for event in payload['events']:
            self.assertRegex(event['date'], r'^202[6-7]-\d\d-\d\d$')
            self.assertEqual(event['status'], 'scheduled')
            self.assertTrue(event['source'].startswith('https://www.mospi.gov.in/'))
            self.assertTrue(event['title'])

    def test_regulatory_feed_rejects_unsafe_url_and_missing_dates(self):
        import regulatory
        xml = """<rss><channel>
        <item><title>Circular one</title><link>https://www.sebi.gov.in/legal/circulars/test.html</link><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item>
        <item><title>Bad URL</title><link>javascript:alert(1)</link><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item>
        <item><title>Missing date</title><link>https://www.sebi.gov.in/missing.html</link></item>
        </channel></rss>"""
        events = regulatory.parse_source(xml, 'SEBI', 'www.sebi.gov.in')
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['title'], 'Circular one')
        self.assertEqual(events[0]['date'], '2026-10-30')

    def test_diff_input_is_bounded_without_unsafe_html_interpolation(self):
        page = (ROOT / 'site/document-diff.html').read_text(encoding='utf-8')
        script = (ROOT / 'site/research-desk.js').read_text(encoding='utf-8')
        self.assertIn('maxlength="120000"', page)
        self.assertIn('textContent', script)
        self.assertNotIn('innerHTML', script)

if __name__ == '__main__':
    unittest.main()
