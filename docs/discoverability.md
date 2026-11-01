# Search and AI discovery

The Python build adds discovery metadata to every published HTML page through
`scripts/discovery.py`. No client-side script is needed to read it.

## What is generated

- One canonical URL, description, Open Graph and Twitter preview per page.
- Index/follow and generous snippet/image-preview permissions.
- A connected Schema.org graph for the publication, website and page. About
  and contact pages use their specific page types; the homepage lists recent
  editions at their original Substack URLs. Research pages are WebPages, not
  invented news articles, financial products or third-party datasets.
- Publication ethics, corrections and affiliation disclosure links in the
  publisher entity. No invented address, awards, staff or verified status.
- A sitemap derived from the actual output HTML, RSS discovery on every page,
  and a public sitemap link in the footer.
- `llms.txt`, `llms-full.txt` and `site-index.json`. The text export contains
  the static main content only; it does not execute interactive tools or
  reproduce full Substack editions. These are convenience resources for
  consumers that choose to use them, not a Google ranking requirement.
- Public questions and answers in the publication guide. No FAQ rich-result
  eligibility or AI citation is claimed.

Page titles and descriptions live in `site/*.html`. Update those templates,
not generated output. JSON-LD follows visible content. Article excerpts link
to the canonical Substack editions; the site does not claim to host full news
articles or fabricate author/date metadata. The sitemap omits `lastmod` because
an hourly rebuild is not an editorial modification.

## GitHub Pages host-root limitation

Current URL: `https://theraisinapost.github.io/theraisinapost/`.
The build outputs `/theraisinapost/robots.txt`. Crawlers instead consult
`https://theraisinapost.github.io/robots.txt`. A robots file in a project
directory cannot override host-root rules. Copy the generated robots file to
the host-root site's deployment, or deploy this project on its own domain.
The repository connection did not expose an existing host-root site to edit.
The existing wildcard allow policy is preserved; search access and AI training
controls are separate choices. No training preference has been changed.

On a custom domain, set `RAISINA_SITE_URL` to its absolute HTTPS base URL. The
build regenerates canonicals, schema IDs, sitemap locations and text resources
for that base. Only change this when the domain is actually serving the site.

## Search engine verification

After ownership verification in Google Search Console and Bing Webmaster
Tools, submit the site's `sitemap.xml` and inspect the homepage, About and a
research page. Verification and submission are account actions; this build
does not claim they have been completed. Watch indexed pages, impressions,
clicks and canonical selections. Check rich-result eligibility separately
with Google's Rich Results Test; valid schema does not guarantee a rich result.

## Validation

`python -m unittest discover -s tests -v` checks all rendered pages, unique
metadata, canonical/schema alignment, sitemap completeness, custom-domain
output and escaping of untrusted RSS titles in JSON-LD. Existing CI also runs
mobile/keyboard tests, axe accessibility audits and Lighthouse SEO reports.

## Primary references

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- https://developers.openai.com/api/docs/bots
- https://schema.org/NewsMediaOrganization
- https://schema.org/CollectionPage
