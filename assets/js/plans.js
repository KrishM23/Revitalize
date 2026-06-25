/* Revitalize | suggested plans page */

import {
  loadData,
  getCampuses,
  getEmissionsSeries,
  getScopeBreakdown,
  getPolicy,
  getDataFreshness
} from './data.js';
import {
  computeCampusMetrics,
  formatEmissionsShort,
  formatPercent,
  fmtFixed,
  emissionsEquivalentLabel
} from './analytics.js';
import { buildForecast } from './forecast.js';
import { getTier } from './tiers.js';
import {
  buildCampusPlan,
  renderPlanAction,
  renderInitiative
} from './campus-plans.js';
import { glossaryBtn, renderGlossaryPopups, setupGlossaryTips } from './glossary.js';
import { downloadCampusPlanCsv } from './plan-export.js';

let selectedId = 'berkeley';
let exportState = null;

async function init() {
  try {
    await loadData();
    setupSelector();
    setupPrint();
    setupDownload();
    setupGlossaryHost();
    setupFromHash();
    render();
    window.addEventListener('hashchange', setupFromHash);
  } catch (err) {
    console.error(err);
    document.getElementById('plansContent').innerHTML =
      '<p class="chart-fallback">Could not load plan data. Serve this folder over HTTP.</p>';
  }
}

function setupSelector() {
  const select = document.getElementById('plansCampusSelect');
  if (!select) return;
  const campuses = getCampuses().filter(c => c.type !== 'graduate' || c.id === 'ucsf');
  select.innerHTML = campuses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  select.value = selectedId;
  select.addEventListener('change', e => {
    selectedId = e.target.value;
    location.hash = selectedId;
    render();
  });
}

function setupPrint() {
  const btn = document.getElementById('printPlanBtn');
  if (btn) btn.addEventListener('click', () => window.print());
}

function setupDownload() {
  const btn = document.getElementById('downloadPlanBtn');
  if (btn) btn.addEventListener('click', () => {
    if (exportState) downloadCampusPlanCsv(exportState);
  });
}

function setupGlossaryHost() {
  const host = document.getElementById('glossaryPopups');
  if (!host) return;
  host.innerHTML = renderGlossaryPopups([
    't-co2e', 'baseline-2019', 'goal-2045', 'annual-cut',
    'scope-1', 'scope-2', 'scope-3', 'climate-tier', 'goal-progress'
  ]);
}

function refreshGlossaryTips() {
  setupGlossaryTips(document.getElementById('plansContent') ?? document);
}

function setupFromHash() {
  const id = location.hash.replace('#', '');
  const campuses = getCampuses();
  if (id && campuses.some(c => c.id === id)) {
    selectedId = id;
    const select = document.getElementById('plansCampusSelect');
    if (select) select.value = id;
    render();
  }
}

