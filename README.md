# Resource Choke Watch

**Live:** [https://mmsanders.github.io/niobium-watch/](https://mmsanders.github.io/niobium-watch/)

Tabbed static dashboard — **Niobium** (`#niobium`) and **Helium** (`#helium`). Watch-kit sections 1–4 + dominant temperature banner (section 5).

## Data

### Niobium (paths unchanged)
- `data/meta.json` — status, `watch_kit`, choke sites, curated signals
- `data/exports.json` — Brazil FeNb export baseline (Comex Stat)
- `data/headlines.json` — live RSS headlines

### Helium
- `data/helium/meta.json` — status, plants, watch kit
- `data/helium/supply.json` — USGS annual country production (no invented monthly world series)
- `data/helium/headlines.json` — live RSS headlines

## Automation

GitHub Actions refreshes **both** niobium and helium headlines twice daily (token-free) and deploys Pages.

**Pages URL:** https://mmsanders.github.io/niobium-watch/
