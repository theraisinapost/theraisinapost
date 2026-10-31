#!/usr/bin/env python3
"""Build the Raisina Post's public RSS-powered reading index.

Source: https://raisinapost.substack.com/feed . This website links to canonical
Substack posts, never copies full articles or paid content.
"""
import argparse
import html
import json
import os
import re
import shutil
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from http.client import IncompleteRead
from urllib.parse import urlsplit, quote
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parents[1]
FEED_URL = 'https://raisinapost.substack.com/feed'
DEFAULT_URL = 'https://theraisinapost.github.io/theraisinapost/'
MEDIA_NS = 'http://search.yahoo.com/mrss/'

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.words = []
        self.image = ''
    def handle_data(self, data):
        self.words.append(data)
    def handle_starttag(self, tag, attrs):
        if tag == 'img' and not self.image:
            self.image = dict(attrs).get('src', '')
        if tag in ('p', 'br', 'li', 'div', 'h1', 'h2', 'h3'):
            self.words.append(' ')

def text_from_markup(markup):
    parser=PlainText()
    parser.feed(markup or '')
    return re.sub(r'\s+', ' ', html.unescape(' '.join(parser.words))).strip(), parser.image

def is_valid_link(raw):
    try:
        u = urlsplit(raw)
        return u.scheme == 'https' and u.hostname == 'raisinapost.substack.com' and u.path.startswith('/p/')
    except ValueError:
        return False

def is_valid_image(raw):
    try:
        u = urlsplit(raw)
        return u.scheme == 'https' and u.hostname and not u.username and not u.password
    except ValueError:
        return False

def classify(title, description, categories):
    """Classify into the three visible publication sections when evidence is clear."""
    tags = ' '.join(categories).casefold()
    lead = description[:240].casefold()
    headline = title.casefold()
    if 'the power brief' in tags or 'the power brief' in lead or 'the power brief' in headline:
        return 'The Power Brief'
    if 'governance' in tags:
        return 'Governance'
    if 'business' in tags:
        return 'Business'
    if lead.startswith(('governance |', 'governance:')):
        return 'Governance'
    if lead.startswith(('business |', 'business:')):
        return 'Business'
    # Conservative topic backfill for RSS items without section tags.
    if any(term in headline for term in (
        'supreme court', 'corporate courts', 'tribunal', 'nclt', 'cabinet',
        'parliament', 'ministry', 'rail-project', 'public disclosure',
        'electoral', 'governance'
    )):
        return 'Governance'
    if any(term in headline for term in (
        'tata', 'boardroom', 'rupee', 'shares', 'market', 'rbi',
        'company', 'corporate ownership', 'financial', 'industry', 'economy'
    )):
        return 'Business'
    return 'Reporting'


def parse_feed(source):
    # XML itself is parsed without resolving remote entities.
    root = ET.fromstring(source)
    entries = []
    seen = set()
    for item in root.findall('.//channel/item'):
        title = re.sub(r'\s+', ' ', item.findtext('title', '')).strip()
        link = (item.findtext('link', '') or '').strip().split('?')[0].rstrip('/')
        if not title or not is_valid_link(link) or link in seen:
            continue
        seen.add(link)
        raw_description = item.findtext('description', '') or ''
        description, embedded_image = text_from_markup(raw_description)
        if not description:
            full = item.findtext('{http://purl.org/rss/1.0/modules/content/}encoded', '')
            description, embedded_image = text_from_markup(full)
        if len(description) > 245:
            description = description[:242].rsplit(' ', 1)[0].rstrip(' .,:;') + '…'
        date_raw = item.findtext('pubDate', '') or ''
        try:
            date = parsedate_to_datetime(date_raw)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError, IndexError):
            date = datetime(1970, 1, 1, tzinfo=timezone.utc)
        image = ''
        enclosure = item.find('enclosure')
        if enclosure is not None and (enclosure.get('type') or '').startswith('image/'):
            image = enclosure.get('url', '')
        if not image:
            media = item.find('{%s}content' % MEDIA_NS)
            if media is not None and (media.get('medium') == 'image' or (media.get('type') or '').startswith('image/')):
                image = media.get('url', '')
        image = image or embedded_image
        if not is_valid_image(image):
            image = ''
        categories = [(node.text or '').strip() for node in item.findall('category')]
        entries.append({
            'title': title, 'url': link, 'description': description,
            'category': classify(title, description, categories),
            'date': date.strftime('%-d %B %Y'), 'date_iso': date.date().isoformat(),
            'sort': date.isoformat(), 'image': image,
        })
    entries.sort(key=lambda x: x['sort'], reverse=True)
    if not entries:
        raise ValueError('No valid, public Substack articles in RSS feed; refusing to publish empty archive')
    for item in entries:
        del item['sort']
    return entries[:50]

def escape(value):
    return html.escape(str(value or ''), quote=True)

