"""Build-time search metadata and public discovery documents.

References:
https://developers.google.com/search/docs/appearance/ai-features
https://developers.google.com/search/docs/appearance/structured-data/organization
https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
https://schema.org/NewsMediaOrganization

Only describe content published here; full article URLs remain on Substack.
"""
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

NAME = 'The Raisina Post'
PUBLICATION = 'https://raisinapost.substack.com/'
FEED = PUBLICATION + 'feed'
DESCRIPTION = 'Briefings and analysis on Indian policy, business and the economy.'
PREVIEW = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ''
        self.description = ''
        self.in_title = False
        self.in_main = False
        self.skip = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and attrs.get('name') == 'description':
            self.description = attrs.get('content', '')
        if tag == 'main':
            self.in_main = True
        if tag in ('script', 'style'):
            self.skip += 1
        if self.in_main and tag in ('p', 'h1', 'h2', 'h3', 'li', 'section', 'article', 'tr'):
            self.text.append('\n\n')
        if self.in_main and tag in ('td', 'th'):
            self.text.append(' | ')

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag == 'main':
            self.in_main = False
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_main and not self.skip:
            self.text.append(data)

    def readable(self):
        text = ''.join(self.text)
        return re.sub(r'\n\s*\n+', '\n\n', re.sub(r'[^\S\n]+', ' ', text)).strip()


def script_json(value):
    # RSS titles can contain HTML/script delimiters. Keep JSON inert in HTML.
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')


def metadata(source, filename, site_url, posts):
    page = Page()
    page.feed(source)
    if not page.title.strip() or not page.description.strip():
        raise ValueError(f'Missing title or description: {filename}')
    url = site_url + ('' if filename == 'index.html' else filename.removesuffix('.html') + '/')
    org_id, web_id, page_id = site_url + '#publisher', site_url + '#website', url + '#webpage'
    publisher = {
        '@type': 'NewsMediaOrganization', '@id': org_id, 'name': NAME,
        'url': site_url, 'description': DESCRIPTION,
        'logo': {'@type': 'ImageObject', 'url': site_url + 'brand-masthead.png', 'width': 1250, 'height': 234},
        'sameAs': [PUBLICATION], 'email': 'raisinapost@substack.com',
        'ethicsPolicy': site_url + 'editorial-policy/',
        'correctionsPolicy': site_url + 'corrections/',
        'publishingPrinciples': site_url + 'editorial-policy/',
        'ownershipFundingInfo': site_url + 'about/#independence-title',
    }
    kind = {'index.html': 'CollectionPage', 'about.html': 'AboutPage', 'corrections.html': 'ContactPage'}.get(filename, 'WebPage')
    node = {'@type': kind, '@id': page_id, 'url': url, 'name': page.title.strip(),
            'description': page.description, 'inLanguage': 'en-IN',
            'isPartOf': {'@id': web_id}, 'publisher': {'@id': org_id}}
    graph = [publisher, {'@type': 'WebSite', '@id': web_id, 'url': site_url,
                       'name': NAME, 'publisher': {'@id': org_id}, 'inLanguage': 'en-IN'}, node]
    if filename == 'about.html':
        node['mainEntity'] = {'@id': org_id}
    if filename == 'index.html':
        list_id = url + '#recent-editions'
        node['mainEntity'] = {'@id': list_id}
        graph.append({'@type': 'ItemList', '@id': list_id, 'name': 'Recent editions',
                      'numberOfItems': len(posts), 'itemListElement': [
                          {'@type': 'ListItem', 'position': i, 'url': post['url'], 'name': post['title']}
                          for i, post in enumerate(posts, 1)]})
    else:
        crumb_id = url + '#breadcrumb'
        node['breadcrumb'] = {'@id': crumb_id}
        graph.append({'@type': 'BreadcrumbList', '@id': crumb_id, 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Front page', 'item': site_url},
            {'@type': 'ListItem', 'position': 2, 'name': page.title.split(' — ')[0], 'item': url}]})
    # Replace the existing partial social fields, rather than emit duplicates.
    source = re.sub(r'<meta\b[^>]*\b(?:property|name)=["\'](?:og:[^"\']+|twitter:[^"\']+|robots)["\'][^>]*>', '', source, flags=re.I)
    source = re.sub(r'<link\b[^>]*\brel=["\']canonical["\'][^>]*>', '', source, flags=re.I)
    tags = [f'<link rel="canonical" href="{html.escape(url, quote=True)}">',
            f'<meta name="robots" content="{PREVIEW}">']
    values = {'og:type': 'website', 'og:site_name': NAME, 'og:locale': 'en_IN',
              'og:title': page.title.strip(), 'og:description': page.description, 'og:url': url,
              'og:image': site_url + 'brand-masthead.png', 'og:image:width': '1250',
              'og:image:height': '234', 'og:image:alt': NAME,
              'twitter:card': 'summary', 'twitter:title': page.title.strip(),
              'twitter:description': page.description, 'twitter:image': site_url + 'brand-elephant.png',
              'twitter:image:alt': 'The Raisina Post elephant emblem'}
    for name, value in values.items():
        key = 'property' if name.startswith('og:') else 'name'
        tags.append(f'<meta {key}="{name}" content="{html.escape(value, quote=True)}">')
    if 'application/rss+xml' not in source:
        tags.append(f'<link rel="alternate" type="application/rss+xml" title="The Raisina Post RSS" href="{FEED}">')
    tags.extend([f'<link rel="sitemap" type="application/xml" href="{html.escape(site_url, quote=True)}sitemap.xml">',
                 f'<link rel="describedby" type="text/plain" title="Publication text index" href="{html.escape(site_url, quote=True)}llms.txt">',
                 '<script type="application/ld+json">' + script_json({'@context': 'https://schema.org', '@graph': graph}) + '</script>'])
    source = source.replace('</head>', '\n' + '\n'.join(tags) + '\n</head>', 1)
    return source, {'url': url, 'title': page.title.strip(), 'description': page.description}, page.readable()


