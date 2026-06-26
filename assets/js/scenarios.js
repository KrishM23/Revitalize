/* Revitalize | what-if scenario engine */

import {
  commitmentTargetEmissions,
  buildCommitmentLine,
  formatEmissionsShort,
  formatPercent,
  fmtFixed,
  requiredAnnualRate,
  UC_POLICY
} from './analytics.js';
import { SCOPE_LABELS } from './campus-plans.js';

/** Scenario lever definitions shown in the UI. */
export const LEVER_DEFS = [
  {
    id: 'scope1Cut',
    scope: 1,
    label: 'Electrify on-campus fuel',
    sub: 'Gas heating, boilers, and on-site power',
    min: 0,
    max: 85,
    step: 5,
    default: 0
  },
  {
    id: 'scope2Cut',
    scope: 2,
    label: 'Buy cleaner electricity',
    sub: 'Solar, UC Clean Power, and systemwide renewables',
    min: 0,
    max: 90,
    step: 5,
    default: 0
  },
  {
    id: 'scope3Cut',
    scope: 3,
    label: 'Cut travel and commuting',
    sub: 'Transit, remote work, videoconferencing, and procurement',
    min: 0,
    max: 60,
    step: 5,
    default: 0
  },
  {
    id: 'rampYears',
    scope: null,
    label: 'Years to fully implement',
    sub: 'How long before these cuts are fully in place',
    min: 5,
    max: 20,
    step: 1,
    default: 12,
    unit: 'yr'
  }
];

/** One-click presets tailored to common campus strategies. */
export const SCENARIO_PRESETS = [
  {
    id: 'status-quo',
    label: 'Current trend',
    desc: 'No new interventions beyond what the forecast already assumes.',
    levers: { scope1Cut: 0, scope2Cut: 0, scope3Cut: 0, rampYears: 12 }
  },
  {
    id: 'moderate',
    label: 'Moderate progress',
    desc: 'Steady electrification and cleaner power over 15 years.',
    levers: { scope1Cut: 30, scope2Cut: 45, scope3Cut: 15, rampYears: 15 }
  },
  {
    id: 'electrify',
    label: 'Electrification push',
    desc: 'Prioritize building fuel switching and clean electricity.',
    levers: { scope1Cut: 65, scope2Cut: 55, scope3Cut: 10, rampYears: 12 }
  },
  {
    id: 'scope3',
    label: 'Commute & travel focus',
    desc: 'Best for campuses where Scope 3 is a large share.',
    levers: { scope1Cut: 20, scope2Cut: 25, scope3Cut: 45, rampYears: 10 }
  },
  {
    id: 'ambitious',
    label: 'Ambitious path',
    desc: 'Aggressive cuts across all three scopes on a faster timeline.',
    levers: { scope1Cut: 75, scope2Cut: 80, scope3Cut: 35, rampYears: 10 }
  }
];

export const DEFAULT_LEVERS = Object.fromEntries(
  LEVER_DEFS.map(l => [l.id, l.default])
);

function rampFactor(year, startYear, rampYears) {
  if (year < startYear) return 0;
  return Math.min(1, (year - startYear + 1) / Math.max(1, rampYears));
}

/**
 * Run a what-if scenario against the baseline forecast.
 */
