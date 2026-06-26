/* Revitalize | what-if simulator page (build-once shell, live updates) */

import {
  loadData,
  getCampuses,
  getEmissionsSeries,
  getScopeBreakdown,
  getPolicy
} from './data.js';
import {
  computeCampusMetrics,
  formatEmissionsShort
} from './analytics.js';
import { buildForecast } from './forecast.js';
import {
  LEVER_DEFS,
  SCENARIO_PRESETS,
  DEFAULT_LEVERS,
  runScenario,
  scenarioSummary
} from './scenarios.js';
import { createScenarioChart, updateScenarioChart, destroyChart } from './charts.js';
import { glossaryBtn, renderGlossaryPopups, setupGlossaryTips } from './glossary.js';
import { SCOPE_LABELS } from './campus-plans.js';

let selectedId = 'berkeley';
let levers = { ...DEFAULT_LEVERS };
let activePreset = 'status-quo';
let chart = null;
let ctx = null; // current campus context

async function init() {
  if (typeof Chart === 'undefined') {
    showFallback('Chart library failed to load. Check your connection and refresh.');
    return;
  }
  try {
    // Guard against a hung dev server so the page never sticks on "Loading".
    await Promise.race([
      loadData(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    setupGlossaryHost();
    setupSelector();
    readHash();
    buildPage();
    window.addEventListener('hashchange', () => { readHash(); buildPage(); });
  } catch (err) {
    console.error(err);
    showFallback(
      err.message === 'timeout'
        ? 'Data is taking too long to load. Make sure you are running a local server (./serve.sh) and refresh.'
        : 'Could not load simulator data. Run a local server (./serve.sh) and open http://localhost:8080.'
    );
  }
}

function showFallback(msg) {
  const root = document.getElementById('simContent');
  if (root) root.innerHTML = `<p class="chart-fallback">${msg}</p>`;
}

function setupGlossaryHost() {
  const host = document.getElementById('glossaryPopups');
  if (host) {
    host.innerHTML = renderGlossaryPopups([
      'goal-2045', 'projected', 'scope-1', 'scope-2', 'scope-3'
    ]);
  }
}

function setupSelector() {
  const select = document.getElementById('simCampusSelect');
  if (!select) return;
  const campuses = getCampuses().filter(c => c.type !== 'graduate' || c.id === 'ucsf');
  select.innerHTML = campuses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  select.value = selectedId;
  select.addEventListener('change', e => {
    selectedId = e.target.value;
    location.hash = selectedId;
    resetLevers();
    buildPage();
  });
}

function readHash() {
  const id = location.hash.replace('#', '');
  if (id && getCampuses().some(c => c.id === id)) {
    selectedId = id;
    const select = document.getElementById('simCampusSelect');
    if (select) select.value = id;
  }
}

function resetLevers() {
  levers = { ...DEFAULT_LEVERS };
  activePreset = 'status-quo';
}

/* ── Build the page shell once per campus ── */
function buildPage() {
  const campus = getCampuses().find(c => c.id === selectedId);
  const policy = getPolicy();
  const series = getEmissionsSeries(selectedId);
  const metrics = computeCampusMetrics(series, policy);
  const forecast = buildForecast(series, policy);
  const scopeData = metrics ? getScopeBreakdown(selectedId, metrics.latest.year) : null;

  if (!campus || !metrics || forecast?.error) {
    showFallback('Not enough data to run scenarios for this campus yet.');
    return;
  }

  ctx = { campus, policy, series, metrics, forecast, scopeData };

  document.getElementById('simTitle').textContent = `${campus.name} what-if simulator`;
  document.getElementById('simSubtitle').textContent =
    `Drag the sliders to see how big changes would bend ${campus.shortName ?? campus.name}'s path to 2045.`;
  const planLink = document.getElementById('simPlanLink');
  if (planLink) planLink.href = `plans.html#${campus.id}`;

  const root = document.getElementById('simContent');
  root.innerHTML = `
    <div class="sim-layout">
      <section class="panel sim-controls" aria-label="Scenario controls">
        <p class="sim-controls-title">Try a scenario</p>
        <div class="sim-presets" role="group" aria-label="Scenario presets">
          ${SCENARIO_PRESETS.map(p => `
            <button type="button" class="sim-preset" data-preset="${p.id}" title="${p.desc}">${p.label}</button>
          `).join('')}
        </div>

        <div class="sim-levers">
          ${LEVER_DEFS.map(renderLever).join('')}
        </div>

        ${renderScopeMix(scopeData, metrics.latest.emissions)}

        <button type="button" class="btn-secondary sim-reset" id="simReset">Reset</button>
      </section>

      <div class="sim-results">
        <section class="panel sim-hero">
          <div class="sim-hero-top">
            <p class="sim-kicker">Projected for 2045 ${glossaryBtn('projected')}</p>
            <span class="status-pill" id="simStatus">...</span>
          </div>

          <div class="sim-headline">
            <span class="sim-headline-val" id="simScenarioVal">...</span>
            <span class="sim-headline-unit">t CO₂e</span>
            <span class="sim-headline-delta" id="simDelta"></span>
          </div>
          <p class="sim-summary" id="simSummary">...</p>

          <div class="sim-bars" id="simBars">
            <div class="sim-bar-row">
              <span class="sim-bar-label">Current trend ${glossaryBtn('projected')}</span>
              <div class="sim-bar-track"><div class="sim-bar-fill trend" id="barTrend"></div></div>
              <span class="sim-bar-val" id="valTrend">...</span>
            </div>
            <div class="sim-bar-row">
              <span class="sim-bar-label">Your scenario</span>
              <div class="sim-bar-track"><div class="sim-bar-fill scenario" id="barScenario"></div></div>
              <span class="sim-bar-val" id="valScenario">...</span>
            </div>
            <div class="sim-bar-row">
              <span class="sim-bar-label">2045 goal ${glossaryBtn('goal-2045')}</span>
              <div class="sim-bar-track"><div class="sim-bar-fill goal" id="barGoal"></div></div>
              <span class="sim-bar-val" id="valGoal">...</span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>How the path changes</h3>
              <p class="panel-sub">Reported data, the current trend, and your scenario through 2045.</p>
            </div>
          </div>
          <div class="sim-chart-area">
            <canvas id="simChart"></canvas>
          </div>
        </section>
      </div>
    </div>
  `;

  bindControls();
  setupGlossaryTips(root);
  syncControlUI();

  const firstResult = compute();
  destroyChart(chart);
  chart = createScenarioChart(document.getElementById('simChart'), { series, policy, result: firstResult });
  paint(firstResult);
}

function renderLever(def) {
  const scopeClass = def.scope ? `scope-${def.scope}` : 'scope-all';
  const value = levers[def.id] ?? def.default;
  const displayVal = def.unit ? `${value}${def.unit}` : `${value}%`;
  return `
    <div class="sim-lever" data-lever="${def.id}">
      <div class="sim-lever-head">
        <label class="sim-lever-label" for="lever-${def.id}">
          ${def.scope ? `<span class="plan-scope ${scopeClass}">Scope ${def.scope}</span>` : ''}
          ${def.label}
        </label>
        <output class="sim-lever-val" id="out-${def.id}" for="lever-${def.id}">${displayVal}</output>
      </div>
      <input type="range" class="sim-slider" id="lever-${def.id}"
        min="${def.min}" max="${def.max}" step="${def.step}" value="${value}"
        aria-label="${def.label}">
      <p class="sim-lever-sub">${def.sub}</p>
    </div>`;
}

function renderScopeMix(scopeData, total) {
  if (!scopeData || !total) return '';
  const shares = [1, 2, 3].map(scope => ({
    scope,
    pct: (scopeData[`scope${scope}`] / total) * 100
  }));
  return `
    <div class="sim-scope-mix">
      <p class="sim-scope-mix-title">This campus's emissions today</p>
      <div class="sim-scope-bars">
        ${shares.map(s => `
          <div class="sim-scope-bar scope-${s.scope}" style="width:${Math.max(s.pct, 6)}%" title="Scope ${s.scope}: ${Math.round(s.pct)}%">
            <span>${Math.round(s.pct)}%</span>
          </div>`).join('')}
      </div>
      <div class="sim-scope-legend">
        ${shares.map(s => `<span><i class="lg scope-${s.scope}"></i> ${SCOPE_LABELS[s.scope]}</span>`).join('')}
      </div>
    </div>`;
}

/* ── Compute current scenario ── */
function compute() {
  return runScenario({
    forecast: ctx.forecast,
    scopeData: ctx.scopeData,
    metrics: ctx.metrics,
    policy: ctx.policy,
    levers
  });
}

/* ── Paint numbers + bars (fast, no DOM rebuild) ── */
function paint(result) {
  if (!result) return;
  const { campus } = ctx;

  const scen = document.getElementById('simScenarioVal');
  if (scen) scen.textContent = formatEmissionsShort(result.scenario2045);

  const status = document.getElementById('simStatus');
  if (status) {
    status.textContent = result.onTrackScenario ? 'Reaches 2045 goal' : 'Still short of goal';
    status.className = `status-pill ${result.onTrackScenario ? 'on-track' : 'behind'}`;
  }

  const delta = document.getElementById('simDelta');
  if (delta) {
    if (result.improvement > 500) {
      delta.textContent = `↓ ${formatEmissionsShort(result.improvement)} vs current trend`;
      delta.className = 'sim-headline-delta good';
    } else {
      delta.textContent = 'Same as current trend';
      delta.className = 'sim-headline-delta';
    }
  }

  const summary = document.getElementById('simSummary');
  if (summary) summary.textContent = scenarioSummary(result, campus);

  // Comparison bars scaled to the largest of trend / scenario / goal.
  const maxVal = Math.max(result.baseline2045, result.scenario2045, result.target2045, 1);
  const setBar = (barId, valId, value, gap) => {
    const bar = document.getElementById(barId);
    const val = document.getElementById(valId);
    if (bar) bar.style.width = `${Math.max((value / maxVal) * 100, 2)}%`;
    if (val) val.textContent = formatEmissionsShort(value);
  };
  setBar('barTrend', 'valTrend', result.baseline2045);
  setBar('barScenario', 'valScenario', result.scenario2045);
  setBar('barGoal', 'valGoal', result.target2045);

  updateScenarioChart(chart, result);
}

/* ── Controls ── */
function bindControls() {
  document.querySelectorAll('.sim-slider').forEach(input => {
    input.addEventListener('input', () => {
      const id = input.closest('[data-lever]')?.dataset.lever;
      if (!id) return;
      levers[id] = Number(input.value);
      const def = LEVER_DEFS.find(d => d.id === id);
      const out = document.getElementById(`out-${id}`);
      if (out && def) out.textContent = def.unit ? `${input.value}${def.unit}` : `${input.value}%`;
      activePreset = '';
      markActivePreset();
      paint(compute());
    });
  });

  document.querySelectorAll('.sim-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = SCENARIO_PRESETS.find(p => p.id === btn.dataset.preset);
      if (!preset) return;
      levers = { ...preset.levers };
      activePreset = preset.id;
      syncControlUI();
      paint(compute());
    });
  });

  const reset = document.getElementById('simReset');
  if (reset) reset.addEventListener('click', () => {
    resetLevers();
    syncControlUI();
    paint(compute());
  });
}

function markActivePreset() {
  document.querySelectorAll('.sim-preset').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === activePreset);
  });
}

/* Sync slider positions + outputs to the current levers (after preset/reset). */
function syncControlUI() {
  LEVER_DEFS.forEach(def => {
    const value = levers[def.id] ?? def.default;
    const input = document.getElementById(`lever-${def.id}`);
    const out = document.getElementById(`out-${def.id}`);
    if (input) input.value = value;
    if (out) out.textContent = def.unit ? `${value}${def.unit}` : `${value}%`;
  });
  markActivePreset();
}

init();
