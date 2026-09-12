const PATHS = {
  niobium: { meta: "data/meta.json", series: "data/exports.json", headlines: "data/headlines.json", sub: "FeNb choke-point monitor" },
  helium: { meta: "data/helium/meta.json", series: "data/helium/supply.json", headlines: "data/helium/headlines.json", sub: "Liquid / gaseous helium choke-point monitor" }
};
const FALLBACK = { meta: { overall_status: "Watch", overall_rationale: "Loading live JSON…", watch_kit: {} }, series: { series_monthly: [], world_by_year: [] }, headlines: { items: [] } };
const LS_KEY = "rcw-tab";

function fmtTonnes(t) {
  if (t == null || isNaN(t)) return "—";
  return Number(t).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtUsdB(v) { return v == null ? "—" : "$" + (v / 1e9).toFixed(2) + "B"; }
function fmtUsdM(v) { return v == null ? "—" : "$" + (v / 1e6).toFixed(0) + "M"; }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function annualFromSeries(series) {
  const map = {};
  for (const s of series || []) {
    const y = s.year;
    if (!map[y]) map[y] = { year: y, months: 0, kg: 0, fob_usd: 0 };
    map[y].months += 1; map[y].kg += Number(s.kg || 0); map[y].fob_usd += Number(s.fob_usd || 0);
  }
  return Object.values(map).sort((a,b) => a.year - b.year).map(a => ({
    ...a, tonnes: a.kg / 1000, unit_value_usd_per_kg: a.kg ? +(a.fob_usd / a.kg).toFixed(2) : null
  }));
}
async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(path + " " + res.status);
  return res.json();
}
async function loadTab(tab) {
  const p = PATHS[tab];
  try {
    const [meta, series, headlines] = await Promise.all([loadJson(p.meta), loadJson(p.series), loadJson(p.headlines)]);
    return { meta, series, headlines, mode: "live", tab };
  } catch (e) {
    console.warn("Live fetch failed", e);
    return { ...FALLBACK, mode: "fallback", tab };
  }
}
function itemRisk(it) { return it.risk || it.flag || "yellow"; }
function itemDate(it) { return String(it.date || it.published_utc || "").slice(0, 10); }
function itemTitle(it) { return it.title_en || it.title || "(untitled)"; }
function signalRow(it) {
  const summary = it.summary ? `<div class="muted">${esc(it.summary)}</div>` : (it.source ? `<div class="muted">${esc(it.source)}</div>` : "");
  const date = itemDate(it);
  return `<div class="signal"><span class="dot ${esc(itemRisk(it))}"></span><div><a href="${esc(it.url || "#")}" target="_blank" rel="noopener">${esc(itemTitle(it))}</a>${summary}<div class="muted sig-meta">${esc(date)}</div></div><div class="muted desk-only" style="white-space:nowrap">${esc(date)}</div></div>`;
}
function renderSignals(baseline, rss) {
  const parts = [];
  if (baseline && baseline.length) {
    parts.push(`<div class="section-label">Curated baseline</div>`);
    parts.push(baseline.slice().sort((a,b) => itemDate(b).localeCompare(itemDate(a))).map(signalRow).join(""));
  }
  if (rss && rss.length) {
    parts.push(`<div class="section-label">Live headlines (RSS cron)</div>`);
    parts.push(rss.slice(0, 24).map(signalRow).join(""));
  }
  return parts.length ? parts.join("") : `<p class="muted">No headlines yet — awaiting cron RSS fetch.</p>`;
}
function wk(meta) { return meta.watch_kit || {}; }

function renderTempBanner(meta, series) {
  const status = meta.overall_status || "Watch";
  document.getElementById("tempBanner").className = "temp-banner " + status;
  document.getElementById("statusHuge").textContent = status;
  document.getElementById("statusRationale").textContent = meta.overall_rationale || "";
  const temp = meta.temperature || wk(meta).temperature || {};
  const cols = [
    { cls: "green", title: "Looks normal", items: temp.normal || [] },
    { cls: "yellow", title: "Yellow flags", items: temp.yellow || [] },
    { cls: "red", title: "Red flags", items: temp.red || [] },
  ];
  document.getElementById("tempCols").innerHTML = cols.map(c => `<div class="temp-panel ${c.cls}"><h4>${c.title}</h4><ul>${(c.items||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul></div>`).join("");
  const fa = temp.false_alarms || [];
  document.getElementById("falseAlarms").innerHTML = fa.length ? `<strong>False alarms:</strong> ${fa.map(esc).join(" · ")}` : "";
  renderPulseChips(meta, series);
}

