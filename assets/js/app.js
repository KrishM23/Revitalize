/* Carbon Trackers | main dashboard */

import { loadData, getCampuses, getEmissionsSeries, getScopeBreakdown, getPolicy, getAllCampusMetrics, getDataFreshness } from './data.js';
import {
  computeCampusMetrics,
  formatEmissionsShort,
  formatEmissionsFull,
  formatPercent,
  perCapita,
  requiredAnnualRate,
  realizedAnnualRate,
  emissionsEquivalentLabel
} from './analytics.js';
import { buildForecast } from './forecast.js';
import {
  createEmissionsBarChart,
  createSparkline,
  createScopeChart,
  createModelComparisonChart,
  destroyChart
} from './charts.js';
import {
  getTier,
  renderShield,
  renderTierLadder,
  tierProgress,
  tierProgressLabel
} from './tiers.js';
import { renderGlossaryPopups, setupGlossaryTips } from './glossary.js';

let state = {
  selectedCampusId: 'systemwide',
  currentForecast: null,
  charts: { main: null, scope: null, model: null, sparks: [] }
};

const BANNER_IDS = new Set(['systemwide', 'berkeley', 'davis', 'irvine', 'ucla', 'merced', 'riverside', 'ucsd', 'ucsf', 'ucsb', 'ucsc']);
function bannerFor(id) {
  return BANNER_IDS.has(id) ? `assets/campuses/${id}.png` : null;
}

function updateBanner(campus) {
  const banner = document.getElementById('campusBanner');
  const img = document.getElementById('campusBannerImg');
  if (!banner || !img) return;
  const src = campus ? bannerFor(campus.id) : null;
  const isLogo = !!campus && campus.id === 'systemwide';
  banner.classList.toggle('banner-logo', isLogo);
  if (src) {
    img.src = src;
    img.alt = isLogo ? 'University of California' : `${campus.name} campus`;
    img.hidden = false;
    banner.classList.remove('is-system');
  } else {
    img.hidden = true;
    img.removeAttribute('src');
    banner.classList.add('is-system');
  }
}

async function init() {
  if (typeof Chart === 'undefined') {
    showError('Chart.js failed to load. Check your network connection.');
    return;
  }
  try {
    await loadData();
    setupCampusSelector();
    setupModelDetails();
    const popupHost = document.getElementById('glossaryPopups');
    if (popupHost) popupHost.innerHTML = renderGlossaryPopups();
    setupGlossaryTips();
    setupFromHash();
    updateDataFreshness();
    renderDashboard();
    window.addEventListener('hashchange', setupFromHash);
  } catch (err) {
    console.error(err);
    showError('Could not load emissions data. Serve this folder over HTTP: python3 -m http.server 8080');
  }
}

function setupFromHash() {
  const id = location.hash.replace('#', '');
  const campuses = getCampuses();
  if (id && campuses.some(c => c.id === id)) {
    state.selectedCampusId = id;
    const select = document.getElementById('campusSelect');
    if (select) select.value = id;
    renderDashboard();
  }
}

function setupCampusSelector() {
  const select = document.getElementById('campusSelect');
  if (!select) return;
  const campuses = getCampuses();
  select.innerHTML = campuses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  select.value = state.selectedCampusId;
  select.addEventListener('change', e => {
    state.selectedCampusId = e.target.value;
    location.hash = state.selectedCampusId;
    renderDashboard();
  });
}

/* Render the model-comparison chart only when the disclosure is open,
   so the canvas has real dimensions (fixes 0×0 "not loading"). */
function setupModelDetails() {
  const details = document.querySelector('.forecast-details');
  if (!details) return;
  details.addEventListener('toggle', () => {
    if (details.open) renderModelChart(state.currentForecast);
  });
}

function showError(msg) {
  const el = document.getElementById('chartFallback');
  if (el) {
    el.textContent = msg;
    el.hidden = false;
    el.style.display = 'flex';
  }
}

