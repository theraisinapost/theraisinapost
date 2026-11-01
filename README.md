# The Raisina Post

> **Power. Policy. Perspective.** An independent editorial index for [The Raisina Post](https://raisinapost.substack.com/).

A purpose-built, minimalist GitHub Pages site for **[@theraisinapost](https://github.com/theraisinapost)**. It reads the public Substack RSS feed and publishes a typographic editorial homepage, front-page lead, secondary dispatches, searchable archive, categories and a newsletter call-to-action. The canonical articles and subscriptions remain on Substack.

**Repository:** `theraisinapost/theraisinapost.github.io`  
**Expected GitHub Pages URL:** `https://theraisinapost.github.io/`  
**Feed:** `https://raisinapost.substack.com/feed`  
**Publishing cadence:** hourly GitHub Actions, subject to scheduler and feed availability.

## Deployment

1. Upload the **contents** of this folder to the *root* of the `theraisinapost/theraisinapost.github.io` repository, including the `.github/` workflow directory. Do not upload only the ZIP file.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The `GITHUB_TOKEN` on its own cannot activate an unconfigured Pages site.
3. In **Actions**, open **The Raisina Post | RSS to GitHub Pages** and select **Run workflow**, branch `main`.
4. Wait for the build and deployment jobs to succeed, then visit `https://theraisinapost.github.io/`.

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
python scripts/build.py --feed-file site/feed-backup.xml --output dist --site-url https://theraisinapost.github.io/
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

`site/observatory.html` is a private-by-default exploration desk on top of the **same public Substack RSS index** as the homepage. It shows a rolling two-week publication-activity chart, an actual category breakdown, search and filters, and direct links to the original articles without extra reading, saving or sharing controls. It is not full-text search, a newsroom analytics platform, or a claim about how much news happened on a given day.

The small homepage action and keyboard shortcut **⌘K / Ctrl+K** open a native dialog that searches indexed article titles and relevant pages. Bookmarks are intentionally not sent to a server or synchronized across browsers. No new frontend framework, tracking SDK, or production database is used.

## Market desk

The site has a compact homepage market strip and a standalone `markets.html` page. Market quotes are embedded from **TradingView's official, attributed widgets** (Nifty 50, Sensex, USD/INR, gold, WTI and S&P 500). TradingView is a quote provider, **not an open-source price API**. Quotes may be delayed or unavailable; their exchange status must not be inferred from the browser's clock.

The India economic panel retrieves **annual World Bank observations** directly from the public Indicators API, requiring no API key:
- `NY.GDP.MKTP.KD.ZG` — real GDP growth, annual percent.
- `FP.CPI.TOTL.ZG` — consumer price inflation, annual percent.
- `NE.EXP.GNFS.ZS` — exports of goods and services, percent of GDP.

Every visible number displays the **reference year**. Selecting an indicator opens its source-linked historical chart, built with the existing [Observable Plot](https://github.com/observablehq/plot) open-source library. Fetch/chart failures show explicit unavailable states; no demonstration values are published. Tests use synthetic data only inside mocks, never in the deployed pages.

**Source terms:** [TradingView market widgets](https://www.tradingview.com/widget-docs/faq/data/) may be delayed and must retain attribution; [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392) exposes published annual observations, which can be revised. This desk is for editorial context, not execution-grade quotes or investment advice.

## Source-backed research desk

Two editorial research pages are published with the same logo, mobile menu and footer as the rest of the website:

- `ownership-atlas.html` shows **selected named shareholders of TCS**, as at 31 March 2026, using data in `site/data/ownership-tcs.json`. Each row and graph connection is based on the [TCS FY2026 annual report](https://www.tcs.com/content/dam/tcs/investor-relations/financial-statements/2025-26/ar/annual-report-2025-2026.pdf), Corporate Governance Report p.125. This is **not** who owns Tata Sons or the Tata Group, not a complete ownership register, and not live data. [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) v3.33.1 (MIT) enhances the graph when available; the dated text records remain available without it.
- `policy-timeline.html` presents **DPDP Act/Rules statutory milestones**, including future commencement dates scheduled in the [13 November 2025 Gazette notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf). All events are backed by MeitY original documents in `site/data/dpdp-timeline.json`. Future dates are labelled **scheduled**, not enacted; later law changes require editorial review. [vis-timeline](https://github.com/visjs/vis-timeline) v8.5.6 (MIT/Apache-2.0) loads on this page only; the accessible chronology works without it.

Article headlines and images link directly to their original Substack editions. No extra per-article action buttons or third-party share dialog are loaded.

### Opt-in GoatCounter

The published site does **not** load any GoatCounter tracker by default, because no account is connected. To enable it, register a real account at [GoatCounter](https://www.goatcounter.com/help/start) and set the GitHub Actions repository variable `GOATCOUNTER_CODE` to **only the assigned subdomain name** (without `.goatcounter.com`). The publishing workflow passes this code to `scripts/build.py` and includes `https://gc.zgo.at/count.js` only when it validates as a nonempty, safe account code. Rerun the Pages workflow after setting the variable. Do not set a made-up code. Review the publication privacy policy before activation.

The homepage itself does **not** load Cytoscape or vis-timeline; it only links to the separate research pages. The graphics require third-party CDNs and have readable fallback content when unavailable.

## Commodity & macro monitor (October 2026)

The existing `markets.html` page includes an automated precious-metals desk, an attributed crude-and-yields watchlist, daily FX reference rates and a reader-triggered economic calendar.

- **Gold**: [XAUS](https://github.com/misix-git/xaus-api) `/api/v1/spot?currency=INR&unit=gram&compact=1` returns indicative INR per gram; the site multiplies by **10** to display the spot equivalent of 10g. It is not Indian retail/jeweller/MCX pricing and does not include local duties, premiums, making charges or GST. The interface reads `data_state` and `as_of`/`updated_at` to label stale observations rather than implying a live quote.
- **Silver**: same XAUS response, converting `silver_usd_oz * fx_rate * (1000 / 31.1034768)` into indicative INR/kg. This calculation is *only* displayed if both silver and FX are numeric and positive. The FX rate in that calculation comes from XAUS, not from the separate Frankfurter reference feed.
- **Gold/silver ratio**: displays only the source's numeric `gold_silver_ratio`, without an invented value.
- **Crude & yields**: [TradingView Market Data](https://www.tradingview.com/widget-docs/widgets/watchlists/market-data/) uses verified symbols `TVC:UKOIL`, `TVC:USOIL`, `TVC:IN10Y` and `TVC:US10Y`. These are indicative CFDs and benchmark yields; exchange availability, licensing and quote delays are TradingView's responsibility.
- **Daily FX**: [Frankfurter](https://frankfurter.dev/) v2 returns reference rates for USD, EUR and GBP relative to INR. The response's published date is displayed; it is **not** a live exchange-rate feed.
- **Economic calendar**: [TradingView's calendar widget](https://www.tradingview.com/widget-docs/widgets/calendars/economic-calendar/) is injected only when a reader presses **Show economic events**. It covers India, the US, euro area, China and the UK; times, significance and schedule may be revised.

This is frontend-only and runs on GitHub Pages with no new hosting, secrets, credentials or cron tasks. The source response is refreshed periodically while the Market Desk is in the foreground. Network failure keeps values at **—** rather than substituting invented prices. External embed scripts may be blocked by a visitor's browser or the vendor, and clear source links remain available.

## Quiet monochrome redesign (October 2026)

All seven pages share a single **Inter** font via Google Fonts with a system fallback. The builder appends `site/minimal.css` after the legacy styles so its design tokens consistently win: white canvas, `#171717` primary ink, `#434343` secondary ink, `#595959` muted text, **`#f9f9f9` surfaces and 8px card corners**. Headings use a calmer size/weight hierarchy, buttons are black, visual separators are minimal and the mobile navigation is more compact. Bento treatment is reserved for data summaries, contextual links, newsletter and research tools. News story lists remain editorial and unboxed. The original RSS, analytics opt-in, charts, commodities, navigation and source citations are unchanged.

Modify the final design layer `site/minimal.css` rather than introducing one-off styles across templates. Existing source file names and HTML anchors remain stable.


## Research desk expansion (October 2026)

Four separate research tools are built as static pages and linked from the homepage, footer and command palette. They use the existing Inter, white, #f9f9f9 and 8px component system.

- **Policy monitor** (`policy-monitor.html`): the deployment workflow calls `scripts/regulatory.py` after the site build to fetch official [SEBI RSS](https://www.sebi.gov.in/rss.html) and [PIB English RSS](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=3). SEBI entries require a verifiable date; some PIB RSS items do not supply one and are explicitly displayed as undated. Only official-host links are retained. Titles and excerpts are official metadata, not independent fact-checking or summaries of legal effect. Each source is explicitly marked unavailable if it cannot be fetched; no synthetic alerts are inserted. Offline builds include an empty, labelled placeholder.
- **India in data** (`india-data.html`): six annual World Bank India time series are fetched through its public Indicators API. Selectors cover GDP growth, annual CPI inflation, manufacturing share of GDP, exports share of GDP, net FDI inflows as a GDP share and modelled ILO unemployment. Numbers are displayed with reference years, historical plots and links to the source indicator. These are **annual WDI observations**, not the official monthly national CPI or high-frequency economic releases.
- **Release calendar** (`release-calendar.html`): a manually checked subset of 24 dates in the [official MoSPI 2026–27 advance release calendar, updated 25 May 2026](https://www.mospi.gov.in/uploads/documents/releaseCalender/1779709510470-ADVANCE%20RELEASE%20CALENDAR%202026-27%20Updated%2025.05.2026.pdf). All entries remain labelled **scheduled**, even after the planned date passes. This dataset requires manual revision whenever MoSPI publishes a revised calendar; it is not an unverified date prediction.
- **Document comparison** (`document-diff.html`): line-based comparison entirely in the visitor's browser. Text stays local and is inserted with DOM text nodes rather than HTML. Limit: 350 lines and 120,000 characters per version. It is not a PDF OCR service, proof of authenticity, or a legal reading of the edits.

### Offline verification

Run `python -m unittest discover -s tests -v` and `npm run test:e2e` using the existing documented build process. The separate `tests/test_research_desk.py` checks publishability, source labels and feed URL validation. Browser tests exercise search/filtering, chart rendering, release-label semantics and escaping of pasted content. No live external financial values are hard-coded in tests or production.

### Source and failure policy

- A source refresh records its check time; failed providers are labelled unavailable rather than silently replaced with fabricated data.
- The public PDF calendar is **not automatically scraped**: changes are reviewed against the latest ministry record, then `site/data/release-calendar.json` is updated in a source-linked commit.
- Economic observations may be missing or revised. World Bank API failures keep values blank and link to the original indicator.
- This remains a fully static GitHub Pages site. It does not require a server, authentication, persistent reader storage or a new paid data supplier.


## Institutional editorial pages (October 2026)

- `about.html` is the publication's institutional overview, with coverage, editorial method, verified publication formats, research destinations and independence disclosures. Its presentation stays in Inter with a white canvas, muted type and 8px surfaces.
- `editorial-policy.html` is a readable, source-faithful explanation of the published editorial policy, including verification, corrections, reporting versus analysis, AI-generated illustrations, synthetic audio and conflicts. It links directly to the **authoritative** [Substack policy](https://raisinapost.substack.com/p/editorial-policy), last updated 25 October 2026. If that policy changes, editors should update the local explanation; a GitHub Pages copy must not imply it is authoritative over the live Substack version.
- `corrections.html` gives readers a clear correction checklist and the published editorial address, `raisinapost@substack.com`. This site does not pretend to operate a confidential dropbox or secure intake service. Sensitive records should not be sent through ordinary email.
- `publication-guide.html` remains the practical archive/format/rights guide, cross-linked to the policy and corrections pages.

All three new or revised pages build through `scripts/build.py`; templates are `site/about.html`, `site/editorial-policy.html` and `site/corrections.html`, with design refinements in `site/about.css` and `site/editorial-pages.css`. The homepage, command palette, mobile navigation and footer link to the new pages. Unit and browser tests check mobile overflow, canonical URLs and essential published disclosures. No fictional newsroom headcount, unverified claims of scale or invented response-time guarantees appear.


## Public intelligence suite — Parliament File, Data Room and Evidence Desk (October 2026)

The new pages are linked from the homepage's restrained intelligence strip, mobile navigation, footer and publication search. They share the site's Inter/white/#f9f9f9/8px design and static GitHub Pages infrastructure.

**Parliament File (`parliament-file.html`).** A public index of official parliamentary committee report metadata, limited initially to 16 Lok Sabha-chaired DRSCs and three financial committees; it does **not** claim full Rajya Sabha committee coverage. The standard-library script `scripts/parliament.py` reads the official `sansad.in/api_ls/committee/lsRSAllReports` response, restricts document links to parliamentary domains, limits response sizes and does not invent missing dates. Partial failures may retain prior snapshots, explicitly labelled as such. The adapter takes inspiration from Pranay Kotasthane's MIT-licensed [ParliamentWatch](https://github.com/pranaykotas/parliamentwatch), without bundling its Streamlit server, AI summaries or large PDF downloads. ParliamentWatch is an independent project, not an endorsement.

**Data Room (`data-room.html`).** A three-country (India, China, Bangladesh) annual economic comparison, sourced from the World Bank WDI JSON API. Five indicators can be selected; missing/non-numeric observations are omitted. Readers can download the currently displayed rows as CSV, containing indicator code and source. The browser creates the download locally and the data are never proxied by this website. This is a lightweight native reader utility rather than a full Datasette instance; [Datasette Lite](https://github.com/simonw/datasette-lite) is linked as an optional downstream analysis environment.

**Evidence Desk (`evidence-desk.html`).** A small allowlisted source register of official SEBI, MoSPI and PIB pages. `scripts/source_watch.py` records page-text hashes, update timestamps and retrieval failures. The first valid scan only establishes a baseline. A different future hash creates a **pending, unreviewed page-change cue**. This is NOT a verified legislative/regulatory development; page layout changes and dynamic widgets can trigger it. The scraper is intentionally a minimal independent implementation influenced by [urlwatch](https://github.com/thp/urlwatch), not a bundled copy.

**Automated refresh:** `.github/workflows/intelligence-refresh.yml` is scheduled daily at 03:17 UTC and supports manual dispatch. It runs offline unit tests, collects official parliamentary metadata and checks the page allowlist, then commits only the two updated JSON results. The existing hourly Pages workflow can publish the latest committed snapshot on its next scheduled run; bot-authored pushes do not automatically trigger a new Pages build. The refresh requires normal repository Actions write permission and an available upstream endpoint. If blocked, the public UI shows an unavailable/partial/stale state rather than fabricated data.

No machine-generated report summaries are published. No visitor tracking or paid API service was introduced by these pages. Review any content-change signal and the original primary document before reporting substantive conclusions. Test with `python -m unittest discover -s tests -v`, `npm run check:js` and `npm run test:e2e`.


## Motion and precision clock refinement (October 2026)

`site/motion.css` is a lightweight, shared design layer loaded **after** `minimal.css` across all built pages; `site/motion.js` progressively reveals selected research and archive items when they enter the viewport. It never hides content when IntersectionObserver is missing or the reader has enabled reduced motion. Hover treatments use tiny translations, subdued surface changes and slow image easing; there are no heavy motion libraries or new visual controls.

The homepage's India Standard Time analog clock uses three independent, continuous CSS sweeps (12-hour, 60-minute, 60-second). `site/site.js` calculates the accurate hand phase from `Intl.DateTimeFormat`, including milliseconds, and sets negative animation delays. This avoids continuous JavaScript paint loops. The clock resynchronizes when the tab becomes visible; the 24-hour digital clock and date retain their existing format. For `prefers-reduced-motion: reduce`, all sweeps and reveals are disabled and the hands update with discrete, accurate one-second steps. The dial retains all 60 minute indices and fits mobile widths.

Check with Python build unit tests, Playwright clock/interaction/viewport tests, and axe accessibility audits. CSS remains monochrome except for a restrained oxblood second hand; Inter, `#f9f9f9` surfaces, 8px corners and editorial hierarchy are unchanged.


## Precision editorial footer and copy (October 2026)

The entire publication shares `site/editorial-footer.html`, styled by the final stylesheet `site/footer-refresh.css`. The footer uses a measured 12-column CSS grid, three semantic navigation groups (Read / Research / Publication), clear link hierarchy, an attribution to the canonical Substack publication, a single email-subscription invitation and straightforward editorial contact, corrections, source and archive destinations. The small-print citation links to the full published editorial policy rather than implying the local summary replaces it.

The editorial text on the homepage now distinguishes published records, promised actions and observed outcomes without claiming a newsroom size or invented audience. Research teasers explicitly describe the record and its limitations. The pale lower masthead uses Inter-first SVG text, not a separate display font. Footer CSS uses responsive 2-column navigation at narrow widths, retaining semantic grouping and keyboard focus styles; motion preferences are honoured. The original full reporting remains on Substack. Unit and Playwright tests enforce link targets, navigation hierarchy, accessible footer markup and no horizontal overflow at narrow mobile sizes.


## Public Records — Question Hour, Trade Ledger, Public Money

Three source-oriented research products extend the existing GitHub Pages publication; no paid keys, tracking, persistent database or server is required.

- **Question Hour (`question-hour.html`)** queries Hugging Face's Dataset Viewer for OpenSansad's Lok Sabha question-and-answer records (dataset by Sammit Jain, CC BY 4.0; original public PDFs on Digital Sansad). Search is performed upstream, with 18th/17th/16th Lok Sabha and starred/unstarred filters on the *returned result page*. A bounded saved snapshot (up to 100 records, primarily 18th Lok Sabha) is available as a clearly marked fallback when the source fails. This is not a complete archival copy, a semantic-answer system or a verified assessment of government performance. Dataset: https://huggingface.co/datasets/opensansad/lok-sabha-qa ; API: https://huggingface.co/docs/dataset-viewer/filter .
- **Trade Ledger (`trade-ledger.html`)** queries UN Comtrade's *public preview* API, explicitly restricting to India as reporter (UN Comtrade code 699), exact partner, nominal US-dollar annual merchandise trade, HS commodity code and flow. Reports only exact validated responses. GitHub Actions caches a small selection of annual TOTAL records (2024–25; World/China/US/UAE/Bangladesh; imports/exports), with exact matching and source provenance, when the API works; live product-level lookups need a fresh API response. Public preview has record and rate limits. Documentation: https://uncomtrade.org/docs/un-comtrade-api/ .
- **Public Money (`public-money.html`)** provides a local, inspectable, CSV-exportable table of the Government of India's *Expenditure Profile 2026–27, Statement 1*. Includes nine budget expenditure heads and published 2024–25 actuals, 2025–26 Budget Estimates, 2025–26 Revised Estimates, 2026–27 Budget Estimates, in ₹ crore with two decimals. Rows are hierarchical and cannot be added indiscriminately; differences between budgeted and realised spending are preserved. Official source: https://www.indiabudget.gov.in/doc/eb/vol1.pdf . The snapshot is deliberately **dated** and not described as continuous actual spending.

`site/public-records.js` handles live browser retrieval and validated snapshots with plain DOM text, exact source links and transparent unavailable states. The standard-library script `scripts/public_records_refresh.py` produces two narrow metadata snapshots using only validated third-party responses. The existing `Official intelligence source refresh` workflow runs it daily and writes source data back to main; downstream Pages deployment reads the committed result. Upstream failure never leads to an invented number or document. The earliest deployment may display unavailable states until the first successful fetch; the Budget page is immediately populated from the official 2026 publication.

Tests: `python -m unittest discover -s tests -v`, `npm run check:js`, `npm run test:e2e`. All tables are keyboard-scrollable and respect reduced motion.

**Parliamentary resilience:** The source refresh first attempts the published OpenSansad dataset-service index, then the underlying Digital Sansad question API (18th Lok Sabha session 8, falling back to session 7), checking official document URLs and limiting each snapshot to at most 100 records. When neither responds, the public snapshot retains previously verified metadata; a one-record historical example from the OpenSansad dataset card is labelled as illustrative rather than current. HTTP failures are not interpreted as no parliamentary activity.


## Minimal editorial cleanup (November 2026)

The front page uses a smaller introduction and an open horizontal shelf of research cards. The mobile menu links to that shelf rather than repeating every tool. Publication links live in the shared footer, whose copy, headings and watermark are more restrained.

The homepage **Market snapshot** sits in an open bento card. Its attributed TradingView widget loads when the card enters view; the dedicated Market desk retains its existing data and source disclosures. Research links remain in an open horizontal row without JavaScript. Existing search, keyboard shortcuts, clock and source-linked tools remain available. Browser checks cover keyboard expansion, deferred widget loading, directory destinations and overflow from 320px to 1440px.

## Economy pulse, purchasing power and oil history (November 2026)

`india-data.html` now groups four **annual World Bank WDI observations** (real GDP growth, CPI inflation, manufacturing/GDP and total reserves including gold) and a rupee purchasing-power calculator alongside the existing annual-series explorer. Each card shows its observation year and source retrieval date; the page does not describe these as current monthly Indian releases. The RBIH DBIE prototype was evaluated but is not used as a production data source.

The calculator uses positive published `FP.CPI.TOTL` annual CPI index values (2010 = 100, underlying source IMF IFS, CC BY 4.0). Equivalent amount = amount × end index / start index. It supports deflation and same-year comparisons, rejects missing years or reversed periods, and does not interpolate, forecast or model an individual household basket.

`markets.html#oil-history` adds daily Brent and WTI spot history from US EIA via the open [datasets/oil-prices](https://github.com/datasets/oil-prices) pipeline (PDDL). Charts retain negative observations and show dated source retrievals. One-, five- and ten-year windows end at the last published observation; the selected records can be exported as CSV. EIA spot series are distinct from the existing TradingView indicative CFDs.

`scripts/finance_refresh.py` validates provider schemas, exact India/indicator identity, numeric observations, dates and duplicates before writing `site/data/finance.json`. The existing daily intelligence-refresh workflow runs it and commits the dated snapshot; the subsequent Pages workflow publishes it. Failed refreshes retain only revalidated prior observations, with their original retrieval date and explicit retained status. No keys, paid API or extra server is required. The new browser module and styles load only on the two relevant pages.

Verification: `python -m unittest discover -s tests -v`, `npm run test:finance`, `npm run check:js`, and the existing browser/accessibility workflow. Financial fixtures are synthetic only in tests. Production snapshots contain retrieved observations, never test values.


## Red action accents (November 2026)

The shared accent is `#b42332`, with `#8f1c28` for a dimmer hover state. Subscribe buttons, selected filters, primary research actions and downloads use these tokens. Reading text, data figures, charts and pale surfaces retain their neutral hierarchy. Disabled actions remain muted.


## Open bento shelves (November 2026)

Research destinations, market cards, economy indicators and finance methodology now use native horizontal bento shelves rather than accordions. Every item is present without expansion. Each shelf opens at the existing text gutter and spans the actual viewport; its overflow scrolls within the shelf, not the document. Cards use `#f9f9f9`, 8px corners and restrained red focus states.

`site/bento.css` supplies the shared presentation. `site/bento.js` measures the actual viewport and text-column offset, including browsers with vertical scrollbars, and supports Left/Right/Home/End when the shelf itself has keyboard focus. Touch, trackpad and native scrollbar navigation remain available; no autoplay or carousel library is introduced. Reduced motion disables smooth keyboard scrolling. Without JavaScript the cards remain in an open, scrollable row within the content column.

Homepage TradingView quotes load when their visible card enters the viewport, with attribution and delay wording retained. The market and research shelves contain direct destination links. CPI methodology and recent oil observations are visible cards alongside their source notes.


## Editorial spacing refinement (November 2026)

The shared content column is capped at 1128px, with 48px desktop, 32px tablet and 24px mobile insets. Section spacing follows an 8px rhythm, with 96px desktop separation between archive, research and footer regions. Introductory copy and the main reporting grid share their column ratio and gutter; reading text has a more relaxed line height. Bento cards retain full-width scrolling, use 16px gaps and 32px desktop/24px mobile padding, and keep their initial edge aligned to the text column. Keyboard scroll distances derive from the actual card gap. Red accents, 8px corners, source data and publication content remain unchanged.


## Ownership Atlas — expanded public-disclosure index (1 November 2026)

The Atlas now includes **29 companies and 69 named-holder or aggregate-category entries**, up from 5 companies. Source data: `site/data/ownership-companies.json` (version 2). The original five companies retain their own dated filings and **named shareholders** where available. Added companies use the exchange's shareholding pattern **Table I** category totals: promoter/promoter group (A), public (B), and employee trusts (C2) where nonzero, with the reporting date on each entry.

The added set includes Infosys, Wipro, HCL Technologies, Bharti Airtel, Vodafone Idea, HDFC Bank, ICICI Bank, SBI, Bajaj Finance, L&T, Titan, Maruti Suzuki, Tata Steel, Tata Power, Tata Motors, Sun Pharma, ITC, Adani Enterprises, NBCC, Ola Electric, Minda, Aditya Birla Capital, L&T Technology Services, and ACME Solar. Most are September 2026 snapshots; SBI is June 2026, Adani Enterprises July 2026. These dates are explicit, not interpolated or called "live."

Source links point to the original NSE corporate-filings shareholding-pattern index filtered by symbol or original issuer disclosures. As NSE's index can update to later filings, the Atlas also stores each company's dated snapshot. The curated A+B+C2 categories use a common regulatory percentage denominator (subject to the filing and rounding); C1 depository receipts are not an additional category in these graphs. **Public shareholders is an aggregate category, not an entity, so this never proves that one person controls a company.** Named holders from different reports are not summed with an aggregate category.

The directory adds searchable company/industry/symbol lookup, sector filtering, deep links `?company=<id>`, an eight-company collapsed index, and an expandable full index; selecting a company updates the original Cytoscape graph, cited shareholder list, date and an aggregate ownership bar only where appropriate. Content falls back to the HTML TCS snapshot if loading fails, and remains readable if Cytoscape's CDN is unavailable. All generated DOM content uses text nodes, never external HTML. Tests validate dated, linked records and filtering on desktop and 320px mobile.


## Ownership Atlas extension — 64 companies, 147 dated entries (November 2026)

An additional 35 listed-company records increase the directory from 29 to 64 companies, and from 69 to **147 source-linked ownership entries**. The entries are manually curated from the NSE Corporate Filings / Shareholding Pattern register and, where specified, original issuer filings. They retain each filing's **as-of date**, and original holdings are stored at the two-decimal precision of the disclosure, including A+B+C2 (promoter/promoter group, public shareholders, employee trust) distinctions. Most new records are quarter-end **30 September 2026**; Bajaj Auto is **30 June 2026**, and Kotak Mahindra Bank is **31 March 2026**. The page **does not** portray these snapshots as live shareholding updates.

The added companies are Hindalco, Hero MotoCorp, Indian Hotels, Crompton Greaves Consumer Electricals, CG Power, Afcons, RailTel, Piramal Pharma, AstraZeneca Pharma India, KFin Technologies, Netweb Technologies, UPL, Mahindra Holidays, Reliance Power, Shipping Corporation of India, Apeejay Surrendra Park Hotels, Aditya Birla Real Estate, Genus Power, WeWork India, India Shelter Finance, Bajaj Auto, Asian Paints, Kotak Mahindra Bank, Hindustan Petroleum, Godrej Agrovet, Jindal Saw, Whirlpool India, Kajaria Ceramics, MOIL, HDFC Life, Apollo Tyres, ITC Hotels, Physicswallah, Bajaj Electricals, and Edelweiss Financial Services.

**Compare companies.** The Ownership Atlas now renders two independently dated company profiles with linked original-source documents. Two exchange-reported **aggregate category** snapshots may be compared at their filing dates. Where either selection is a list of **selected named shareholders** instead, the UI explicitly says *not directly comparable*, rather than incorrectly inferring residual ownership or ultimate control. Category fields on newly added records explicitly include reported zeros, even when their 0%-value owner node is omitted from the graph.

**Export data.** The CSV export includes each of the 147 dated holdings as its own row with company, ticker (where recorded), sector, type, ownership label, percentage and original document URL; any spreadsheet formula-like field is escaped. It is built locally in the browser and requires no backend or account. The JSON source remains directly downloadable. Shareholder category totals are not named individuals, and no ownership percentages are invented to compensate for missing disclosures.

Primary NSE filings index: https://www.nseindia.com/companies-listing/corporate-filings-shareholding-pattern ; issuer-specific source links are in `site/data/ownership-companies.json`. `tests/test_ownership.py` checks exact record counts, A+B+C2 category denominators, provenance links and unique IDs. `e2e/site.spec.mjs` exercises comparisons, CSV export and 320px layouts. No third-party database is hosted and no new paid API is required.


## Ownership Atlas extension — September 2026 filing batch

The source-linked Atlas now holds **84 listed companies and 189 dated ownership records** (up from 64 and 147). The 20 newly added companies are Biocon, Torrent Power, Ashok Leyland, Campus Activewear, Lupin, Sterling and Wilson Renewable Energy, Ion Exchange (India), Northern Arc Capital, Tube Investments of India, Oriental Hotels, LT Foods, Laxmi Organic, Mahindra Logistics, Raymond, Donear Industries, Ksolves India, 63 moons technologies, Hindustan Aeronautics (HAL), Indian Railway Finance Corporation (IRFC), and Power Grid Corporation.

Each new snapshot is the **30 September 2026 A / B / C2 shareholding-pattern category** (promoter, public, employee trusts if applicable). Nineteen entries cite the **NSE corporate shareholding-pattern disclosure index** with the ticker in the source URL; Power Grid cites its issuer's Q2 FY2026–27 original shareholding disclosure. The source page may display a newer filing than the as-of quarter captured here; do not confuse a dated entry with real-time ownership. Promoter/public categories cannot be used to infer individual beneficial owners, institutional ownership or voting rights. Totals can differ from 100% by up to 0.01 percentage points because of source rounding. These records are separate from the five original companies' selected **named-owner** records.

Directory navigation supports editorial order, alphabetical, filing date, largest reported promoter share and largest reported public share. The latter two only rank companies with **aggregate-category** records; selected named-owner reports are placed after comparable category records to prevent false equivalence. Tests: `tests/test_ownership.py` and Playwright's source-aware directory/search tests.

## Root homepage migration

The target homepage is `https://theraisinapost.github.io/`. GitHub requires the repository name `theraisinapost.github.io` for this organization site. The deployment workflow keeps the project path correct until the repository is renamed, then switches to the root automatically. Existing `/theraisinapost/` bookmarks (both pretty paths and `.html` URLs) redirect to matching root pages, preserving query strings and anchors. Root canonicals, sitemap and crawler files are regenerated on deployment.