function renderPulseChips(meta, series) {
  const pulse = document.getElementById("livePulse");
  const monthly = (series.series_monthly || []).slice().sort((a,b) => String(a.period).localeCompare(String(b.period)));
  if (monthly.length) {
    const last = monthly[monthly.length - 1];
    const prev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
    const tonnes = Number(last.tonnes || 0);
    const uv = last.unit_value_usd_per_kg;
    let mom = (prev && prev.tonnes) ? ((tonnes - Number(prev.tonnes)) / Number(prev.tonnes)) * 100 : null;
    let bandHint = (tonnes < 7000 || tonnes > 9000) ? "hint-yellow" : "hint-green";
    let momHint = "hint-green";
    if (mom != null && Math.abs(mom) > 20) momHint = "hint-yellow";
    if (mom != null && Math.abs(mom) > 30) momHint = "hint-red";
    pulse.innerHTML = `<div class="pulse-chip ${bandHint}"><div class="label">Last month · ${esc(last.period)}</div><div class="val">${fmtTonnes(tonnes)} t</div><div class="muted">${tonnes>=7000&&tonnes<=9000?"in ~7–9 kt band":"outside ~7–9 kt band"}</div></div>
      <div class="pulse-chip ${momHint}"><div class="label">MoM change</div><div class="val">${mom==null?"—":((mom>=0?"+":"")+mom.toFixed(1)+"%")}</div></div>
      <div class="pulse-chip"><div class="label">Unit value</div><div class="val">${uv!=null?"$"+Number(uv).toFixed(2)+"/kg":"—"}</div><div class="muted">FOB</div></div>`;
    return;
  }
  const years = series.world_by_year || [];
  if (years.length) {
    const last = years[years.length - 1];
    const us = (last.countries || []).find(c => /united states/i.test(c.country));
    const qa = (last.countries || []).find(c => /qatar/i.test(c.country));
    const combo = (us && qa && us.share_pct != null && qa.share_pct != null) ? (us.share_pct + qa.share_pct) : null;
    const stress = (meta.overall_status === "Stress");
    pulse.innerHTML = `<div class="pulse-chip"><div class="label">World ${last.year}${last.estimated?"e":""}</div><div class="val">${last.world_mcm} Mm³</div><div class="muted">${esc(last.source||"USGS")}</div></div>
      <div class="pulse-chip ${combo!=null&&combo>=70?"hint-yellow":"hint-green"}"><div class="label">US + Qatar share</div><div class="val">${combo==null?"—":combo.toFixed(0)+"%"}</div><div class="muted">two-country choke</div></div>
      <div class="pulse-chip ${stress?"hint-red":"hint-yellow"}"><div class="label">Live plant watch</div><div class="val">${esc(meta.overall_status||"—")}</div><div class="muted">Ras Laffan is P0</div></div>`;
    return;
  }
  pulse.innerHTML = `<div class="pulse-chip"><div class="label">Live pulse</div><div class="val muted">no series</div></div>`;
}

