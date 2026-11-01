# Raisina Terminal

The public `/terminal/` workspace runs entirely on GitHub Pages. It links company ownership with indexed original filings, and provides a separate economic history panel, scheduled releases, source health and followed companies. Dates and coverage are retained from the underlying datasets. It does not supply company earnings, live exchange quotes, Bloomberg/Reuters content or inferred company-policy effects.

Three workspaces retain their selected company, indicator, country and panel arrangement in browser-local storage (`raisina-terminal-v1`). The followed-company list is shared between workspaces. URL parameters share selections only. Local storage failures do not block research. Reset affects the active workspace only. All stored layout content is reduced to numeric coordinates and six allowlisted panel IDs; saved HTML is never restored.

GridStack 12.3.3 (MIT) supplies rearranging/resizing. Earlier/Later buttons offer keyboard reordering. When GridStack is unavailable, the same panels use a responsive CSS layout. Lightweight Charts 5.0.8 (Apache-2.0) supplies history charts with visible TradingView attribution and retained licence/notice. Missing annual years are whitespace points, not interpolated values. A data table remains if the chart library fails. All library files are vendored locally, with notices under `site/vendor`.

## OpenBB integration

The deployed workspace uses the same public snapshots as the rest of the site. It is not connected to a live OpenBB provider backend.

A working optional, read-only backend is included for OpenBB Workspace's documented custom-backend protocol:

```
python scripts/build.py --feed-file site/feed-backup.xml --output dist
python scripts/terminal_backend.py --port 6900
```

It binds to `127.0.0.1` only and exposes `/widgets.json`, `/ownership?company=tcs`, `/economy?indicator=growth&country=IND`, and `/documents?q=petroleum`. Add `http://127.0.0.1:6900` as a custom backend in OpenBB Workspace to use these three widgets. Endpoint and configuration shapes are verified locally; sign-in and an end-to-end connection to the hosted OpenBB service are not part of the deployed site. Browser restrictions on localhost access may require local setup.

The server reads built public files, makes no upstream requests and accepts no arbitrary file paths or remote URLs. It is a connector for our research data, not an OpenBB market-data licence. A public, authenticated provider backend, data entitlements and any real-time redistribution arrangement require separate hosting/configuration. No secrets belong in Pages source or browser storage.

Protocol references:
- https://docs.openbb.co/workspace/developers/json-specs/widgets-json-reference
- https://docs.openbb.co/workspace/developers/data-integration
