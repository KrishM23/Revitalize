/* Carbon Trackers | compare page */

import { loadData, getAllCampusMetrics, getDataFreshness } from './data.js';
import { computeCampusMetrics, formatEmissionsShort, formatPercent, perCapita } from './analytics.js';
import { buildForecast } from './forecast.js';
import { createComparisonChart, destroyChart } from './charts.js';
import { getTier, renderShield } from './tiers.js';
import { renderGlossaryPopups, setupGlossaryTips } from './glossary.js';

let chart = null;

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

function render() {
  const items = getAllCampusMetrics(computeCampusMetrics).map(item => ({
    ...item,
    forecast: buildForecast(item.series)
  }));

  const sorted = [...items].sort((a, b) => b.metrics.latest.emissions - a.metrics.latest.emissions);

  destroyChart(chart);
  chart = createComparisonChart(document.getElementById('compareChart'), { items });

  const tbody = document.getElementById('compareTableBody');
  tbody.innerHTML = sorted.map(({ campus, metrics, forecast }) => {
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

  document.getElementById('compareCount').textContent = sorted.length;
  const fresh = getDataFreshness();
  document.getElementById('compareYear').textContent = fresh.latestYear ?? sorted[0]?.metrics.latest.year ?? '...';
}

init();