function updateDataFreshness(metrics) {
  const fresh = getDataFreshness();
  const footer = document.getElementById('dataFreshnessNote');
  if (footer && fresh.latestYear) {
    footer.textContent = `Inventory through ${fresh.latestYear} · UC Annual Report on Sustainable Practices · Policy: 90% reduction from 2019 by 2045`;
  }
  const kicker = document.getElementById('topbarDataYear');
  if (kicker && fresh.latestYear) {
    const campusYear = metrics?.latest?.year ?? fresh.latestYear;
    kicker.textContent = `UC Climate Dashboard · ${campusYear} inventory`;
  }
}

function renderDashboard() {
  const campusId = state.selectedCampusId;
  const policy = getPolicy();
  const campus = getCampuses().find(c => c.id === campusId);
  const series = getEmissionsSeries(campusId);
  const metrics = computeCampusMetrics(series, policy);
  const forecast = buildForecast(series, policy);
  state.currentForecast = forecast.error ? null : forecast;

  const isSystem = campusId === 'systemwide';
  document.getElementById('dashboardTitle').textContent = campus?.name ?? 'University of California';
  document.getElementById('dashboardSubtitle').textContent = isSystem
    ? "All campuses · Climate Promise · Emissions and where they're heading"
    : `${campus.region}${campus.stars ? ' · ' + campus.stars + ' STARS' : ''} · Emissions and where they're heading`;
  updateBanner(campus);
  updateDataFreshness(metrics);
  const planLink = document.getElementById('planLink');
  if (planLink) planLink.href = `plans.html#${campusId}`;

  updateKpis(metrics, campus, forecast, series);
  updatePace(metrics);
  updateTierHero(metrics, campus);
  updateForecastPanel(forecast, metrics);
  updateNarrative(metrics, campus, forecast);

  // Main chart
  destroyChart(state.charts.main);
  state.charts.main = createEmissionsBarChart(document.getElementById('carbonChart'), {
    series,
    baselineEmissions: metrics?.baselineEmissions ?? forecast.baselineEmissions,
    policy,
    forecast: forecast.error ? null : forecast
  });

  // Scope doughnut (campus only, when data exists)
  const scopePanel = document.getElementById('scopePanel');
  const scopeData = (!isSystem && metrics) ? getScopeBreakdown(campusId, metrics.latest.year) : null;
  if (scopePanel) {
    scopePanel.hidden = !scopeData;
    if (scopeData) {
      destroyChart(state.charts.scope);
      state.charts.scope = createScopeChart(document.getElementById('scopeChart'), { ...scopeData, year: metrics.latest.year });
    }
  }

  // Model chart only if details already open
  const details = document.querySelector('.forecast-details');
  if (details?.open) renderModelChart(state.currentForecast);

  renderStandings();
  renderTierLadderSection();
  renderCampusGrid();
}

function renderModelChart(forecast) {
  const panel = document.getElementById('modelChartPanel');
  if (!panel) return;
  if (!forecast || forecast.error || !forecast.models?.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  destroyChart(state.charts.model);
  state.charts.model = createModelComparisonChart(document.getElementById('modelChart'), { models: forecast.models });
}

/* ── KPI CARDS ── */
function changeMarkup(pct, goodWhenNegative = true) {
  if (pct == null || !Number.isFinite(pct)) return '';
  const good = goodWhenNegative ? pct <= 0 : pct >= 0;
  const cls = good ? 'up' : 'down';
  const arrow = pct <= 0 ? '↓' : '↑';
  return { html: `<span class="arrow">${arrow}</span> ${Math.abs(pct).toFixed(1)}%`, cls };
}

function setChange(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!data) { el.textContent = ''; el.className = 'metric-change'; return; }
  el.innerHTML = data.html;
  el.className = 'metric-change ' + data.cls;
}

