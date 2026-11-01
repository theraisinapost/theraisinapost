"""Editorial footer and homepage language contract for the static publication."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build

FEED='<rss><channel><item><title>Public records</title><link>https://raisinapost.substack.com/p/records</link><description>Public sources.</description><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>'

class FooterEditorialTests(unittest.TestCase):
    def test_footer_shared_across_every_page_and_has_clear_grouped_navigation(self):
        with TemporaryDirectory() as tmp:
            dest=Path(tmp)
            build.render_site(build.parse_feed(FEED),dest)
            for page_name in ('index.html','about.html','markets.html','parliament-file.html','editorial-policy.html'):
                page=(dest/page_name).read_text(encoding='utf-8')
                self.assertIn('class="editorial-footer-kicker"',page)
                self.assertIn('class="editorial-footer-pitch"',page)
                for group in ('Read','Research','Publication'):
                    self.assertIn('class="editorial-footer-group-label">'+group+'</h3>',page)
                for path in ('about.html','editorial-policy.html','corrections.html','parliament-file.html','policy-monitor.html'):
                    self.assertIn('href="'+path+'"',page)
                self.assertIn('href="https://raisinapost.substack.com/subscribe"',page)
                self.assertIn('href="#main"',page)
                self.assertIn('src="footer-watermark.svg"',page)
                self.assertNotIn('<!--YEAR-->',page)
                self.assertNotIn('<!--EDITORIAL_FOOTER-->',page)

    def test_swiss_footer_typography_and_semantic_disclosures(self):
        from html.parser import HTMLParser

        class NavigationInspector(HTMLParser):
            def __init__(self):
                super().__init__()
                self.links = []
            def handle_starttag(self, tag, attrs):
                if tag == 'a':
                    self.links.append(dict(attrs).get('href', ''))

        with TemporaryDirectory() as tmp:
            out=Path(tmp)
            build.render_site(build.parse_feed(FEED),out)
            footer=(out/'index.html').read_text(encoding='utf-8')
            css=(out/'footer-refresh.css').read_text(encoding='utf-8')
            for route in ('index.html','about.html','markets.html','data-room.html'):
                html=(out/route).read_text(encoding='utf-8')
                self.assertEqual(html.count('id="footer-invitation"'),1)
                self.assertIn('Policy and business, in context.', html)
                self.assertIn('Briefings and analysis on Indian policy, business and the economy.',html)
            self.assertIn('grid-template-columns:repeat(12,minmax(0,1fr))',css)
            self.assertIn('font-variant-numeric:tabular-nums',css)
            self.assertIn('@media(max-width:660px)',css)
            self.assertIn('prefers-reduced-motion',css)
            self.assertIn('href="https://raisinapost.substack.com/archive"',footer)
            self.assertIn('href="https://raisinapost.substack.com/p/editorial-policy"',footer)
            self.assertNotIn('target="_blank" rel="noopener noreferrer">An Indian publication',footer)
            assert_parser=NavigationInspector()
            assert_parser.feed(footer)
            self.assertNotIn('#', assert_parser.links)
            self.assertNotIn('', assert_parser.links)

    def test_homepage_has_refined_copy_and_one_primary_subscribe_pitch(self):
        with TemporaryDirectory() as tmp:
            dest=Path(tmp)
            build.render_site(build.parse_feed(FEED),dest)
            page=(dest/'index.html').read_text(encoding='utf-8')
            self.assertIn('The decisions shaping India.',page)
            self.assertIn('original sources',page)
            self.assertIn('id="research-desk"',page)
            self.assertEqual(page.count('class="editorial-footer-pitch"'),1)
            self.assertNotIn('Read what matters.',page)
            self.assertNotIn('About us',page)
            self.assertIn('About the publication',page)

if __name__=='__main__':
    unittest.main()
