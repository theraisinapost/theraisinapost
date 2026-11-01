"""Offline verification for the publication's institutional pages."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build

FEED='<rss><channel><item><title>Public record</title><link>https://raisinapost.substack.com/p/public-record</link><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate><description>Editorial report</description></item></channel></rss>'

class InstitutionalPages(unittest.TestCase):
    def test_about_policy_and_corrections_are_real_build_pages(self):
        with TemporaryDirectory() as td:
            out=Path(td)
            build.render_site(build.parse_feed(FEED),out)
            for name in ('about','editorial-policy','corrections'):
                page=(out/(name+'.html')).read_text(encoding='utf-8')
                self.assertIn('href="minimal.css"',page)
                for phrase in ('independent journalism', 'independent reporting', 'independent publication'):
                    self.assertNotIn(phrase, page.lower())
                self.assertIn('href="editorial-pages.css"',page)
                self.assertIn('href="https://theraisinapost.github.io/'+name+'.html"',page)
                self.assertNotIn('<!--SITE_URL-->',page)
                self.assertNotIn('<!--EDITORIAL_FOOTER-->',page)
                self.assertIn('href="'+name+'.html"',(out/'index.html').read_text(encoding='utf-8'))
                self.assertIn(name+'.html',(out/'sitemap.xml').read_text(encoding='utf-8'))
            self.assertTrue((out/'editorial-pages.css').exists())

    def test_policy_is_transparent_and_points_to_published_original(self):
        page=(ROOT/'site/editorial-policy.html').read_text(encoding='utf-8')
        for identifier in ('principles','verification','analysis','corrections','visuals-ai','conflicts','access','contact'):
            self.assertIn('id="'+identifier+'"',page)
        self.assertIn('25 October 2026',page)
        self.assertIn('https://raisinapost.substack.com/p/editorial-policy',page)
        self.assertIn('raisinapost@substack.com',page)
        self.assertIn('Alle',page)
        self.assertNotIn('100% unbiased',page)

    def test_correspondence_page_does_not_promise_secure_drop_or_unverified_staff(self):
        page=(ROOT/'site/corrections.html').read_text(encoding='utf-8')
        self.assertIn('mailto:raisinapost@substack.com',page)
        self.assertIn('https://raisinapost.substack.com/p/editorial-policy',page)
        self.assertIn('Do not send confidential',page)
        self.assertNotIn('<form',page)
        self.assertNotIn('24-hour',page)

    def test_about_has_publication_formats_and_links_to_standards(self):
        about=(ROOT/'site/about.html').read_text(encoding='utf-8')
        self.assertIn('Policy and business in context.',about)
        for marker in ('The Power Brief','Sunday Insights','Weekly podcast','Visual explainers','about-coverage','about-principle','about-research-links'):
            self.assertIn(marker,about)
        self.assertIn('href="editorial-policy.html"',about)
        self.assertIn('href="corrections.html"',about)

if __name__=='__main__':
    unittest.main()
