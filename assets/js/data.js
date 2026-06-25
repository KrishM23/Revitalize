/* Carbon Trackers | data loading and queries */

import { UC_POLICY } from './analytics.js';

let campuses = [];
let emissions = [];
let policy = { ...UC_POLICY };
let meta = { updated: null, source: null };

export async function loadData() {
  const [campusesRes, emissionsRes, policyRes] = await Promise.all([
    fetch('data/campuses.json'),
    fetch('data/uc_emissions.csv'),
    fetch('data/policy.json')
  ]);

  const campusesData = await campusesRes.json();
  const policyData = await policyRes.json();
  const csvText = await emissionsRes.text();

  campuses = campusesData.campuses;
  meta = {
    updated: campusesData.updated ?? null,
    source: campusesData.source ?? null
  };
  emissions = parseCSV(csvText);
  policy = {
    baselineYear: policyData.baselineYear,
    targetYear: policyData.targetYear,
    reductionPct: policyData.reductionPct,
    ...policyData
  };

  return { campuses, emissions, policy };
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(Boolean).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    row.year = Number(row.year);
    row.scope1 = row.scope1 !== '' ? Number(row.scope1) : null;
    row.scope2 = row.scope2 !== '' ? Number(row.scope2) : null;
    row.scope3 = row.scope3 !== '' ? Number(row.scope3) : null;
    row.total = Number(row.total);
    row.verified = row.verified === 'true';
    if (!Number.isFinite(row.year) || !Number.isFinite(row.total)) return null;
    return row;
  }).filter(Boolean);
}

export function getCampuses() {
  return campuses;
}

export function getCampus(id) {
  return campuses.find(c => c.id === id);
}

export function getPolicy() {
  return policy;
}

export function getEmissionsSeries(campusId) {
  return emissions
    .filter(e => e.campus_id === campusId)
    .map(e => ({
      year: e.year,
      emissions: e.total,
      scope1: e.scope1,
      scope2: e.scope2,
      scope3: e.scope3,
      verified: e.verified,
      source: e.source
    }))
    .sort((a, b) => a.year - b.year);
}

export function getLatestEmissions(campusId) {
  const series = getEmissionsSeries(campusId);
  return series[series.length - 1] ?? null;
}

export function getLatestDataYear(campusId = null) {
  const rows = campusId
    ? emissions.filter(e => e.campus_id === campusId)
    : emissions;
  if (!rows.length) return null;
  return Math.max(...rows.map(e => e.year));
}

export function getDataFreshness() {
  const latestYear = getLatestDataYear();
  const undergradYears = getUndergraduateCampuses()
    .map(c => getLatestEmissions(c.id)?.year)
    .filter(Boolean);
  return {
    latestYear,
    minUndergradYear: undergradYears.length ? Math.min(...undergradYears) : latestYear,
    datasetUpdated: meta.updated
  };
}

export function getUndergraduateCampuses() {
  return campuses.filter(c => c.type === 'undergraduate');
}

export function getScopeBreakdown(campusId, year) {
  const row = emissions.find(e => e.campus_id === campusId && e.year === year);
  if (!row || (row.scope1 == null && row.scope2 == null && row.scope3 == null)) return null;
  return { scope1: row.scope1 ?? 0, scope2: row.scope2 ?? 0, scope3: row.scope3 ?? 0 };
}

export function getAllCampusMetrics(computeFn) {
  return getUndergraduateCampuses()
    .map(campus => {
      const series = getEmissionsSeries(campus.id);
      const metrics = computeFn(series, policy);
      return metrics ? { campus, series, metrics } : null;
    })
    .filter(Boolean);
}

export function exportEmissionsCSV() {
  const header = 'campus_id,year,scope1,scope2,scope3,total,verified,source\n';
  const rows = emissions.map(e =>
    `${e.campus_id},${e.year},${e.scope1 ?? ''},${e.scope2 ?? ''},${e.scope3 ?? ''},${e.total},${e.verified},${e.source}`
  ).join('\n');
  return header + rows;
}
