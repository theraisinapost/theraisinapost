"""The Raisina Post's About page remains editorial, source-aware, and accessible."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build

FEED = """<rss><channel><item><title>Latest edition</title><link>https://raisinapost.substack.com/p/latest-edition</link><description>A public briefing.</description><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>"""

class AboutPageTests(unittest.TestCase):
    def test_about_page_is_a_published_institutional_editorial_profile(self):
        with TemporaryDirectory() as directory:
            dest=Path(directory)
            build.render_site(build.parse_feed(FEED),dest)
            doc=(dest/'about.html').read_text(encoding='utf-8')
            self.assertIn('<main',doc)
            self.assertIn('class="about-hero"',doc)
            self.assertIn('class="about-coverage"',doc)
            self.assertIn('class="about-principles"',doc)
            self.assertIn('class="about-research"',doc)
            self.assertIn('class="about-independence"',doc)
            self.assertIn('class="about-endnote"',doc)
            self.assertIn('aria-labelledby=',doc)
            self.assertIn('href="https://theraisinapost.github.io/theraisinapost/about.html"',doc)
            self.assertIn('href="minimal.css"',doc)
            self.assertIn('href="about.css"',doc)
            self.assertTrue((dest/'about.css').exists())
            self.assertIn('https://raisinapost.substack.com/p/editorial-policy',doc)
            self.assertIn('Champaran Innovatives',doc)
            self.assertIn('mailto:raisinapost@substack.com',doc)

    def test_sections_and_research_desk_are_discoverable_without_fake_metrics(self):
        with TemporaryDirectory() as directory:
            dest=Path(directory)
            build.render_site(build.parse_feed(FEED),dest)
            doc=(dest/'about.html').read_text(encoding='utf-8')
            for category in ('The Power Brief','Business','Governance'):
                self.assertIn('<h3>'+category+'</h3>',doc)
            for path in ('policy-monitor.html','india-data.html','release-calendar.html','ownership-atlas.html','publication-guide.html'):
                self.assertIn('href="'+path+'"',doc)
            for unsupported in ('1M readers','award-winning newsroom','500 journalists','world-leading'):
                self.assertNotIn(unsupported,doc)
            self.assertNotIn('<!--SITE_URL-->',doc)
            self.assertNotIn('<!--EDITORIAL_FOOTER-->',doc)

if __name__=='__main__':
    unittest.main()
