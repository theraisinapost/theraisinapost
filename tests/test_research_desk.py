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
                self.assertIn('href="https://theraisinapost.github.io/' + stem + '/"', page)
                self.assertIn('href="' + stem + '/"', home)
                self.assertIn(stem + '/', (output / 'sitemap.xml').read_text(encoding='utf-8'))
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

    def test_namespaced_atom_and_iso_dates_use_https_official_links(self):
        import regulatory
        atom = """<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>SEBI updates</title><link href="http://www.sebi.gov.in/legal/circulars/update.html"/>
          <updated>2026-10-31T12:00:00+05:30</updated><summary>Public notice</summary>
        </entry></feed>"""
        records = regulatory.parse_source(atom, 'SEBI', 'www.sebi.gov.in')
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['date'], '2026-10-31')
        self.assertEqual(records[0]['url'], 'https://www.sebi.gov.in/legal/circulars/update.html')

    def test_namespaced_rss_dates_are_read_from_dc_date(self):
        import regulatory
        rss = """<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item>
        <title>Public statement</title><link>http://pib.gov.in/PressReleasePage.aspx?PRID=123</link>
        <dc:date>2026-10-30T08:30:00Z</dc:date></item></channel></rss>"""
        events = regulatory.parse_source(rss, 'PIB', 'pib.gov.in')
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['url'], 'https://pib.gov.in/PressReleasePage.aspx?PRID=123')

    def test_undated_pib_notice_retains_no_fabricated_publication_date(self):
        import regulatory
        rss = """<rss><channel><item><title>Government notice</title>
          <link>https://pib.gov.in/PressReleasePage.aspx?PRID=987</link>
        </item></channel></rss>"""
        events = regulatory.parse_source(rss, 'PIB', 'pib.gov.in')
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['date'], '')
        self.assertEqual(events[0]['title'], 'Government notice')

    def test_sebi_informal_publication_date(self):
        import regulatory
        rss = """<rss><channel><item><title>Official circular</title>
        <link>https://www.sebi.gov.in/legal/circulars/circular.html</link>
        <pubDate>31-Oct-2026 09:00:00 IST</pubDate></item></channel></rss>"""
        events=regulatory.parse_source(rss,'SEBI','www.sebi.gov.in')
        self.assertEqual(events[0]['date'],'2026-10-31')

    def test_sebi_feed_human_readable_rss_date(self):
        import regulatory
        xml = """<rss><channel><item><title>Official SEBI update</title>
            <link>https://www.sebi.gov.in/legal/circulars/report.html</link>
            <pubDate>30 Oct, 2026 +0530</pubDate></item></channel></rss>"""
        events = regulatory.parse_source(xml, 'SEBI', 'www.sebi.gov.in')
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['date'], '2026-10-30')

    def test_diff_input_is_bounded_without_unsafe_html_interpolation(self):
        page = (ROOT / 'site/document-diff.html').read_text(encoding='utf-8')
        script = (ROOT / 'site/research-desk.js').read_text(encoding='utf-8')
        self.assertIn('maxlength="120000"', page)
        self.assertIn('textContent', script)
        self.assertNotIn('innerHTML', script)

if __name__ == '__main__':
    unittest.main()