function siteShareParts(s) {
  const shareParts = [];
  if (s.share_approx) shareParts.push(esc(s.share_approx));
  if (s.capacity_feNb_eq_tpy) shareParts.push("cap " + fmtTonnes(s.capacity_feNb_eq_tpy) + " t/y FeNb-eq");
  if (s.sales_or_production_2025_t) shareParts.push("sales/prod 2025 ~" + fmtTonnes(s.sales_or_production_2025_t) + " t");
  if (s.production_2025_nb_t) shareParts.push("2025 " + fmtTonnes(s.production_2025_nb_t) + " t Nb");
  if (s.metric && !shareParts.length) shareParts.push(esc(s.metric));
  return shareParts;
}
function renderSites(meta) {
  const sites = wk(meta).sites || [];
  document.querySelector("#sitesTable tbody").innerHTML = sites.map(s => {
    const shareParts = siteShareParts(s);
    const watch = Array.isArray(s.watch) ? s.watch : (s.watch ? [s.watch] : []);
    return `<tr><td><span class="prio ${esc(s.priority)}">${esc(s.priority)}</span></td><td><strong>${esc(s.name)}</strong></td><td class="muted">${shareParts.join("<br>")}</td><td>${watch.map(w=>`<span class="tag">${esc(w)}</span>`).join("")}</td><td class="muted">${esc(s.notes||"")}</td></tr>`;
  }).join("");
  const cards = document.getElementById("sitesCards");
  if (cards) {
    cards.innerHTML = sites.map(s => {
      const shareParts = siteShareParts(s);
      const watch = Array.isArray(s.watch) ? s.watch : (s.watch ? [s.watch] : []);
      return `<article class="site-card">
        <div class="site-card-top"><span class="prio ${esc(s.priority)}">${esc(s.priority)}</span><span class="site-name">${esc(s.name)}</span></div>
        <div class="field-label">Share / capacity</div>
        <div class="site-share">${shareParts.join(" · ") || "—"}</div>
        <div class="field-label">Watch</div>
        <div>${watch.map(w=>`<span class="tag">${esc(w)}</span>`).join("") || "—"}</div>
        ${s.notes ? `<div class="field-label">Notes</div><div class="site-notes">${esc(s.notes)}</div>` : ""}
      </article>`;
    }).join("");
  }
  const L = wk(meta).logistics || meta.logistics_baseline || {};
  document.getElementById("logisticsCard").innerHTML = `<h2 style="margin:0 0 .35rem">Logistics pipe</h2>
    <div class="pipe">${esc(L.pipe || L.route || "—")}</div>
    <p class="muted" style="margin:.25rem 0">${esc(L.form || "")}</p>
    <p class="muted" style="margin:.25rem 0"><strong style="color:var(--text)">Destinations:</strong> ${(L.destinations||[]).map(esc).join(" · ") || "—"}</p>
    <p class="muted" style="margin:.25rem 0"><strong style="color:var(--text)">Distributors:</strong> ${(L.distributors||[]).map(esc).join(" / ") || "—"}
      · <strong style="color:var(--text)">Offices:</strong> ${esc(L.offices || "—")}</p>
    <p class="muted" style="margin:.25rem 0 0"><strong style="color:var(--text)">Codes:</strong> ${esc(L.hs_ncm || "")}</p>`;
}

function renderCodesPipes(meta) {
  const codes = wk(meta).codes || {};
  const extra = codes.hts ? `<div class="kpi"><div class="label">HTS</div><div class="val" style="font-size:.95rem">${esc(codes.hts)}</div></div>` : `<div class="kpi"><div class="label">NCM</div><div class="val">${esc(codes.ncm || "—")}</div></div>`;
  document.getElementById("codesBox").innerHTML = `<div class="kpi-row">
    <div class="kpi"><div class="label">HS</div><div class="val">${esc(codes.hs || "—")}</div></div>
    ${extra}
    <div class="kpi"><div class="label">Specialty</div><div class="val" style="font-size:.95rem">${esc(codes.specialty || "—")}</div></div>
  </div><p class="muted" style="margin:0">${esc(codes.product || "")}</p>`;
  const pipes = wk(meta).data_pipes || [];
  document.getElementById("pipesBox").innerHTML = pipes.map(p => {
    const link = p.url ? ` · <a class="ext" href="${esc(p.url)}" target="_blank" rel="noopener">open</a>` : "";
    const api = p.api ? `<div class="muted" style="font-size:.8rem">API: <code>${esc(p.api)}</code></div>` : "";
    return `<div style="padding:.45rem 0;border-bottom:1px solid var(--border)"><strong>${esc(p.name)}</strong>${link}<div class="muted">${esc(p.how||"")}</div>${api}</div>`;
  }).join("") || `<p class="muted">No data pipes listed.</p>`;
  const L = wk(meta).logistics || {};
  const ui = meta.ui || {};
  document.getElementById("destKitTitle").textContent = ui.dest_kit_title || "How destinations fit the kit";
  document.getElementById("destKitNote").textContent = "Expected destination / offtake mix for a Normal temperature read.";
  document.getElementById("destKitList").innerHTML = `<ul class="compact">${(L.destinations||[]).map(d=>`<li>${esc(d)}</li>`).join("")}</ul>
    <p class="muted" style="margin-top:.65rem">Distributors: ${(L.distributors||[]).map(esc).join(" / ")}</p>`;
}

