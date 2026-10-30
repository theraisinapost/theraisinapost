"""Tests for RSS ingestion and HTML generation; no network required."""
import unittest
from unittest.mock import patch
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build

FEED='''<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>The Raisina Post</title>
<item><title>India &amp; policy &lt;strong&gt;</title><link>https://raisinapost.substack.com/p/first</link><pubDate>Fri, 30 Oct 2026 04:00:00 GMT</pubDate><description><![CDATA[<p>The Power Brief | Today’s central decisions.</p><p>Wider detail in the story.</p>]]></description><enclosure url="https://substackcdn.com/cover.jpg" type="image/jpeg"/><category>Policy</category></item>
<item><title>Sunday Insights: Jobs</title><link>https://raisinapost.substack.com/p/second</link><pubDate>Sun, 25 Oct 2026 04:00:00 GMT</pubDate><description><![CDATA[<p>Sunday Insights | Employment survey changes.</p>]]></description></item>
<item><title>XSS</title><link>javascript:alert(1)</link><description><![CDATA[<script>alert(1)</script>]]></description></item></channel></rss>'''

class TestFeed(unittest.TestCase):
 def test_default_site_url_is_organization_project(self):
  self.assertEqual(build.DEFAULT_URL,'https://theraisinapost.github.io/theraisinapost/')

 def test_parse_feed_decodes_titles_sorts_and_rejects_bad_links(self):
  posts=build.parse_feed(FEED)
  self.assertEqual(len(posts),2)
  self.assertEqual(posts[0]['title'],'India & policy <strong>')
  self.assertEqual(posts[0]['category'],'The Power Brief')
  self.assertEqual(posts[1]['category'],'Sunday Insights')
  self.assertEqual(posts[0]['date'],'30 October 2026')

 def test_build_escapes_rss_content_and_links(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts, out, 'https://theraisinapost.github.io/theraisinapost/')
   html=(out/'index.html').read_text()
   self.assertIn('India &amp; policy &lt;strong&gt;',html)
   self.assertNotIn('India & policy <strong>',html)
   self.assertNotIn('<script>alert(1)',html)
   self.assertIn('https://raisinapost.substack.com/p/first',html)
   self.assertIn('href="https://theraisinapost.github.io/theraisinapost/"', html)
   self.assertTrue((out/'styles.css').exists())
   self.assertTrue((out/'sitemap.xml').exists())
   self.assertTrue((out/'posts.json').exists())

 def test_download_feed_falls_back_to_public_rss_proxy_after_403(self):
  from urllib.error import HTTPError
  from io import BytesIO
  failure=HTTPError(build.FEED_URL,403,'Forbidden',{},None)
  with patch.object(build,'urlopen',side_effect=[failure,BytesIO(FEED.encode())]) as request:
   self.assertIn('The Raisina Post',build.download_feed())
   self.assertEqual(request.call_count,2)
   self.assertTrue(request.call_args.args[0].full_url.startswith('https://proxy.cors.dev/'))

 def test_prevents_invalid_feed_from_wiping_site(self):
  with self.assertRaises(ValueError):
   build.parse_feed('<rss><channel></channel></rss>')

if __name__=='__main__':unittest.main()
