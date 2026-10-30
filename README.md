# The Raisina Post — independent RSS editorial archive

Official GitHub repository: **[theraisinapost/theraisinapost](https://github.com/theraisinapost/theraisinapost)**.

This repository contains a zero-cost, static editorial archive built from The Raisina Post's [public Substack RSS](https://raisinapost.substack.com/feed). Substack remains the canonical publisher. The archive shows recent stories and headlines, while readers follow links to the original Substack articles; it does not reproduce paid or complete newsletter content.

## Publishing

1. Open [Settings → Pages](https://github.com/theraisinapost/theraisinapost/settings/pages) and choose **GitHub Actions** under **Build and deployment**.
2. Open [Actions → The Raisina Post | RSS to GitHub Pages](https://github.com/theraisinapost/theraisinapost/actions/workflows/raisina-post-pages.yml) and run the workflow once if it is not already running.
3. Once GitHub Pages deployment succeeds, visit **https://theraisinapost.github.io/theraisinapost/**. (This is a *project* site, since the repository is named `theraisinapost`.)

GitHub Actions refreshes the RSS-indexed site hourly (subject to scheduling and feed access). RSS retrieval uses the canonical feed directly, then a public RSS-only proxy as a fallback if Substack rejects a cloud-hosted request. The job runs unit tests, validates the RSS and publishes a static HTML site without requiring Substack login. If the feed is unavailable, deployment stops rather than replacing the site with an empty index.

For the short organization-level URL **https://theraisinapost.github.io/** in future, a separate repository named `theraisinapost.github.io` would be needed; the present repository is the one you created, and remains unchanged in name.

## Custom domain later

Use a subdomain you own, for example `archive.example.com`, and keep Substack on its current domain. At your DNS provider add `CNAME archive → theraisinapost.github.io`, then set the same hostname in this repo's **Settings → Pages → Custom domain**. Set the Actions repository variable `RAISINA_SITE_URL` to `https://archive.example.com/` so the site's canonical URL, sitemap and metadata match. Rerun the workflow and enforce HTTPS after GitHub provisions it. Do not configure a domain that you do not own, or overwrite Substack / email DNS records.

## Local verification

Requires Python 3.10+ (standard library only):

```bash
python -m unittest discover -s tests -v
python scripts/build.py --output dist
python -m http.server 8000 --directory dist
```

Use `--feed-file` to build against an offline XML fixture and avoid network calls when testing. The site is mobile responsive, searchable and filterable; only articles present in the current RSS feed appear (this is not guaranteed to be a full historical archive).
