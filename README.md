# Niobium Watch

Static choke-point dashboard for Brazil-dominated niobium / ferroniobium supply.

**Live:** https://mmsanders.github.io/niobium-watch/

## Data
- `data/meta.json` — status, choke sites, curated signals
- `data/exports.json` — Brazil FeNb export baseline (Comex Stat)
- `data/headlines.json` — live RSS headlines (refreshed by Actions)

## Automation
GitHub Actions refreshes headlines twice daily (token-free) and deploys Pages.