function updateKpis(metrics, campus, forecast, series) {
  destroySparks();

  if (!metrics) {
    setText('kpiLatestVal', '...'); setText('kpiReductionVal', '...'); setText('kpiProjectedVal', '...');
    setChange('kpiLatestChange', null); setChange('kpiReductionChange', null); setChange('kpiProjectedChange', null);
    setText('kpiLatestContext', ''); setText('kpiReductionContext', ''); setText('kpiProjectedContext', '');
    return;
  }

  const { latest, baselineEmissions, pctFromBaseline, pctOfGoal } = metrics;
  const reported = series.filter(p => p.emissions != null);

  // Card 1: latest emissions, YoY change, plain-language equivalent
  setText('kpiLatestVal', formatEmissionsShort(latest.emissions));
  if (reported.length >= 2) {
    const prev = reported[reported.length - 2].emissions;
    const yoy = ((latest.emissions - prev) / prev) * 100;
    setChange('kpiLatestChange', changeMarkup(yoy, true));
  } else {
    setChange('kpiLatestChange', null);
  }
  setText('kpiLatestContext', emissionsEquivalentLabel(latest.emissions) ?? '');
  pushSpark('sparkLatest', reported.map(p => p.emissions), '#2FC4A0');

  // Card 2: change since 2019 (signed) + progress to goal, in plain words
  // Positive pctFromBaseline means emissions fell (good); negative means they rose.
  const cut = Math.round(pctFromBaseline);
  const absCut = Math.abs(cut);
  if (absCut === 0) {
    setText('kpiReductionVal', '~0%');
    setText('kpiReductionContext', 'About the same as in 2019');
  } else if (cut > 0) {
    setText('kpiReductionVal', `−${absCut}%`);
    setText('kpiReductionContext', `${absCut}% lower than in 2019`);
  } else {
    setText('kpiReductionVal', `+${absCut}%`);
    setText('kpiReductionContext', `${absCut}% higher than in 2019`);
  }
  const goalPct = Math.max(0, Math.round(pctOfGoal));
  setChange('kpiReductionChange', { html: `${goalPct}% of the way to goal`, cls: metrics.onTrack ? 'up' : 'down' });
  pushSpark('sparkReduction', reported.map(p => baselineEmissions - p.emissions), '#5B8DEF');

  // Card 3: projected 2045 + projected cut (clear headline)
  if (forecast && !forecast.error) {
    setText('kpiProjectedVal', formatEmissionsShort(forecast.projections[2045]));
    const projCut = forecast.projReductionPct;
    const el = document.getElementById('kpiProjectedChange');
    if (el && projCut != null) {
      el.innerHTML = `<span class="arrow">${projCut >= 0 ? '↓' : '↑'}</span> ${Math.abs(projCut)}% cut by 2045`;
      el.className = 'metric-change ' + (projCut > 0 ? 'up' : 'down');
    } else if (el) {
      el.textContent = '';
      el.className = 'metric-change';
    }
    setText('kpiProjectedContext', emissionsEquivalentLabel(forecast.projections[2045]) ?? '');
    pushSpark('sparkProjected', [latest.emissions, ...forecast.median], '#E2A04A');
  } else {
    setText('kpiProjectedVal', '...');
    setChange('kpiProjectedChange', null);
    setText('kpiProjectedContext', '');
  }
}

function pushSpark(id, values, color) {
  const chart = createSparkline(document.getElementById(id), { values, color });
  if (chart) state.charts.sparks.push(chart);
}

function destroySparks() {
  state.charts.sparks.forEach(destroyChart);
  state.charts.sparks = [];
}

function updatePace(metrics) {
  const paceEl = document.getElementById('paceIndicator');
  const badge = document.getElementById('verifiedBadge');
  if (badge && metrics) {
    const yr = metrics.latest.year;
    badge.textContent = metrics.latest.verified !== false ? `Verified · ${yr}` : `Reported · ${yr}`;
  }
  if (!paceEl) return;
  if (!metrics) { paceEl.hidden = true; return; }
  paceEl.hidden = false;
  const onTrack = metrics.gapToPace <= 0;
  paceEl.className = 'pace-indicator ' + (onTrack ? 'on-track' : 'behind');
  paceEl.innerHTML = onTrack
    ? `<span class="pace-dot"></span> Ahead of the pace needed for 2045`
    : `<span class="pace-dot"></span> Behind the pace needed for 2045`;
}

