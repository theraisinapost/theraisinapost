# The Raisina Post

> **Power. Policy. Perspective.** An independent editorial index for [The Raisina Post](https://raisinapost.substack.com/).

A purpose-built, minimalist GitHub Pages site for **[@theraisinapost](https://github.com/theraisinapost)**. It reads the public Substack RSS feed and publishes a typographic editorial homepage, front-page lead, secondary dispatches, searchable archive, categories and a newsletter call-to-action. The canonical articles and subscriptions remain on Substack.

**Repository:** `theraisinapost/theraisinapost`  
**Expected GitHub Pages URL:** `https://theraisinapost.github.io/theraisinapost/`  
**Feed:** `https://raisinapost.substack.com/feed`  
**Publishing cadence:** hourly GitHub Actions, subject to scheduler and feed availability.

## Deployment

1. Upload the **contents** of this folder to the *root* of the `theraisinapost/theraisinapost` repository, including the `.github/` workflow directory. Do not upload only the ZIP file.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The `GITHUB_TOKEN` on its own cannot activate an unconfigured Pages site.
3. In **Actions**, open **The Raisina Post | RSS to GitHub Pages** and select **Run workflow**, branch `main`.
4. Wait for the build and deployment jobs to succeed, then visit `https://theraisinapost.github.io/theraisinapost/`.

The website automatically updates on pushes to the source files, on manual dispatch, and via a scheduled check at 23 minutes past every hour. GitHub-hosted scheduled workflows can be delayed; feed failures stop a deployment instead of wiping a working site. If direct Substack RSS is blocked from a GitHub runner, the build tries a public RSS proxy. Only a public URL is sent, never credentials.

### Custom domain (later)

For a domain such as `archive.example.com`:

- In DNS, add a **CNAME** record for `archive` pointing to `theraisinapost.github.io`.
- In repository **Settings → Pages**, enter `archive.example.com` under **Custom domain** and wait for verification and TLS.
- In **Settings → Secrets and variables → Actions → Variables**, add `RAISINA_SITE_URL` as `https://archive.example.com/`.
- Rerun the deployment; do not change Substack, email or other unrelated DNS records.

The site's canonical URL, Open Graph URL, robots.txt and sitemap are generated from this variable. GitHub Pages stores the domain mapping in its settings; a CNAME file alone does not configure it for an Actions deployment.

## Local development

Requires Python 3.10+; runtime is standard library only.

```bash
python -m unittest discover -s tests -v
python scripts/build.py --output dist
python -m http.server 8080 --directory dist
```

Test without network: `python scripts/build.py --feed-file sample-rss.xml --output dist`.

### Directory structure

```text
.github/workflows/raisina-post-pages.yml  RSS refresh, tests and GitHub Pages deploy
scripts/build.py                       Secure RSS parser and HTML renderer
site/index.html                        Semantic editorial page template
site/styles.css                        Responsive, bespoke layout
site/site.js                           Client-side filtering and search
site/favicon.svg                       R. monogram mark
tests/test_build.py                    Feed parsing and HTML generation tests
```

## Editorial policy

The index contains only the headlines, limited summaries, dates and media exposed in the public RSS feed, with prominent links to the originals. It does not republish complete paid articles, bypass newsletter access, or pretend GitHub is the canonical publisher. Articles absent from Substack's current RSS feed will not appear in this *recent-dispatch* archive. Reader subscription and all editorial control stay with Substack.

## White editorial redesign (October 2026)

The public site uses a plain white, accessible editorial system with mobile navigation, a prominent search bar (press `/` to focus, `Escape` to clear), category filters, and a new **Publication guide** page. Search covers the articles currently returned by the public Substack RSS feed, including the latest/featured article; it does **not** search Substack's full historical archive.

The header reserves logo and sub-logo positions. Until approved identity files are supplied, text-based wordmark and strapline stay in place. Replace those text elements in `site/index.html` after receiving the official assets; do not introduce unapproved logos.

The top corner displays a full analog clock plus a digital India Standard Time reading and a live date. The New Delhi weather line uses Open-Meteo's current conditions API with a local fallback of “Weather unavailable.” Check their licensing and usage terms if deploying for commercial or high-volume use. There are no tracking cookies and no weather API keys. The footer credits the weather data source.

`site/publication-guide.html` contains the reader guide. Its practical editorial wording is a public-facing draft, not a legal privacy policy or contractual guarantee. Contact links point to the publication's real Substack contact/about page; no email addresses have been invented.

Inspired by accessible search/command patterns in [shadcn/ui](https://github.com/shadcn-ui/ui), and understated editorial hierarchy. The implementation is original vanilla HTML/CSS/JS and does not vendor framework code.


## Website quality and optional data charts

The publication's visible site remains a lightweight Python-built GitHub Pages archive. Separate from hourly RSS publication, `.github/workflows/site-quality.yml` runs a repeatable **offline RSS build**, real Chromium interaction checks with Playwright, WCAG A/AA audits using axe-core, and Lighthouse audits on the front page, About and Publication Guide. The quality workflow runs on code changes (not hourly RSS polls); the publishing workflow remains independent.

### Run the quality tests locally

```bash
python -m unittest discover -s tests -v
python scripts/build.py --feed-file site/feed-backup.xml --output dist --site-url https://theraisinapost.github.io/theraisinapost/
npm install --no-package-lock
npx playwright install chromium
npm run check:js
npm run test:e2e
npm run audit:lighthouse
```

Lighthouse reports are exported as artifacts by GitHub Actions; Lighthouse category thresholds initially warn instead of blocking production. Playwright tests fail on functionality regression or serious/critical accessibility problems.

### Optional Observatory-style charts

`site/components/editorial-chart.mjs` exports `renderEditorialChart({ container, rows, xKey, yKey, title, sourceName, sourceUrl, type, unit, description })`. The module lazy-loads Observable Plot v0.6.17 only on a page where an editor calls it with **verified numeric rows** and an **HTTPS source citation**. No graphs or invented statistics are shown by default. The homepage does not load this chart dependency.

To publish a chart in a story, prepare a verified dataset, retain the original source URL, create a separate editorial HTML page and import the module explicitly. Source labels and figures need human checks before release.

Original open-source projects: [Playwright](https://github.com/microsoft/playwright), [axe-core](https://github.com/dequelabs/axe-core), [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci), [Observable Plot](https://github.com/observablehq/plot). Licence terms and third-party service availability remain applicable.

## The Observatory

`site/observatory.html` is a private-by-default exploration desk on top of the **same public Substack RSS index** as the homepage. It shows a rolling two-week publication-activity chart, an actual category breakdown, search and filters, and an optional reading queue stored only in the browser's localStorage. It is not full-text search, a newsroom analytics platform, or a claim about how much news happened on a given day.

The small homepage action and keyboard shortcut **⌘K / Ctrl+K** open a native dialog that searches indexed article titles and relevant pages. Bookmarks are intentionally not sent to a server or synchronized across browsers. No new frontend framework, tracking SDK, or production database is used.