function render() {
  const campus = getCampuses().find(c => c.id === selectedId);
  const policy = getPolicy();
  const series = getEmissionsSeries(selectedId);
  const metrics = computeCampusMetrics(series, policy);
  const forecast = buildForecast(series, policy);
  const scopeData = metrics ? getScopeBreakdown(selectedId, metrics.latest.year) : null;
  const plan = buildCampusPlan({ campus, metrics, forecast, scopeData, policy });
  const root = document.getElementById('plansContent');
  const fresh = getDataFreshness();

  if (!plan || !campus || !metrics) {
    root.innerHTML = '<p class="chart-fallback">Not enough data to build a plan for this campus.</p>';
    return;
  }

  const tier = getTier(metrics.pctOfGoal);
  const equiv = emissionsEquivalentLabel(metrics.latest.emissions);
  const paceClass = plan.onTrack ? 'on-track' : 'behind';
  const paceText = plan.onTrack ? 'On track for 2045' : 'Needs a faster pace';

  const baselineDelta = plan.pctFromBaseline;
  const baselineText = Math.abs(baselineDelta) < 0.5
    ? 'About the same as 2019'
    : `${formatPercent(Math.abs(baselineDelta), 0)} ${baselineDelta >= 0 ? 'lower than 2019' : 'higher than 2019'}`;

  document.getElementById('plansTitle').textContent = `${campus.name} action plan`;
  document.getElementById('plansSubtitle').textContent =
    `Campus-specific recommendations from ${metrics.latest.year} emissions data · ${campus.region}`;

  exportState = { campus, plan, metrics, tier, fresh };

  root.innerHTML = `
    <section class="panel plans-hero">
      <div class="plans-hero-grid">
        <div>
          <p class="plans-kicker">Recommended path</p>
          <h2>${plan.summary}</h2>
          <div class="plans-hero-meta">
            <span class="status-pill ${paceClass}">${paceText}</span>
            <span class="plans-tier-pill">${tier.title} · ${tier.label}</span>
          </div>
        </div>
        <div class="plans-stats">
          <div class="plans-stat">
            <span class="plans-stat-label">Latest emissions ${glossaryBtn('t-co2e')}</span>
            <span class="plans-stat-val">${formatEmissionsShort(metrics.latest.emissions)}</span>
            <span class="plans-stat-sub">${equiv ?? ''}</span>
          </div>
          <div class="plans-stat">
            <span class="plans-stat-label">Change since 2019 ${glossaryBtn('baseline-2019')}</span>
            <span class="plans-stat-val">${baselineText}</span>
            <span class="plans-stat-sub">${formatPercent(plan.pctOfGoal, 0)} of the way to the 2045 goal ${glossaryBtn('goal-progress')}</span>
          </div>
          <div class="plans-stat">
            <span class="plans-stat-label">Cuts needed each year ${glossaryBtn('annual-cut')}</span>
            <span class="plans-stat-val">${plan.required != null ? fmtFixed(plan.required) + '% / yr' : '...'}</span>
            <span class="plans-stat-sub">${plan.realized != null ? `${fmtFixed(plan.realized)}% / yr achieved since 2019` : ''}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="panel plans-legend" aria-label="How emissions are grouped">
      <p class="plans-legend-title">How emissions are grouped</p>
      <div class="plans-legend-grid">
        <div class="plans-legend-item">
          <span class="plan-scope scope-1">Scope 1 ${glossaryBtn('scope-1')}</span>
          <p>Fuel burned on campus, such as gas heating and boilers.</p>
        </div>
        <div class="plans-legend-item">
          <span class="plan-scope scope-2">Scope 2 ${glossaryBtn('scope-2')}</span>
          <p>Electricity the campus buys from the grid.</p>
        </div>
        <div class="plans-legend-item">
          <span class="plan-scope scope-3">Scope 3 ${glossaryBtn('scope-3')}</span>
          <p>Indirect sources like commuting, air travel, and purchased goods.</p>
        </div>
      </div>
    </section>

    ${plan.phases.map((phase, i) => `
      <section class="panel plans-phase" aria-label="${phase.title}">
        <div class="panel-head">
          <div class="plans-phase-head">
            <span class="plans-phase-num">${i + 1}</span>
            <div>
              <h3>${phase.title} <span class="plans-phase-range">${phase.label}</span></h3>
              <p class="panel-sub">${phase.sub}</p>
            </div>
          </div>
        </div>
        <div class="plans-grid">${phase.items.map(renderPlanAction).join('')}</div>
      </section>
    `).join('')}

    <section class="panel plans-spotlight">
      <div class="panel-head">
        <div>
          <h3>Already underway at ${campus.shortName}</h3>
          <p class="panel-sub">Real initiatives from UC's latest sustainability report, with campus context.</p>
        </div>
        ${campus.reportUrl ? `<a class="btn-secondary" href="${campus.reportUrl}" target="_blank" rel="noopener">UC report →</a>` : ''}
      </div>
      <div class="plans-initiatives">${plan.initiatives.map(renderInitiative).join('')}</div>
    </section>

    <p class="plans-disclaimer">Plans are based on verified UC emissions data (${fresh.latestYear ?? metrics.latest.year}) and published campus sustainability initiatives. They summarize possible next steps and are not official UC policy documents.</p>
  `;

  refreshGlossaryTips();
}

init();