function updateForecastPanel(forecast, metrics) {
  const panel = document.getElementById('forecastPanel');
  if (!panel) return;
  if (forecast?.error) { panel.hidden = true; return; }
  panel.hidden = false;

  setText('forecastModel', forecast.primaryModel);
  setText('forecastR2', forecast.r2 != null ? forecast.r2.toFixed(2) : '...');
  setText('forecastRmse', forecast.loocvRmse != null ? '±' + Math.round(forecast.loocvRmse).toLocaleString() + ' t CO₂e' : '...');
  setText('forecast2030', formatEmissionsFull(forecast.projections[2030]));
  setText('forecast2045', formatEmissionsFull(forecast.projections[2045]));
  setText('forecastTarget', forecast.target2045 != null ? formatEmissionsFull(forecast.target2045) : '...');

  const cutEl = document.getElementById('forecastCut');
  const cutNote = document.getElementById('forecastCutNote');
  if (cutEl && forecast.projReductionPct != null) {
    const onTrack = forecast.onTrack2045 === true;
    cutEl.textContent = `${forecast.projReductionPct}%`;
    cutEl.className = 'forecast-value forecast-prob ' + (onTrack ? 'likely' : 'unlikely');
    if (cutNote) cutNote.textContent = onTrack ? `meets the ${forecast.goalReductionPct}% goal` : `goal is ${forecast.goalReductionPct}%`;
  } else if (cutEl) {
    cutEl.textContent = '...';
    cutEl.className = 'forecast-value forecast-prob';
    if (cutNote) cutNote.textContent = '';
  }

  const gapEl = document.getElementById('forecastGap');
  if (forecast.gap2045 != null) {
    const onTrack = forecast.gap2045 <= 0;
    gapEl.textContent = onTrack
      ? `room to spare, about ${formatEmissionsShort(Math.abs(forecast.gap2045))} under the goal`
      : `a gap of about ${formatEmissionsShort(forecast.gap2045)} still to close`;
    gapEl.className = 'forecast-gap ' + (onTrack ? 'on-track' : 'behind');
  }

  // What it would take: required annual reduction rate vs. realized pace
  const rateEl = document.getElementById('forecastRate');
  if (rateEl) {
    const policy = getPolicy();
    const target = forecast.target2045 ?? metrics?.targetEmissions;
    if (metrics && target != null) {
      const required = requiredAnnualRate(metrics.latest.emissions, metrics.latest.year, target, policy.targetYear);
      const realized = realizedAnnualRate(metrics.baselineEmissions, policy.baselineYear, metrics.latest.emissions, metrics.latest.year);
      if (required != null) {
        let txt = `Hitting it means cutting about <strong>${required.toFixed(1)}%/yr</strong> from ${metrics.latest.year} to ${policy.targetYear}`;
        if (realized != null) {
          txt += realized >= 0
            ? `. UC has averaged <strong>${realized.toFixed(1)}%/yr</strong> since ${policy.baselineYear}.`
            : `, but emissions have <em>risen</em> about <strong>${Math.abs(realized).toFixed(1)}%/yr</strong> since ${policy.baselineYear}.`;
        } else {
          txt += '.';
        }
        rateEl.innerHTML = txt;
        rateEl.hidden = false;
      } else {
        rateEl.hidden = true;
      }
    } else {
      rateEl.hidden = true;
    }
  }

  const tbody = document.getElementById('modelTableBody');
  if (tbody && forecast.models) {
    const sorted = [...forecast.models].sort((a, b) => a.loocvRmse - b.loocvRmse);
    tbody.innerHTML = sorted.map((m, i) => `
      <tr class="${i === 0 ? 'best-model' : ''}">
        <td>${m.name}${i === 0 ? ' <span class="best-tag">Used</span>' : ''}</td>
        <td class="mono">${m.r2.toFixed(2)}</td>
        <td class="mono">±${Math.round(m.rmse).toLocaleString()}</td>
        <td class="mono">±${Math.round(m.loocvRmse).toLocaleString()}</td>
      </tr>`).join('');
  }

  const note = document.getElementById('ensembleNote');
  if (note) note.hidden = !forecast.ensemble;
}