function renderLang(meta) {
  const ll = wk(meta).language_layer || {};
  const langs = (ll.languages || []).map(l => `<span class="chip">${esc(l)}</span>`).join("");
  const seeds = (ll.search_seeds || []).map(s => `<li><code>${esc(s)}</code></li>`).join("");
  const outlets = (ll.outlets || []).map(o => `<tr><td>${esc(o.name)}</td><td class="muted">${esc(o.type||"")}</td><td class="muted">${esc(o.region||"")}</td></tr>`).join("");
  document.getElementById("langLayer").innerHTML = `<div class="chip-row">${langs}</div><div class="grid-2"><div><h2 style="margin-top:.25rem">Search seeds</h2><ul class="compact">${seeds||"<li>—</li>"}</ul></div><div><h2 style="margin-top:.25rem">Outlet types</h2><table><thead><tr><th>Outlet</th><th>Type</th><th>Region</th></tr></thead><tbody>${outlets}</tbody></table></div></div>`;
}
function renderCadence(meta) {
  document.querySelector("#cadenceTable tbody").innerHTML = (wk(meta).cadence || []).map(r => `<tr><td><strong>${esc(r.freq)}</strong></td><td class="muted">${esc(r.covers||"")}</td></tr>`).join("");
  document.getElementById("automationNote").textContent = wk(meta).automation_note || "Automation: twice-daily RSS (no AI); monthly AI brief.";
}

function renderSeries(meta, series) {
  const ui = meta.ui || {};
  document.getElementById("pulseTitle").textContent = ui.pulse_title || series.pulse_title || "Export pulse — Brazil FeNb (NCM 72029300)";
  document.getElementById("destTitle").textContent = ui.dest_title || "Destinations";
  const monthly = (series.series_monthly || []).slice().sort((a,b) => String(a.period).localeCompare(String(b.period)));
  const gap = document.getElementById("exportGap");
  if (monthly.length) {
    let annual = series.annual_summaries; if (!annual || !annual.length) annual = annualFromSeries(monthly);
    const byYear = Object.fromEntries((annual || []).map(a => [a.year, a]));
    const a24 = byYear[2024], a25 = byYear[2025], a26 = byYear[2026];
    document.getElementById("exportKpis").innerHTML = `
      <div class="kpi"><div class="label">2024</div><div class="val">${a24?fmtTonnes(a24.tonnes)+" t":"—"}</div><div class="muted">${a24?fmtUsdB(a24.fob_usd):""}</div></div>
      <div class="kpi"><div class="label">2025</div><div class="val">${a25?fmtTonnes(a25.tonnes)+" t":"—"}</div><div class="muted">${a25?fmtUsdB(a25.fob_usd):""}</div></div>
      <div class="kpi"><div class="label">2026 YTD</div><div class="val">${a26?fmtTonnes(a26.tonnes)+" t":"—"}</div><div class="muted">${a26?(a26.months||"")+" mo · "+fmtUsdB(a26.fob_usd):""}</div></div>
      <div class="kpi"><div class="label">Unit value 2026</div><div class="val">${a26&&a26.unit_value_usd_per_kg?"$"+a26.unit_value_usd_per_kg+"/kg":"—"}</div></div>`;
    gap.hidden = true;
    drawLine(monthly);
    renderDestMonthly(series);
    return;
  }
  const years = series.world_by_year || [];
  if (years.length) {
    const last = years[years.length - 1];
    const us = (last.countries || []).find(c => /united states/i.test(c.country));
    const qa = (last.countries || []).find(c => /qatar/i.test(c.country));
    document.getElementById("exportKpis").innerHTML = years.map(y =>
      `<div class="kpi"><div class="label">${y.year}${y.estimated?"e":""}</div><div class="val">${y.world_mcm} Mm³</div><div class="muted">${esc(y.source||"")}</div></div>`
    ).join("") + `<div class="kpi"><div class="label">US + Qatar ${last.year}e</div><div class="val">${((us&&us.share_pct||0)+(qa&&qa.share_pct||0)).toFixed(0)}%</div><div class="muted">of world</div></div>`;
    const gaps = series.gaps || [];
    gap.hidden = false;
    gap.innerHTML = `<strong>Data gaps:</strong> ${(gaps.length?gaps:["Annual USGS only — no monthly world series."]).map(esc).join(" · ")}`;
    drawCountryBars(last);
    renderDestHelium(series, meta);
    return;
  }
  document.getElementById("exportKpis").innerHTML = "";
  gap.hidden = false;
  gap.textContent = series.coverage_note || "No series available.";
  if (window._exportChart) { window._exportChart.destroy(); window._exportChart = null; }
  renderDestMonthly(series);
}

