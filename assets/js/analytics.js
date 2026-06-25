/* Carbon Trackers | analytics utilities */

export const UC_POLICY = {
  baselineYear: 2019,
  targetYear: 2045,
  reductionPct: 0.9
};

export function formatEmissionsShort(n) {
  if (n == null || Number.isNaN(n)) return '...';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  return (n / 1000).toFixed(0) + 'k';
}

export function formatEmissionsFull(n) {
  if (n == null || Number.isNaN(n)) return '...';
  return n.toLocaleString('en-US') + ' t CO₂e';
}

export function formatPercent(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return '...';
  const fixed = n.toFixed(digits);
  return (parseFloat(fixed) === 0 ? (0).toFixed(digits) : fixed) + '%';
}

/** toFixed that never returns "-0" / "-0.0". */
export function fmtFixed(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '...';
  const fixed = Number(n).toFixed(digits);
  return parseFloat(fixed) === 0 ? (0).toFixed(digits) : fixed;
}

export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.emissions ?? 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.year;
    sumY += p.emissions;
    sumXY += p.year * p.emissions;
    sumXX += p.year * p.year;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function commitmentTargetEmissions(baselineEmissions, reductionPct = UC_POLICY.reductionPct) {
  return Math.round(baselineEmissions * (1 - reductionPct));
}

export function buildCommitmentLine(baselineYear, baselineEmissions, targetYear, reductionPct, years) {
  const targetEmissions = commitmentTargetEmissions(baselineEmissions, reductionPct);
  return years.map(y => {
    if (y < baselineYear) return null;
    if (y >= targetYear) return targetEmissions;
    const frac = (y - baselineYear) / (targetYear - baselineYear);
    return Math.round(baselineEmissions - (baselineEmissions - targetEmissions) * frac);
  });
}

export function buildTrendLine(fit, years, fromYear) {
  return years.map(y => (y < fromYear ? null : Math.round(fit.slope * y + fit.intercept)));
}

export function commitmentPaceEmissions(baselineYear, baselineEmissions, targetYear, reductionPct, year) {
  const targetEmissions = commitmentTargetEmissions(baselineEmissions, reductionPct);
  if (year <= baselineYear) return baselineEmissions;
  if (year >= targetYear) return targetEmissions;
  const frac = (year - baselineYear) / (targetYear - baselineYear);
  return Math.round(baselineEmissions - (baselineEmissions - targetEmissions) * frac);
}

export function getBaselineEmissions(series, baselineYear = UC_POLICY.baselineYear) {
  const baseline = series.find(p => p.year === baselineYear);
  if (baseline) return baseline.emissions;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  return sorted[0]?.emissions ?? null;
}

export function computeCampusMetrics(series, policy = UC_POLICY) {
  if (!series.length) return null;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  const baselineEmissions = getBaselineEmissions(sorted, policy.baselineYear);
  if (!baselineEmissions || !Number.isFinite(baselineEmissions)) return null;

  const targetEmissions = commitmentTargetEmissions(baselineEmissions, policy.reductionPct);
  const reductionFromBaseline = baselineEmissions - latest.emissions;
  const pctFromBaseline = (reductionFromBaseline / baselineEmissions) * 100;
  const requiredReduction = baselineEmissions - targetEmissions;
  const pctOfGoal = requiredReduction > 0 ? (reductionFromBaseline / requiredReduction) * 100 : 0;
  const paceTarget = commitmentPaceEmissions(
    policy.baselineYear, baselineEmissions, policy.targetYear, policy.reductionPct, latest.year
  );
  const gapToPace = latest.emissions - paceTarget;
  const trendData = sorted.filter(p => p.year >= 2015);
  const fit = linearRegression(trendData.length >= 2 ? trendData : sorted);

  return {
    latest,
    baselineEmissions,
    targetEmissions,
    pctFromBaseline,
    pctOfGoal,
    paceTarget,
    gapToPace,
    fit,
    onTrack: gapToPace <= 0
  };
}

export function perCapita(emissions, enrollment) {
  if (!enrollment) return null;
  return Math.round(emissions / enrollment);
}

/* ── Plain-language equivalents ──
   Turn an abstract "t CO₂e" figure into something relatable.
   Factors from the US EPA Greenhouse Gas Equivalencies Calculator:
   one average gasoline car ≈ 4.6 t CO₂e/yr; one home's energy ≈ 8.3 t CO₂e/yr. */
const T_PER_CAR_YEAR = 4.6;
const T_PER_HOME_YEAR = 8.3;

function roundFriendly(n) {
  if (n >= 100_000) return Math.round(n / 10_000) * 10_000;
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000;
  if (n >= 1_000) return Math.round(n / 100) * 100;
  if (n >= 100) return Math.round(n / 10) * 10;
  return Math.round(n);
}

export function carsEquivalent(tons) {
  if (tons == null || !Number.isFinite(tons) || tons <= 0) return null;
  return roundFriendly(tons / T_PER_CAR_YEAR);
}

export function homesEquivalent(tons) {
  if (tons == null || !Number.isFinite(tons) || tons <= 0) return null;
  return roundFriendly(tons / T_PER_HOME_YEAR);
}

/* Short relatable caption for a KPI card, e.g. "≈ 34,000 gas cars driven for a year". */
export function emissionsEquivalentLabel(tons) {
  const cars = carsEquivalent(tons);
  if (!cars) return null;
  return `≈ ${cars.toLocaleString('en-US')} gas cars driven for a year`;
}

/* Constant annual % reduction needed from `fromEmissions` in `fromYear`
   to reach `targetEmissions` by `targetYear`. Returns a percentage (e.g. 11.5). */
export function requiredAnnualRate(fromEmissions, fromYear, targetEmissions, targetYear) {
  const years = targetYear - fromYear;
  if (years <= 0 || !(fromEmissions > 0) || !(targetEmissions >= 0)) return null;
  if (targetEmissions === 0) return 100;
  return (1 - Math.pow(targetEmissions / fromEmissions, 1 / years)) * 100;
}

/* Realized constant annual % reduction between two points (negative = grew). */
export function realizedAnnualRate(baselineEmissions, baselineYear, latestEmissions, latestYear) {
  const years = latestYear - baselineYear;
  if (years <= 0 || !(baselineEmissions > 0) || !(latestEmissions > 0)) return null;
  return (1 - Math.pow(latestEmissions / baselineEmissions, 1 / years)) * 100;
}

export function yearRange(start, end) {
  const years = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}