function updateNarrative(metrics, campus, forecast) {
  const note = document.getElementById('carbonNote');
  if (!note) return;
  const name = campus?.shortName ?? 'The UC system';
  const policy = getPolicy();

  if (!metrics && forecast?.error) {
    note.textContent = `Not enough verified data to compute progress for ${name}.`;
    return;
  }

  let text = '';
  if (metrics) {
    const { latest, targetEmissions, pctFromBaseline } = metrics;
    const equiv = emissionsEquivalentLabel(latest.emissions);
    text = `<strong>${name}</strong> reported ${formatEmissionsFull(latest.emissions)} in ${latest.year}` +
      `${equiv ? ` (${equiv})` : ''}. ${formatPercent(Math.abs(pctFromBaseline))} ${pctFromBaseline >= 0 ? 'below' : 'above'} the ${policy.baselineYear} baseline. ` +
      `The 2045 goal is ${formatEmissionsFull(targetEmissions)}. `;
  }
  if (forecast && !forecast.error) {
    text += forecast.onTrack2045
      ? `If the trend holds, that points to about ${formatEmissionsFull(forecast.projections[2045])} by 2045, within reach of the goal.`
      : `If the trend holds, that points to about ${formatEmissionsFull(forecast.projections[2045])} by 2045. ${formatEmissionsShort(Math.abs(forecast.gap2045))} ${forecast.gap2045 > 0 ? 'short of' : 'past'} the goal.`;
  }
  note.innerHTML = text;
}

/* ── TIER HERO ── */
function updateTierHero(metrics, campus) {
  const hero = document.getElementById('tierHero');
  if (!hero) return;

  if (!metrics) {
    hero.hidden = true;
    return;
  }
  hero.hidden = false;

  const tier = getTier(metrics.pctOfGoal);
  const prog = tierProgress(metrics.pctOfGoal, tier);
  const undergrad = getAllCampusMetrics(computeCampusMetrics);
  const ranked = [...undergrad].sort((a, b) => b.metrics.pctOfGoal - a.metrics.pctOfGoal);
  const rankIdx = ranked.findIndex(i => i.campus.id === state.selectedCampusId);

  const shieldEl = document.getElementById('tierShield');
  if (shieldEl) {
    shieldEl.innerHTML = renderShield(tier.material, tier.level, { size: 88, title: tier.label });
  }

  setText('tierTitle', tier.title);
  setText('tierTagline', tier.tagline);
  setText('tierLabel', tier.label);
  setText('tierGoalPct', `${Math.round(metrics.pctOfGoal)}% toward 2045 goal`);

  const rankEl = document.getElementById('tierRank');
  if (rankEl) {
    if (state.selectedCampusId === 'systemwide') {
      rankEl.textContent = `Systemwide across ${undergrad.length} campuses`;
    } else if (rankIdx >= 0) {
      rankEl.textContent = `#${rankIdx + 1} of ${ranked.length} campuses`;
    } else {
      rankEl.textContent = '';
    }
  }

  const fill = document.getElementById('tierProgressFill');
  const bar = document.getElementById('tierProgressBar');
  if (fill) fill.style.width = `${Math.round(prog * 100)}%`;
  if (bar) {
    bar.setAttribute('aria-valuenow', String(Math.round(prog * 100)));
    bar.setAttribute('aria-label', tierProgressLabel(metrics.pctOfGoal, { onTrack: metrics.onTrack }));
  }
  setText('tierProgressLabel', tierProgressLabel(metrics.pctOfGoal, { onTrack: metrics.onTrack }));

  const starsNote = document.getElementById('tierStarsNote');
  if (starsNote && campus?.stars) {
    starsNote.textContent = `Also holds STARS ${campus.stars}. UC's separate sustainability rating.`;
    starsNote.hidden = false;
  } else if (starsNote) {
    starsNote.hidden = true;
  }
}

function renderTierLadderSection() {
  const el = document.getElementById('tierLadder');
  if (!el) return;
  const items = getAllCampusMetrics(computeCampusMetrics);
  el.innerHTML = renderTierLadder(items, state.selectedCampusId === 'systemwide' ? null : state.selectedCampusId);

  el.querySelectorAll('.tier-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const cell = dot.closest('.tier-ladder-cell');
      const tierId = cell?.dataset.tier;
      const match = items.find(i => getTier(i.metrics.pctOfGoal).id === tierId && dot.title === i.campus.shortName);
      if (match) selectCampus(match.campus.id, true);
    });
  });

  el.querySelectorAll('.tier-ladder-cell.has-campus').forEach(cell => {
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      const tierId = cell.dataset.tier;
      const occupants = items.filter(i => getTier(i.metrics.pctOfGoal).id === tierId);
      if (occupants.length === 1) selectCampus(occupants[0].campus.id, true);
    });
  });
}

