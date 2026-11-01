"""Verify the published search and machine-readable content contract."""
import json
import sys
import unittest
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build
import discovery

FEED = '''<rss><channel><item><title>Policy &amp; business</title>
<link>https://raisinapost.substack.com/p/policy</link>
<pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate>
<description>A public policy briefing.</description></item></channel></rss>'''


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.links, self.schemas = [], [], []
        self.schema = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.meta.append(attrs)
        if tag == 'link':
            self.links.append(attrs)
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.schema = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.schema = False

    def handle_data(self, data):
        if self.schema:
            self.schemas.append(json.loads(data))


class DiscoveryTests(unittest.TestCase):
    def test_every_published_page_has_matching_metadata_and_schema(self):
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            build.render_site(build.parse_feed(FEED), out)
            urls = []
            for path in out.glob('*.html'):
                head = Head()
                head.feed(path.read_text())
                canonical = [x['href'] for x in head.links if x.get('rel') == 'canonical']
                self.assertEqual(len(canonical), 1, path.name)
                urls += canonical
                for name in ('description', 'robots', 'og:title', 'og:description', 'og:url', 'og:image', 'twitter:card'):
                    values = [m['content'] for m in head.meta if m.get('name', m.get('property')) == name]
                    self.assertEqual(len(values), 1, (path.name, name))
                    self.assertTrue(values[0])
                self.assertEqual([m['content'] for m in head.meta if m.get('property') == 'og:url'], canonical)
                self.assertEqual(len(head.schemas), 1)
                graph = head.schemas[0]['@graph']
                publisher = next(n for n in graph if n['@type'] == 'NewsMediaOrganization')
                self.assertEqual(publisher['sameAs'], ['https://raisinapost.substack.com/'])
                self.assertIn('corrections/', publisher['correctionsPolicy'])
                # An excerpt collection must never impersonate a full news article.
                self.assertFalse(any(n['@type'] == 'NewsArticle' for n in graph))
                if path.name == 'index.html':
                    items = next(n for n in graph if n['@type'] == 'ItemList')['itemListElement']
                    self.assertEqual(items[0]['url'], 'https://raisinapost.substack.com/p/policy')
            sitemap = ET.parse(out / 'sitemap.xml')
            locs = [n.text for n in sitemap.findall('.//{*}loc')]
            self.assertCountEqual(locs, urls)
            self.assertNotIn('lastmod', (out / 'sitemap.xml').read_text())
            directory = json.loads((out / 'site-index.json').read_text())
            self.assertCountEqual([p['url'] for p in directory['pages']], urls)

    def test_custom_domain_and_discovery_files_do_not_leak_default_host(self):
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            build.render_site(build.parse_feed(FEED), out, 'https://post.example/news/')
            for name in ('sitemap.xml', 'robots.txt', 'llms.txt', 'site-index.json'):
                text = (out / name).read_text()
                self.assertIn('https://post.example/news/', text)
                self.assertNotIn('theraisinapost.github.io', text)
            self.assertIn('User-agent: *\nAllow: /', (out / 'robots.txt').read_text())
            self.assertIn('host root', (out / 'robots.txt').read_text())
            self.assertIn('Full articles remain', (out / 'llms.txt').read_text())
            full = (out / 'llms-full.txt').read_text()
            self.assertIn('What does The Raisina Post cover?', full)
            self.assertNotIn('<script', full)
            self.assertNotIn('mobile-menu-trigger', full)

    def test_untrusted_feed_titles_cannot_break_out_of_json_script(self):
        posts = build.parse_feed(FEED)
        posts[0]['title'] = '</script><script>alert(1)</script>&'
        source = '<html><head><title>Test</title><meta name="description" content="Description"></head><body><main>Visible</main></body></html>'
        result, _, _ = discovery.metadata(source, 'index.html', build.DEFAULT_URL, posts)
        self.assertNotIn('</script><script>alert', result)
        head = Head()
        head.feed(result)
        self.assertEqual(head.schemas[0]['@graph'][-1]['itemListElement'][0]['name'], posts[0]['title'])

    def test_invalid_public_base_url_is_rejected(self):
        with TemporaryDirectory() as tmp:
            for url in ('http://example.com/', 'https://user:password@example.com/', 'https://example.com/?preview=true'):
                with self.assertRaises(ValueError):
                    discovery.publish_discovery(tmp, url, [])


if __name__ == '__main__':
    unittest.main()

class RootMigrationTests(unittest.TestCase):
    def test_root_preserves_legacy_home_html_and_pretty_links(self):
        with TemporaryDirectory() as tmp:
            out=Path(tmp)
            build.render_site(build.parse_feed(FEED),out,'https://theraisinapost.github.io/')
            for old,target in [('index.html',''),('terminal.html','terminal/'),('terminal/index.html','terminal/'),('ownership-atlas/index.html','ownership-atlas/')]:
                text=(out/'theraisinapost'/old).read_text()
                self.assertIn('https://theraisinapost.github.io/'+target,text)
                self.assertIn('location.search + location.hash',text)
                self.assertIn('rel="canonical"',text)
            self.assertNotIn('/theraisinapost/',(out/'sitemap.xml').read_text())
            self.assertEqual((out/'sitemap.xml').read_bytes(),(out/'theraisinapost/sitemap.xml').read_bytes())
    def test_project_path_remains_correct_until_repository_rename(self):
        with TemporaryDirectory() as tmp:
            out=Path(tmp)
            build.render_site(build.parse_feed(FEED),out,'https://theraisinapost.github.io/theraisinapost/')
            self.assertFalse((out/'theraisinapost').exists())
            self.assertIn('href="https://theraisinapost.github.io/theraisinapost/"',(out/'index.html').read_text())