export function runScenario({ forecast, scopeData, metrics, policy = UC_POLICY, levers }) {
  if (!forecast || forecast.error || !metrics) return null;

  const latestYear = metrics.latest.year;
  const startYear = latestYear + 1;
  const rampYears = levers.rampYears ?? 12;

  const s1 = scopeData?.scope1 ?? 0;
  const s2 = scopeData?.scope2 ?? 0;
  const s3 = scopeData?.scope3 ?? 0;
  const totalScopes = s1 + s2 + s3;

  const cut1 = (levers.scope1Cut ?? 0) / 100;
  const cut2 = (levers.scope2Cut ?? 0) / 100;
  const cut3 = (levers.scope3Cut ?? 0) / 100;

  const fullSavings = s1 * cut1 + s2 * cut2 + s3 * cut3;
  const scopeSavings = [
    { scope: 1, label: SCOPE_LABELS[1], amount: s1 * cut1, share: totalScopes ? (s1 * cut1 / fullSavings) * 100 : 0 },
    { scope: 2, label: SCOPE_LABELS[2], amount: s2 * cut2, share: totalScopes ? (s2 * cut2 / fullSavings) * 100 : 0 },
    { scope: 3, label: SCOPE_LABELS[3], amount: s3 * cut3, share: totalScopes ? (s3 * cut3 / fullSavings) * 100 : 0 }
  ].filter(s => s.amount > 0);

  const years = forecast.forecastYears ?? [];
  const baseline = forecast.median ?? [];
  const scenario = years.map((y, i) => {
    const ramp = rampFactor(y, startYear, rampYears);
    return Math.round(Math.max(0, baseline[i] - fullSavings * ramp));
  });

  const baseline2045 = forecast.projections?.[2045] ?? baseline[baseline.length - 1];
  const scenario2045 = scenario[scenario.length - 1] ?? baseline2045;
  const target2045 = metrics.targetEmissions;
  const baselineEmissions = metrics.baselineEmissions;

  const improvement = baseline2045 - scenario2045;
  const gapBaseline = baseline2045 - target2045;
  const gapScenario = scenario2045 - target2045;

  const baselineCutPct = baselineEmissions > 0
    ? ((baselineEmissions - baseline2045) / baselineEmissions) * 100
    : 0;
  const scenarioCutPct = baselineEmissions > 0
    ? ((baselineEmissions - scenario2045) / baselineEmissions) * 100
    : 0;
  const goalCutPct = policy.reductionPct * 100;

  const requiredFromNow = requiredAnnualRate(
    metrics.latest.emissions,
    latestYear,
    target2045,
    policy.targetYear
  );
  const requiredFromScenario = requiredAnnualRate(
    scenario2045,
    policy.targetYear,
    target2045,
    policy.targetYear
  );

  const onTrackBaseline = gapBaseline <= 0;
  const onTrackScenario = gapScenario <= 0;

  const commitment = buildCommitmentLine(
    policy.baselineYear,
    baselineEmissions,
    policy.targetYear,
    policy.reductionPct,
    years
  );

  return {
    years,
    baseline,
    scenario,
    commitment,
    fullSavings: Math.round(fullSavings),
    scopeSavings,
    baseline2045,
    scenario2045,
    target2045,
    improvement,
    gapBaseline,
    gapScenario,
    baselineCutPct,
    scenarioCutPct,
    goalCutPct,
    onTrackBaseline,
    onTrackScenario,
    requiredFromNow,
    rampYears,
    startYear
  };
}

/** Plain-language summary for the results panel. */
export function scenarioSummary(result, campus) {
  if (!result || !campus) return '';

  const name = campus.shortName ?? campus.name;
  const saved = formatEmissionsShort(result.improvement);
  const scen = formatEmissionsShort(result.scenario2045);
  const goal = formatEmissionsShort(result.target2045);

  if (result.onTrackScenario && !result.onTrackBaseline) {
    return `With these interventions, ${name} could close the gap and reach about ${scen} by 2045, near the ${goal} goal. That is ${saved} lower than the current trend.`;
  }
  if (result.onTrackScenario) {
    return `${name} is already near the 2045 goal on the current trend. These interventions would lower emissions further to about ${scen} by 2045.`;
  }
  if (result.improvement > 0) {
    return `These changes would cut ${saved} from the 2045 projection, bringing ${name} to about ${scen}. The campus would still need more action to reach the ${goal} goal.`;
  }
  return `Adjust the levers to model how building electrification, cleaner electricity, and travel reductions could change ${name}'s path to 2045.`;
}

export function formatGap(gap) {
  if (gap == null || !Number.isFinite(gap)) return '...';
  if (Math.abs(gap) < 500) return 'On target';
  const sign = gap > 0 ? 'above' : 'below';
  return `${formatEmissionsShort(Math.abs(gap))} ${sign} goal`;
}
