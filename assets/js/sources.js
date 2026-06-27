/* Revitalize | "Where does this come from?" sources drawer */

import { getPolicy, getDataFreshness } from './data.js';

let getContext = () => ({});
let bound = false;

const DRAWER_HTML = `
<div class="sources-overlay" id="sourcesOverlay" hidden></div>
<aside class="sources-drawer" id="sourcesDrawer" hidden aria-labelledby="sourcesTitle" role="dialog" aria-modal="true">
  <div class="sources-drawer-head">
    <h2 id="sourcesTitle">Where this comes from</h2>
    <button type="button" class="sources-close" id="sourcesClose" aria-label="Close sources panel">×</button>
  </div>
  <div class="sources-drawer-body" id="sourcesBody"></div>
</aside>`;

export function initSourcesDrawer({ getContext: ctxFn, buttonId = 'sourcesBtn' } = {}) {
  if (ctxFn) getContext = ctxFn;

  if (!document.getElementById('sourcesDrawer')) {
    document.body.insertAdjacentHTML('beforeend', DRAWER_HTML);
  }

  if (!bound) {
    bound = true;
    document.getElementById('sourcesClose')?.addEventListener('click', closeSourcesDrawer);
    document.getElementById('sourcesOverlay')?.addEventListener('click', closeSourcesDrawer);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSourcesDrawer();
    });
  }

  const btn = document.getElementById(buttonId);
  if (btn && !btn.dataset.sourcesBound) {
    btn.dataset.sourcesBound = '1';
    btn.addEventListener('click', openSourcesDrawer);
  }
}

export function openSourcesDrawer() {
  refreshSourcesDrawer();
  document.getElementById('sourcesDrawer')?.removeAttribute('hidden');
  document.getElementById('sourcesOverlay')?.removeAttribute('hidden');
}

export function closeSourcesDrawer() {
  document.getElementById('sourcesDrawer')?.setAttribute('hidden', '');
  document.getElementById('sourcesOverlay')?.setAttribute('hidden', '');
}

export function refreshSourcesDrawer() {
  const body = document.getElementById('sourcesBody');
  if (!body) return;

  const { campus, page } = getContext();
  const policy = getPolicy();
  const fresh = getDataFreshness();
  const campusName = campus?.name ?? 'UC campuses';
  const reportUrl = campus?.reportUrl ?? policy.dataSourceUrl ?? 'https://sustainabilityreport.ucop.edu/';
  const inventoryYear = policy.inventoryYear ?? fresh.latestYear ?? '...';

  body.innerHTML = `
    <dl class="sources-list">
      <div class="sources-item">
        <dt>Page</dt>
        <dd>${page ?? 'Revitalize'}</dd>
      </div>
      <div class="sources-item">
        <dt>Campus</dt>
        <dd>${campusName}</dd>
      </div>
      <div class="sources-item">
        <dt>Inventory year</dt>
        <dd>${inventoryYear} (from UC ${inventoryYear + 1} Annual Report)</dd>
      </div>
      <div class="sources-item">
        <dt>Dataset updated</dt>
        <dd>${fresh.datasetUpdated ?? '...'}</dd>
      </div>
      <div class="sources-item">
        <dt>Emissions data</dt>
        <dd><a href="${policy.dataSourceUrl ?? 'https://sustainabilityreport.ucop.edu/'}" target="_blank" rel="noopener">UC Annual Report on Sustainable Practices</a></dd>
      </div>
      <div class="sources-item">
        <dt>Campus report</dt>
        <dd><a href="${reportUrl}" target="_blank" rel="noopener">Open ${campus?.shortName ?? 'UC'} report section</a></dd>
      </div>
      <div class="sources-item">
        <dt>Policy</dt>
        <dd><a href="${policy.policyUrl}" target="_blank" rel="noopener">${policy.policyName ?? 'UC Sustainable Practices Policy'}</a> (${policy.policyDate ?? '2023'})</dd>
      </div>
      <div class="sources-item">
        <dt>Verification</dt>
        <dd>${policy.verification ?? 'Third-party verified annually'}</dd>
      </div>
      <div class="sources-item">
        <dt>Methodology</dt>
        <dd><a href="methodology.html">How Revitalize forecasts and calculates metrics</a></dd>
      </div>
      <div class="sources-item">
        <dt>Raw data</dt>
        <dd><a href="data/uc_emissions.csv" download>Download uc_emissions.csv</a></dd>
      </div>
    </dl>`;
}
