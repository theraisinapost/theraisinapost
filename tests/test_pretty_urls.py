"""Smoke-check directory permalinks, canonical metadata and legacy bookmarks."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build

FEED = '<rss><channel><item><title>Policy note</title><link>https://raisinapost.substack.com/p/policy-note</link><description>Primary sources.</description><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>'


class PrettyURLTests(unittest.TestCase):
    def test_every_page_has_clean_permalink_and_legacy_redirect(self):
        with TemporaryDirectory() as directory:
            out = Path(directory)
            build.render_site(build.parse_feed(FEED), out)
            old_pages = [p for p in out.glob('*.html') if p.name != 'index.html']
            self.assertGreaterEqual(len(old_pages), 18)
            sitemap = (out / 'sitemap.xml').read_text(encoding='utf-8')
            self.assertNotIn('.html', sitemap)
            home = (out / 'index.html').read_text(encoding='utf-8')
            self.assertIn('href="about/"', home)
            self.assertNotIn('href="about.html"', home)
            for old in old_pages:
                slug = old.stem
                clean = out / slug / 'index.html'
                self.assertTrue(clean.is_file(), slug)
                document = clean.read_text(encoding='utf-8')
                self.assertIn('<base href="../">', document, slug)
                self.assertIn('<link rel="canonical" href="' + build.DEFAULT_URL + slug + '/">', document, slug)
                self.assertIn('<loc>' + build.DEFAULT_URL + slug + '/</loc>', sitemap, slug)
                self.assertIn('window.location.replace(', old.read_text(encoding='utf-8'), slug)
                self.assertNotIn('href="' + slug + '.html"', document)

    def test_search_palette_uses_clean_routes(self):
        with TemporaryDirectory() as directory:
            out = Path(directory)
            build.render_site(build.parse_feed(FEED), out)
            reader = (out / 'reader.js').read_text(encoding='utf-8')
            self.assertIn("url:'ownership-atlas/'", reader)
            self.assertIn("url:'markets/#oil-history'", reader)
            self.assertNotIn("url:'about.html'", reader)
            about = (out / 'about' / 'index.html').read_text(encoding='utf-8')
            self.assertIn(build.DEFAULT_URL + 'editorial-policy/', about)


if __name__ == '__main__':
    unittest.main()
