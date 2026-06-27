/* Carbon Trackers | compare page */

import { loadData, getAllCampusMetrics, getDataFreshness } from './data.js';
import { computeCampusMetrics, formatEmissionsShort, formatPercent, perCapita } from './analytics.js';
import { buildForecast } from './forecast.js';
import { createComparisonChart, destroyChart } from './charts.js';
import { getTier, renderShield } from './tiers.js';
import { renderGlossaryPopups, setupGlossaryTips } from './glossary.js';
import { initSourcesDrawer } from './sources.js';

let chart = null;
let allItems = [];
let sortBy = 'emissions';
let filterBy = 'all';

async function init() {
  if (typeof Chart === 'undefined') {
    const fb = document.getElementById('compareFallback');
    if (fb) { fb.textContent = 'Chart.js failed to load.'; fb.hidden = false; }
    return;
  }
  try {
    await loadData();
    const popupHost = document.getElementById('glossaryPopups');
    if (popupHost) {
      popupHost.innerHTML = renderGlossaryPopups([
        'goal-2045', 'scope-1', 'scope-2', 'scope-3', 'climate-tier', 'goal-progress'
      ]);
    }
    setupGlossaryTips();
    initSourcesDrawer({ getContext: () => ({ page: 'Compare campuses' }) });
    setupFilters();
    render();
  } catch (err) {
    console.error(err);
    const fb = document.getElementById('compareFallback');
    if (fb) {
      fb.textContent = 'Could not load data. Serve this folder over HTTP: python3 -m http.server 8080';
      fb.hidden = false;
    }
  }
}

function setupFilters() {
  document.getElementById('compareSort')?.addEventListener('change', e => {
    sortBy = e.target.value;
    renderTable();
    renderChart();
  });
  document.getElementById('compareFilter')?.addEventListener('change', e => {
    filterBy = e.target.value;
    renderTable();
    renderChart();
  });
}

function getVisibleItems() {
  let items = [...allItems];
  if (filterBy === 'on-track') items = items.filter(i => i.metrics.onTrack);
  if (filterBy === 'behind') items = items.filter(i => !i.metrics.onTrack);

  switch (sortBy) {
    case 'goal':
      return items.sort((a, b) => b.metrics.pctOfGoal - a.metrics.pctOfGoal);
    case 'gap':
      return items.sort((a, b) => {
        const ga = a.forecast.error ? -Infinity : (a.forecast.gap2045 ?? 0);
        const gb = b.forecast.error ? -Infinity : (b.forecast.gap2045 ?? 0);
        return gb - ga;
      });
    case 'progress':
      return items.sort((a, b) => b.metrics.pctFromBaseline - a.metrics.pctFromBaseline);
    case 'percap':
      return items.sort((a, b) => {
        const pa = perCapita(a.metrics.latest.emissions, a.campus.enrollment) ?? 0;
        const pb = perCapita(b.metrics.latest.emissions, b.campus.enrollment) ?? 0;
        return pb - pa;
      });
    case 'name':
      return items.sort((a, b) => a.campus.name.localeCompare(b.campus.name));
    default:
      return items.sort((a, b) => b.metrics.latest.emissions - a.metrics.latest.emissions);
  }
}

function render() {
  allItems = getAllCampusMetrics(computeCampusMetrics).map(item => ({
    ...item,
    forecast: buildForecast(item.series)
  }));
  renderChart();
  renderTable();
  const fresh = getDataFreshness();
  document.getElementById('compareYear').textContent = fresh.latestYear ?? allItems[0]?.metrics.latest.year ?? '...';
}

function renderChart() {
  const items = getVisibleItems();
  destroyChart(chart);
  chart = createComparisonChart(document.getElementById('compareChart'), { items });
  document.getElementById('compareCount').textContent = allItems.length;
  const note = document.getElementById('compareFilterNote');
  if (note) {
    note.textContent = items.length !== allItems.length ? `Showing ${items.length} of ${allItems.length}` : '';
  }
}

function renderTable() {
  const items = getVisibleItems();
  const tbody = document.getElementById('compareTableBody');
  tbody.innerHTML = items.map(({ campus, metrics, forecast }) => {
    const pc = perCapita(metrics.latest.emissions, campus.enrollment);
    const tier = getTier(metrics.pctOfGoal);
    const shield = renderShield(tier.material, tier.level, { size: 30, title: `${tier.title} (${tier.label})` });
    return `
      <tr>
        <td class="strong-cell"><span class="campus-dot" style="background:${campus.color}"></span>${campus.name}</td>
        <td class="tier-col" title="${tier.tagline}">${shield}</td>
        <td class="mono">${formatEmissionsShort(metrics.latest.emissions)}</td>
        <td class="mono">${metrics.latest.year}</td>
        <td class="mono">${formatEmissionsShort(metrics.baselineEmissions)}</td>
        <td class="mono">${formatEmissionsShort(metrics.targetEmissions)}</td>
        <td class="mono">${!forecast.error ? formatEmissionsShort(forecast.projections[2045]) : '...'}</td>
        <td class="mono">${formatPercent(metrics.pctFromBaseline)}</td>
        <td class="mono">${formatPercent(metrics.pctOfGoal)}</td>
        <td class="mono">${!forecast.error && forecast.projReductionPct != null ? forecast.projReductionPct + '%' : '...'}</td>
        <td class="mono">${pc ? pc.toLocaleString() + ' t' : '...'}</td>
        <td><span class="status-pill ${metrics.onTrack ? 'on-track' : 'behind'}">${metrics.onTrack ? 'On pace' : 'Behind'}</span></td>
      </tr>`;
  }).join('');
}

init();