function drawLine(monthly) {
  const ctx = document.getElementById("exportChart");
  if (window._exportChart) window._exportChart.destroy();
  window._exportChart = new Chart(ctx, {
    type: "line",
    data: { labels: monthly.map(s => s.period), datasets: [{ label: "FeNb exports (tonnes)", data: monthly.map(s => s.tonnes), borderColor: "#5b9fd4", backgroundColor: "rgba(91,159,212,.15)", fill: true, tension: 0.25, pointRadius: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => { const s = monthly[c.dataIndex]; return s ? "FOB " + fmtUsdM(s.fob_usd) + " · $" + (s.unit_value_usd_per_kg || "—") + "/kg" : ""; } } } },
      scales: { x: { ticks: { color: "#8b9aab", maxRotation: 45, autoSkip: true, maxTicksLimit: (window.innerWidth < 720 ? 8 : 16) }, grid: { color: "rgba(46,58,74,.5)" } }, y: { ticks: { color: "#8b9aab" }, grid: { color: "rgba(46,58,74,.5)" }, title: { display: true, text: "tonnes", color: "#8b9aab" } } } }
  });
}
function drawCountryBars(yearObj) {
  const countries = (yearObj.countries || []).filter(c => c.mcm != null);
  const ctx = document.getElementById("exportChart");
  if (window._exportChart) window._exportChart.destroy();
  window._exportChart = new Chart(ctx, {
    type: "bar",
    data: { labels: countries.map(c => c.country), datasets: [{ label: "Mm³", data: countries.map(c => c.mcm), backgroundColor: "rgba(91,159,212,.75)" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: "#8b9aab", maxRotation: 40 }, grid: { color: "rgba(46,58,74,.5)" } }, y: { ticks: { color: "#8b9aab" }, grid: { color: "rgba(46,58,74,.5)" }, title: { display: true, text: "million m³", color: "#8b9aab" } } } }
  });
}

function renderDestMonthly(series) {
  document.getElementById("destHead").innerHTML = `<tr><th>Country</th><th class="num">kt</th><th class="num">Share</th><th class="num">FOB $M</th></tr>`;
  let dest = null;
  const D = series.destinations;
  if (D && !Array.isArray(D)) dest = D["2026_ytd"] || D["2025_full"] || Object.values(D)[0];
  else if (Array.isArray(D) && D.length) dest = { period: "destinations", countries: D };
  fillDest(dest, true);
}
function renderDestHelium(series, meta) {
  document.getElementById("destHead").innerHTML = `<tr><th>Country</th><th class="num">Share</th></tr>`;
  const block = (series.destinations && series.destinations.us_imports_2021_24) || null;
  fillDest(block, false);
  const uses = (series.us_salient && series.us_salient.end_use_2025_usgs) || [];
  if (uses.length) {
    document.getElementById("destKitList").innerHTML += `<div class="section-label">US end use 2025 (USGS)</div><ul class="compact">${uses.map(u=>`<li>${esc(u.use)} — ${u.share_pct}%</li>`).join("")}</ul>`;
  }
}
function fillDest(dest, showVol) {
  const destPeriod = document.getElementById("destPeriod");
  const destBars = document.getElementById("destBars");
  const tbody = document.querySelector("#destTable tbody");
  if (dest && dest.countries && dest.countries.length) {
    destPeriod.textContent = dest.period || "";
    const top = dest.countries.slice(0, 8);
    destBars.innerHTML = top.map(c => `<div class="bar-row"><span class="bar-label" title="${esc(c.country)}">${esc(c.country)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, c.share_kg_pct || c.share_pct || 0)}%"></div></div><span class="bar-pct">${(c.share_kg_pct || c.share_pct || 0).toFixed(1)}%</span></div>`).join("");
    tbody.innerHTML = top.map(c => showVol
      ? `<tr><td>${esc(c.country)}</td><td class="num">${((c.tonnes||0)/1000).toFixed(1)}</td><td class="num">${(c.share_kg_pct||0).toFixed(1)}%</td><td class="num">${((c.fob_usd||0)/1e6).toFixed(0)}</td></tr>`
      : `<tr><td>${esc(c.country)}</td><td class="num">${(c.share_kg_pct||c.share_pct||0).toFixed(1)}%</td></tr>`).join("");
  } else {
    destPeriod.textContent = "Destination mix not yet available.";
    destBars.innerHTML = ""; tbody.innerHTML = "";
  }
}

