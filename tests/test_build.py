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
  self.assertEqual(posts[1]['category'],'Reporting')
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
   self.assertIn('Clarity beyond the headlines.', html)
   self.assertIn('class="lead-story"', html)
   self.assertIn('class="rail-story"', html)
   self.assertIn('class="article-row"', html)
   self.assertNotIn('<!--FEATURED-->', html)
   self.assertNotIn('<!--SIDE_STORIES-->', html)
   self.assertNotIn('<!--ARTICLES-->', html)
   self.assertNotIn('<!--YEAR-->', html)

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

 def test_white_layout_search_clock_weather_and_publication_guide(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out,'https://theraisinapost.github.io/theraisinapost/')
   page=(out/'index.html').read_text()
   css=(out/'styles.css').read_text()
   js=(out/'site.js').read_text()
   self.assertIn('id="article-search"',page)
   self.assertEqual(page.count('class="article-row"'),2)
   self.assertIn('id="analog-clock"',page)
   self.assertIn('id="new-delhi-weather"',page)
   self.assertIn('publication-guide.html',page)
   self.assertTrue((out/'publication-guide.html').exists())
   self.assertIn('--paper:#ffffff',css)
   self.assertIn('api.open-meteo.com/v1/forecast',js)
   self.assertIn('Asia/Kolkata',js)
   self.assertNotIn('DESIGN PREVIEW',page)

 def test_guide_has_real_sections_and_no_invented_email(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out,'https://theraisinapost.github.io/theraisinapost/')
   guide=(out/'publication-guide.html').read_text()
   self.assertIn('Corrections',guide)
   self.assertIn('Submissions',guide)
   self.assertIn('Rights &amp; attribution',guide)
   self.assertIn('raisinapost.substack.com/about',guide)

 def test_brand_assets_are_deployed(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   for fname in ('brand-masthead.png','brand-elephant.png','favicon.svg'):
    self.assertTrue((out/fname).exists(),fname)
   self.assertEqual((out/'brand-masthead.png').read_bytes()[:8],b'\x89PNG\r\n\x1a\n')
   home=(out/'index.html').read_text(encoding='utf-8')
   guide=(out/'publication-guide.html').read_text(encoding='utf-8')
   self.assertIn('src="brand-masthead.png"',home)
   self.assertIn('src="brand-elephant.png"',home)
   self.assertIn('src="brand-masthead.png"',guide)
   self.assertNotIn('The Raisena Post',home)

 def test_minimal_design_has_no_redundant_labels_and_uses_red_actions(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   home=(out/'index.html').read_text(encoding='utf-8')
   guide=(out/'publication-guide.html').read_text(encoding='utf-8')
   styles=(out/'styles.css').read_text(encoding='utf-8')
   self.assertNotIn('INDEPENDENT JOURNALISM',home)
   self.assertNotIn('ISSUE BY ISSUE',home)
   self.assertNotIn('THE LATEST DISPATCHES',home)
   self.assertNotIn('THE LEAD DISPATCH',home)
   self.assertIn('id="article-search"',home)
   self.assertIn('id="analog-clock"',home)
   self.assertIn('id="new-delhi-weather"',home)
   self.assertIn('publication-guide.html#corrections',home)
   self.assertNotIn('01 / HOW WE WORK',guide)
   self.assertIn('--radius:8px',styles)
   self.assertIn('--accent:#a41129',styles)
   self.assertIn('opacity:.8',styles)
   self.assertIn('border-radius:var(--radius)',styles)

 def test_link_labels_are_clean_without_arrows(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   for f in ('index.html','publication-guide.html'):
    content=(out/f).read_text(encoding='utf-8')
    for arrow in ('↗','↖','↘','↙','←','→'):
     self.assertNotIn(arrow,content)
    self.assertIn('href=',content)

 def test_new_delhi_weather_emoji_and_refined_ist_dial(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   home=(out/'index.html').read_text(encoding='utf-8')
   js=(out/'site.js').read_text(encoding='utf-8')
   css=(out/'styles.css').read_text(encoding='utf-8')
   self.assertIn('id="weather-emoji"',home)
   self.assertIn('id="analog-clock"',home)
   self.assertIn('mark < 60',js)
   self.assertIn('mark % 5 === 0',js)
   self.assertIn('is_day',js)
   for emoji in ('🌙','🌤️','☁️','🌫️','🌦️','🌧️','❄️','⛈️'):
    self.assertIn(emoji,js)
   self.assertIn('--dial-radius:45px',css)
   self.assertIn('.dial-mark-major',css)
   self.assertIn('Asia/Kolkata',js)


 def test_current_substack_sections_are_available(self):
  self.assertEqual(build.classify('Daily news', 'The Power Brief | Today', []),'The Power Brief')
  self.assertEqual(build.classify('Who Owns Tata?', 'Records review', []),'Business')
  self.assertEqual(build.classify("Who Controls India's Corporate Courts?", 'Document analysis', []),'Governance')
  self.assertEqual(build.classify('Industry report', 'Latest news', ['Business']),'Business')
  self.assertEqual(build.classify('Policy review', 'Latest news', ['Governance']),'Governance')
  self.assertEqual(build.classify('Historic essay', 'Sunday Insights | Earlier series', []),'Reporting')

 def test_menu_matches_substack_and_pages_have_only_weather_emoji(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   home=(out/'index.html').read_text(encoding='utf-8')
   guide=(out/'publication-guide.html').read_text(encoding='utf-8')
   about=(out/'about.html').read_text(encoding='utf-8')
   css=(out/'styles.css').read_text(encoding='utf-8')
   nav=home.split('<div class="nav-links">')[1].split('</div>')[0]
   for label in ('Home','The Power Brief','Business','Governance','Editorial policy','About'):
    self.assertIn(label,nav)
   for label in ('Sunday Insights','Records Review','Visual Explainers','Podcast','Audio'):
    self.assertNotIn(label,nav)
    self.assertNotIn(label,guide)
    self.assertNotIn(label,about)
   for category in ('The Power Brief','Business','Governance'):
    self.assertIn('data-filter="'+category+'"',home)
    self.assertIn('<h3>'+category+'</h3>',about)
    self.assertIn('<h3>'+category+'</h3>',guide)
   self.assertIn('https://raisinapost.substack.com/p/editorial-policy',nav)
   self.assertIn('raisinapost@substack.com',guide)
   self.assertIn('Corrections',guide)
   self.assertIn('Submissions',guide)
   self.assertIn('Rights &amp; attribution',guide)
   self.assertIn('about.html',(out/'sitemap.xml').read_text())
   self.assertGreater(len(guide),9500)
   self.assertGreater(len(about),5500)
   self.assertIn('id="weather-emoji"',home)
   self.assertIn('"Apple Color Emoji"',css)
   for emoji in ('📰','📖','🔎','🗂️','🎙️','📝'):
    self.assertNotIn(emoji,home+guide+about)
   self.assertNotIn('<!--SITE_URL-->',about)

 def test_optional_source_backed_charts_are_copied_without_loading_on_homepage(self):
  posts=build.parse_feed(FEED)
  with TemporaryDirectory() as d:
   out=Path(d)/'dist'
   build.render_site(posts,out)
   module=(out/'components'/'editorial-chart.mjs')
   self.assertTrue(module.exists())
   source=module.read_text(encoding='utf-8')
   self.assertIn('renderEditorialChart',source)
   self.assertIn('@observablehq/plot@0.6.17',source)
   self.assertIn('sourceUrl',source)
   self.assertNotIn('components/editorial-chart.mjs',(out/'index.html').read_text())
   self.assertNotIn('https://cdn.jsdelivr.net/npm/@observablehq/plot',(out/'index.html').read_text())

if __name__=='__main__':unittest.main()