/* ── CAMPUS STANDINGS (side list) ── */
function renderStandings() {
  const list = document.getElementById('standingsList');
  if (!list) return;
  const items = getAllCampusMetrics(computeCampusMetrics)
    .filter(i => i.campus.id !== 'systemwide')
    .sort((a, b) => b.metrics.pctOfGoal - a.metrics.pctOfGoal);

  list.innerHTML = items.map(({ campus, metrics }) => {
    const ch = changeMarkup(-metrics.pctFromBaseline, true);
    const tier = getTier(metrics.pctOfGoal);
    const shield = renderShield(tier.material, tier.level, { size: 26, title: tier.label });
    return `
      <div class="list-row tier-list-row" data-campus="${campus.id}" role="button" tabindex="0">
        <span class="list-tier">${shield}</span>
        <span class="list-campus"><span class="list-dot" style="background:${campus.color}"></span>${campus.shortName}</span>
        <span class="list-val">${formatEmissionsShort(metrics.latest.emissions)}</span>
        <span class="list-change ${ch ? ch.cls : ''}">${ch ? ch.html : '...'}</span>
      </div>`;
  }).join('');

  list.querySelectorAll('.list-row').forEach(row => {
    const go = () => selectCampus(row.dataset.campus, true);
    row.addEventListener('click', go);
    row.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}

function renderCampusGrid() {
  const grid = document.getElementById('campusGrid');
  if (!grid) return;
  const items = getAllCampusMetrics(computeCampusMetrics);

  grid.innerHTML = items.map(({ campus, metrics }) => {
    const active = campus.id === state.selectedCampusId ? ' active' : '';
    const onTrack = metrics.gapToPace <= 0;
    const forecast = buildForecast(getEmissionsSeries(campus.id), getPolicy());
    const proj2045 = !forecast.error ? formatEmissionsShort(forecast.projections[2045]) : null;
    const tier = getTier(metrics.pctOfGoal);
    const tierShield = renderShield(tier.material, tier.level, { size: 36, title: tier.label });
    const banner = bannerFor(campus.id);
    const bannerMarkup = banner
      ? `<img class="campus-card-banner-img" src="${banner}" alt="${campus.shortName} campus" loading="lazy">`
      : `<div class="campus-card-banner-fallback" style="background:linear-gradient(135deg, ${campus.color}, #19222F)"></div>`;
    return `
      <button class="campus-card${active}" data-campus="${campus.id}" type="button" aria-pressed="${campus.id === state.selectedCampusId}">
        <div class="campus-card-banner">
          ${bannerMarkup}
          <span class="campus-card-accent" style="background:${campus.color}"></span>
        </div>
        <div class="campus-card-tier" title="${tier.title} · ${tier.label}">${tierShield}</div>
        <div class="campus-card-body">
          <div class="campus-card-top">
            <span class="campus-card-name">${campus.shortName}</span>
            ${campus.stars ? `<span class="campus-card-stars">STARS ${campus.stars}</span>` : ''}
          </div>
          <div class="campus-card-emissions">${formatEmissionsShort(metrics.latest.emissions)}</div>
          <div class="campus-card-meta">${tier.title} · ${formatPercent(metrics.pctOfGoal)} to goal${proj2045 ? ' · 2045 ≈ ' + proj2045 : ''}</div>
          <div class="campus-card-progress">
            <div class="campus-card-progress-fill ${onTrack ? 'on-track' : 'behind'}" style="width:${Math.min(100, Math.max(0, metrics.pctOfGoal))}%"></div>
          </div>
        </div>
      </button>`;
  }).join('');

  grid.querySelectorAll('.campus-card').forEach(card => {
    card.addEventListener('click', () => selectCampus(card.dataset.campus, false));
  });
}

function selectCampus(id, scroll) {
  state.selectedCampusId = id;
  const select = document.getElementById('campusSelect');
  if (select) select.value = id;
  location.hash = id;
  renderDashboard();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

document.getElementById('exportBtn')?.addEventListener('click', async () => {
  const { exportEmissionsCSV } = await import('./data.js');
  const blob = new Blob([exportEmissionsCSV()], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'uc_emissions.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

init();