function renderProducers(meta) {
  document.getElementById("producerTitle").textContent = (meta.ui && meta.ui.producer_title) || "Producer baseline";
  if (meta.producers_kpis && meta.producers_kpis.length) {
    document.getElementById("producerBox").innerHTML = `<div class="kpi-row">${meta.producers_kpis.map(k => `<div class="kpi"><div class="label">${esc(k.label)}</div><div class="val">${esc(k.val)}</div><div class="muted">${esc(k.muted||"")}</div></div>`).join("")}</div>`;
    return;
  }
  const p = meta.producers || {};
  const usgs = p.usgs_mcs_2026 || {};
  const cbmm = p.cbmm || {};
  const cmoc = p.cmoc_brazil || {};
  document.getElementById("producerBox").innerHTML = `<div class="kpi-row">
    <div class="kpi"><div class="label">Brazil mine (USGS 2025e)</div><div class="val">${fmtTonnes(usgs.brazil_mine_2025e_nb_t)} t Nb</div><div class="muted">~${usgs.brazil_share_approx_pct||93}% world</div></div>
    <div class="kpi"><div class="label">CBMM capacity</div><div class="val">${fmtTonnes(cbmm.capacity_feNb_eq_tpy)} t/y</div><div class="muted">sales 2025 ~${fmtTonnes(cbmm.sales_2025_feNb_eq_t)}</div></div>
    <div class="kpi"><div class="label">CMOC Brazil 2025</div><div class="val">${fmtTonnes(cmoc.production_2025_nb_t)} t Nb</div><div class="muted">vs ${fmtTonnes(cmoc.production_2024_nb_t)} in 2024</div></div>
  </div><p class="muted" style="margin:0">Canada (Niobec/others) USGS 2025e ~${fmtTonnes(usgs.canada_mine_2025e_nb_t)} t Nb content.</p>`;
}

function render(data) {
  const { meta, series, headlines, mode, tab } = data;
  const ui = meta.ui || {};
  document.getElementById("hdrSub").textContent = ui.subtitle || PATHS[tab].sub;
  const modeEl = document.getElementById("dataMode");
  const stamp = (meta.last_headline_fetch_utc || meta.last_export_fetch_utc || meta.dashboard_as_of || "").toString().slice(0, 19);
  modeEl.textContent = mode === "live" ? "live data · " + stamp : "embedded fallback snapshot";
  modeEl.className = "data-mode " + mode;
  renderTempBanner(meta, series);
  renderSites(meta);
  renderCodesPipes(meta);
  renderLang(meta);
  renderCadence(meta);
  renderSeries(meta, series);
  renderProducers(meta);
  document.getElementById("signalBoard").innerHTML = renderSignals(meta.baseline_signals || [], (headlines && headlines.items) || []);
  const notProv = wk(meta).not_provided || meta.not_provided || [];
  const sources = (meta.sources_footer || []).join(" · ");
  const liveFiles = tab === "helium"
    ? "<code>data/helium/meta.json</code> · <code>data/helium/supply.json</code> · <code>data/helium/headlines.json</code>"
    : "<code>data/meta.json</code> · <code>data/exports.json</code> · <code>data/headlines.json</code>";
  document.getElementById("footer").innerHTML = `<div class="section-kicker" style="margin-bottom:.35rem">What this will NOT give you</div>
    <ul class="compact">${notProv.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <div style="margin-top:.85rem"><strong>As-of:</strong> ${esc(meta.dashboard_as_of||"—")} · Headlines: ${esc((meta.last_headline_fetch_utc||"—").toString().slice(0,19))}</div>
    <div style="margin-top:.35rem"><strong>Sources:</strong> ${esc(sources)}</div>
    <div style="margin-top:.35rem">Live: ${liveFiles} · Pages: <a class="ext" href="https://mmsanders.github.io/niobium-watch/" target="_blank" rel="noopener">mmsanders.github.io/niobium-watch</a></div>`;
}

function currentTab() {
  const h = (location.hash || "").replace("#","").toLowerCase();
  if (h === "helium" || h === "niobium") return h;
  try { const s = localStorage.getItem(LS_KEY); if (s === "helium" || s === "niobium") return s; } catch (e) {}
  return "niobium";
}
function setTabUI(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  try { localStorage.setItem(LS_KEY, tab); } catch (e) {}
  if (location.hash.replace("#","") !== tab) history.replaceState(null, "", "#" + tab);
}
async function showTab(tab) {
  setTabUI(tab);
  const data = await loadTab(tab);
  render(data);
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
window.addEventListener("hashchange", () => showTab(currentTab()));
showTab(currentTab()).catch(err => { document.getElementById("statusRationale").textContent = "Failed to render: " + err; });