def card(post, idx):
    title, url, excerpt = escape(post['title']), escape(post['url']), escape(post['description'])
    date, category = escape(post['date']), escape(post['category'])
    if post['image']:
        artwork = f'<img src="{escape(post["image"])}" loading="lazy" alt="" referrerpolicy="no-referrer">'
    else:
        artwork = '<div class="article-art" aria-hidden="true"></div>'
    return f'''<article class="article-row" data-title="{title.lower()}" data-summary="{excerpt.lower()}" data-category="{category}" data-date="{escape(post['date_iso'])}">
      <div class="article-main"><div class="article-overline"><span class="article-category">{category}</span><span class="over-dot"></span><time datetime="{escape(post['date_iso'])}">{date}</time></div>
      <h3><a href="{url}" target="_blank" rel="noopener noreferrer">{title}</a></h3>
      <p>{excerpt}</p><div class="story-actions"><a class="article-arrow" href="{url}" target="_blank" rel="noopener noreferrer">Read dispatch</a><button class="story-save" type="button" data-save-story="{url}" hidden>Save</button></div></div>
      <a class="article-media" href="{url}" aria-label="Read {title} on Substack" target="_blank" rel="noopener noreferrer">{artwork}</a>
    </article>'''

def featured(post):
    artwork = (f'<img src="{escape(post["image"])}" loading="eager" alt="" referrerpolicy="no-referrer">' if post['image'] else '<div class="hero-art" aria-hidden="true"></div>')
    return f'''<article class="lead-story"><div class="lead-content">
      <div class="lead-stamp"><time datetime="{escape(post['date_iso'])}">{escape(post['date'])}</time></div>
      <div class="lead-category">{escape(post['category'])}</div>
      <h2><a href="{escape(post['url'])}" target="_blank" rel="noopener noreferrer">{escape(post['title'])}</a></h2>
      <p class="lead-description">{escape(post['description'])}</p>
      <div class="lead-actions"><a class="lead-read" href="{escape(post['url'])}" target="_blank" rel="noopener noreferrer">Read article</a><button class="story-save" type="button" data-save-story="{escape(post['url'])}" hidden>Save</button></div>
      </div><a class="lead-visual" href="{escape(post['url'])}" target="_blank" rel="noopener noreferrer" aria-label="Read the lead dispatch">{artwork}</a>
    </article>'''

def side_story(post, idx):
    return f'''<article class="rail-story"><div class="rail-meta"><span>{escape(post['category'])}</span><time class="rail-date" datetime="{escape(post['date_iso'])}">{escape(post['date'])}</time></div>
      <h3><a href="{escape(post['url'])}" target="_blank" rel="noopener noreferrer">{escape(post['title'])}</a></h3><p>{escape(post['description'])}</p></article>'''

def attach_publication_shell(html, site_url):
    """Build one shared responsive menu and editorial footer on every route."""
    url = site_url.rstrip('/') + '/'
    menu = (BASE/'site'/'_mobile-nav.html').read_text(encoding='utf-8').replace('<!--SITE_URL-->', escape(url))
    footer = (BASE/'site'/'_publication-footer.html').read_text(encoding='utf-8').replace('<!--SITE_URL-->', escape(url)).replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    html, count = re.subn(r'(<header\b[^>]*>)', lambda match: match.group(1)+'\n'+menu.split('<!-- After the header, the fullscreen menu becomes its own focusable landmark. -->')[0], html, count=1)
    if count != 1:
        raise ValueError('Shared mobile header needs one document header')
    overlay = menu.split('<!-- After the header, the fullscreen menu becomes its own focusable landmark. -->',1)[1]
    html = html.replace('</header>', '</header>\n'+overlay, 1)
    html, count = re.subn(r'<footer\b[^>]*>[\s\S]*?</footer>', lambda _: footer, html, count=1)
    if count != 1:
        raise ValueError('Shared editorial footer needs one document footer')
    html = html.replace('</head>', '<link rel="stylesheet" href="mobile-shell.css">\n<script defer src="mobile-nav.js"></script>\n</head>', 1)
    return html