def publish_discovery(destination, site_url, posts):
    """Derive the sitemap and metadata from the HTML actually built."""
    parsed = urlsplit(site_url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError('Public site URL must be an absolute HTTPS URL without credentials, query or fragment')
    destination = Path(destination)
    pages, texts = [], []
    for path in sorted(destination.glob('*.html')):
        source, record, text = metadata(path.read_text(encoding='utf-8'), path.name, site_url, posts)
        path.write_text(source, encoding='utf-8')
        pages.append(record)
        texts.append(f'## {record["title"]}\n\nCanonical URL: {record["url"]}\n\n{text}')
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    sitemap = ET.Element('{' + namespace + '}urlset')
    for record in pages:
        node = ET.SubElement(sitemap, '{' + namespace + '}url')
        ET.SubElement(node, '{' + namespace + '}loc').text = record['url']
    # Omit lastmod rather than misrepresent an hourly rebuild as an editorial update.
    ET.ElementTree(sitemap).write(destination / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    robots = ('# Publish at the host root /robots.txt; a project subdirectory does not control crawlers.\n'
              'User-agent: *\nAllow: /\n\nSitemap: ' + site_url + 'sitemap.xml\n')
    (destination / 'robots.txt').write_text(robots, encoding='utf-8')
    directory = '\n'.join(f'- [{p["title"]}]({p["url"]}): {p["description"]}' for p in pages)
    summary = (f'# {NAME}\n\n> {DESCRIPTION}\n\n'
               f'Website: {site_url}\nPrimary publication and full editions: {PUBLICATION}\n'
               f'RSS: {FEED}\n\nThis website contains article excerpts and public research tools. '
               'Full articles remain at their original Substack URLs. Research observations retain '
               'their reference periods and source limitations; they are not all live market data.\n\n'
               '## Publication and research pages\n\n' + directory + '\n\n## Machine-readable resources\n\n'
               f'- [Content directory]({site_url}site-index.json)\n'
               f'- [Recent edition metadata]({site_url}posts.json)\n'
               f'- [Static page text]({site_url}llms-full.txt)\n'
               f'- [Sitemap]({site_url}sitemap.xml)\n')
    (destination / 'llms.txt').write_text(summary, encoding='utf-8')
    (destination / 'llms-full.txt').write_text(summary + '\n## Static page content\n\n'
        'Text extracted from published HTML. Interactive results require the page application and its linked sources. '
        'This export does not contain full Substack articles.\n\n' + '\n\n'.join(texts), encoding='utf-8')
    (destination / 'site-index.json').write_text(json.dumps({
        'name': NAME, 'url': site_url, 'description': DESCRIPTION, 'publication': PUBLICATION,
        'feed': FEED, 'pages': pages, 'articles': posts,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