def render_site(posts, destination, site_url=DEFAULT_URL):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    mobile_nav=(BASE/'site'/'mobile-nav.html').read_text(encoding='utf-8')
    editorial_footer=(BASE/'site'/'editorial-footer.html').read_text(encoding='utf-8')
    def chrome(html):
        return html.replace('<!--MOBILE_NAV-->',mobile_nav).replace('<!--EDITORIAL_FOOTER-->',editorial_footer)
    source = chrome((BASE/'site'/'index.html').read_text(encoding='utf-8'))
    page = source.replace('<!--FEATURED-->', featured(posts[0]))
    page = page.replace('<!--SIDE_STORIES-->', '\n'.join(side_story(p, i) for i,p in enumerate(posts[1:3],1)))
    page = page.replace('<!--ARTICLES-->', '\n'.join(card(p, i) for i,p in enumerate(posts,0)))
    page = page.replace('<!--COUNT-->', str(len(posts)))
    page = page.replace('<!--UPDATED-->', escape(datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')))
    page = page.replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    site_url=site_url.rstrip('/')+'/'
    page = page.replace('<!--SITE_URL-->', escape(site_url))
    page = attach_publication_shell(page, site_url)
    (destination/'index.html').write_text(page, encoding='utf-8')
    for fname in ('styles.css','market.css','editorial.css','mobile-shell.css','mobile-nav.js','site.js','mobile-nav.js','reader.js','market-desk.js','favicon.svg','brand-masthead.png','brand-elephant.png'):
        shutil.copy2(BASE/'site'/fname,destination/fname)
    # The chart primitive is copied but not loaded by the homepage.
    chart_dir = BASE/'site'/'components'
    if chart_dir.is_dir():
        shutil.copytree(chart_dir, destination/'components', dirs_exist_ok=True)
    guide = chrome((BASE/'site'/'publication-guide.html').read_text(encoding='utf-8'))
    guide = guide.replace('<!--SITE_URL-->', escape(site_url)).replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    guide = attach_publication_shell(guide, site_url)
    (destination/'publication-guide.html').write_text(guide, encoding='utf-8')
    about = chrome((BASE/'site'/'about.html').read_text(encoding='utf-8'))
    about = about.replace('<!--SITE_URL-->', escape(site_url)).replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    about = attach_publication_shell(about, site_url)
    (destination/'about.html').write_text(about, encoding='utf-8')
    observatory = chrome((BASE/'site'/'observatory.html').read_text(encoding='utf-8'))
    observatory = observatory.replace('<!--SITE_URL-->', escape(site_url)).replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    observatory = attach_publication_shell(observatory, site_url)
    (destination/'observatory.html').write_text(observatory, encoding='utf-8')
    market = chrome((BASE/'site'/'markets.html').read_text(encoding='utf-8'))
    market = market.replace('<!--SITE_URL-->', escape(site_url)).replace('<!--YEAR-->', str(datetime.now(timezone.utc).year))
    market = attach_publication_shell(market, site_url)
    (destination/'markets.html').write_text(market, encoding='utf-8')
    (destination/'posts.json').write_text(json.dumps({'source':FEED_URL,'articles':posts},ensure_ascii=False,indent=2),encoding='utf-8')
    (destination/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+site_url+'sitemap.xml\n',encoding='utf-8')
    (destination/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+escape(site_url)+'</loc></url><url><loc>'+escape(site_url)+'publication-guide.html</loc></url><url><loc>'+escape(site_url)+'about.html</loc></url><url><loc>'+escape(site_url)+'observatory.html</loc></url><url><loc>'+escape(site_url)+'markets.html</loc></url></urlset>',encoding='utf-8')
    (destination/'.nojekyll').write_text('',encoding='utf-8')

def download_feed():
    """Read public RSS; a proxy is an optional fallback for cloud-IP 403s.

    The proxy only receives a public feed URL. No user cookies or tokens are sent.
    """
    sources = [FEED_URL, 'https://proxy.cors.dev/' + FEED_URL,
               'https://corsproxy.io/?url='+quote(FEED_URL, safe=''),
               'https://api.allorigins.win/raw?url='+quote(FEED_URL, safe=''),
               'https://api.codetabs.com/v1/proxy?quest='+quote(FEED_URL, safe='')]
    errors = []
    for source in sources:
        req = Request(source, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; RaisinaPostRSS/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
        })
        try:
            with urlopen(req, timeout=30) as response:
                contents = response.read(8_000_000).decode('utf-8-sig')
            if ET.fromstring(contents).find('.//channel/item') is None:
                raise ValueError('Response did not contain RSS items')
            return contents
        except (HTTPError, URLError, IncompleteRead, OSError, ValueError, ET.ParseError, UnicodeDecodeError) as exc:
            errors.append('%s: %s' % (source, exc))
    fallback=BASE/'site'/'feed-backup.xml'
    if fallback.exists():
        print('WARNING: Using dated fallback RSS metadata; live feed temporarily unavailable.')
        return fallback.read_text(encoding='utf-8')
    raise RuntimeError('RSS download failed: ' + '; '.join(errors))

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--feed-file',type=Path,help='Use local XML instead of downloading RSS')
    p.add_argument('--output',type=Path,default=BASE/'dist')
    p.add_argument('--site-url',default=os.getenv('RAISINA_SITE_URL',DEFAULT_URL))
    args=p.parse_args()
    if args.feed_file:
        xml=args.feed_file.read_text(encoding='utf-8')
    else:
        xml=download_feed()
    posts=parse_feed(xml)
    render_site(posts,args.output,args.site_url)
    print(f'Built {len(posts)} RSS articles into {args.output}')

if __name__=='__main__':
    main()
