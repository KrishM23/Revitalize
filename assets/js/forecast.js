/* Carbon Trackers | statistical & ML forecasting engine
   Models: OLS linear, polynomial, log-linear, Holt smoothing, ridge regression
   Selection: LOOCV-weighted ensemble with 95% prediction intervals */

import { UC_POLICY, commitmentTargetEmissions } from './analytics.js';

const MIN_POINTS = 3;
const CONFIDENCE_Z = 1.96;

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toXY(points) {
  return {
    xs: points.map(p => p.year),
    ys: points.map(p => p.emissions)
  };
}

function residuals(ys, yhats) {
  return ys.map((y, i) => y - yhats[i]);
}

function rmse(res) {
  return Math.sqrt(mean(res.map(r => r * r)));
}

function rSquared(ys, yhats) {
  const ybar = mean(ys);
  const ssTot = ys.reduce((s, y) => s + (y - ybar) ** 2, 0);
  if (ssTot === 0) return 1;
  const ssRes = residuals(ys, yhats).reduce((s, r) => s + r * r, 0);
  return clamp(1 - ssRes / ssTot, -Infinity, 1);
}

function predictInterval(yhat, se, z = CONFIDENCE_Z) {
  return { lower: yhat - z * se, upper: yhat + z * se };
}

/* Distance-aware prediction standard error.
   For OLS-type models we use the exact formula s·√(1 + 1/n + (x−x̄)²/Sxx),
   which widens with extrapolation distance. Other models fall back to their
   in-sample error inflated by forecast horizon so far-future intervals are honest. */
function modelSeAt(m, x) {
  if (!m) return 0;
  if (m._Sxx && m._Sxx > 0 && m._n > 2 && Number.isFinite(m._s)) {
    return m._s * Math.sqrt(1 + 1 / m._n + ((x - m._xbar) ** 2) / m._Sxx);
  }
  const base = (typeof m.se === 'number' && Number.isFinite(m.se)) ? m.se : (m.rmse || 0);
  const last = m.lastYear ?? x;
  const h = Math.max(0, x - last);
  return base * (1 + 0.05 * h);
}

/* ── OLS Linear Regression ── */
export function fitLinear(points) {
  const n = points.length;
  if (n < 2) return null;
  const { xs, ys } = toXY(points);
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i];
    sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const predict = x => slope * x + intercept;
  const yhats = xs.map(predict);
  const res = residuals(ys, yhats);
  const s = rmse(res);
  const xbar = sumX / n;
  const Sxx = sumXX - sumX * sumX / n;
  const sePred = n > 2 ? s * Math.sqrt(1 + 1 / n) : s;

  return {
    name: 'Linear OLS',
    type: 'linear',
    slope, intercept,
    r2: rSquared(ys, yhats),
    rmse: s,
    params: 2,
    predict,
    se: sePred,
    fitted: yhats,
    _xbar: xbar, _Sxx: Sxx, _n: n, _s: s, lastYear: Math.max(...xs)
  };
}

/* ── Recency-weighted least squares (exponential decay on age) ── */
export function fitWeightedLinear(points, halfLife = 4) {
  const n = points.length;
  if (n < 2) return null;
  const { xs, ys } = toXY(points);
  const maxYear = Math.max(...xs);
  const decay = Math.log(2) / halfLife;
  const w = xs.map(x => Math.exp(-decay * (maxYear - x)));

  let sw = 0, swx = 0, swy = 0, swxy = 0, swxx = 0;
  for (let i = 0; i < n; i++) {
    sw += w[i];
    swx += w[i] * xs[i];
    swy += w[i] * ys[i];
    swxy += w[i] * xs[i] * ys[i];
    swxx += w[i] * xs[i] * xs[i];
  }
  const denom = sw * swxx - swx * swx;
  if (denom === 0) return null;
  const slope = (sw * swxy - swx * swy) / denom;
  const intercept = (swy - slope * swx) / sw;
  const predict = x => slope * x + intercept;
  const yhats = xs.map(predict);
  const s = rmse(residuals(ys, yhats));
  const xbar = mean(xs);
  const Sxx = xs.reduce((acc, x) => acc + (x - xbar) ** 2, 0);

  return {
    name: 'Recency-weighted OLS',
    type: 'weighted',
    slope, intercept, halfLife,
    r2: rSquared(ys, yhats),
    rmse: s,
    params: 2,
    predict,
    se: n > 2 ? s * Math.sqrt(1 + 1 / n) : s,
    fitted: yhats,
    _xbar: xbar, _Sxx: Sxx, _n: n, _s: s, lastYear: Math.max(...xs)
  };
}

/* ── Polynomial Regression (degree 2) via normal equations ── */
function solve3x3(m, b) {
  const a = m.map(r => [...r]);
  const v = [...b];
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [v[col], v[pivot]] = [v[pivot], v[col]];
    if (Math.abs(a[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < 3; row++) {
      const f = a[row][col] / a[col][col];
      for (let j = col; j < 3; j++) a[row][j] -= f * a[col][j];
      v[row] -= f * v[col];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = v[i];
    for (let j = i + 1; j < 3; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
  return x;
}

export function fitPolynomial(points, degree = 2) {
  const n = points.length;
  if (n < degree + 1) return null;
  const { xs, ys } = toXY(points);
  const k = degree + 1;
  const xtx = Array.from({ length: k }, () => Array(k).fill(0));
  const xty = Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    const powers = Array.from({ length: k }, (_, p) => xs[i] ** p);
    for (let r = 0; r < k; r++) {
      xty[r] += powers[r] * ys[i];
      for (let c = 0; c < k; c++) xtx[r][c] += powers[r] * powers[c];
    }
  }

  let coeffs;
  if (k === 3) {
    coeffs = solve3x3(xtx, xty);
  } else {
    coeffs = solve3x3(xtx, xty);
  }
  if (!coeffs) return null;

  const predict = x => coeffs.reduce((s, c, p) => s + c * x ** p, 0);
  const yhats = xs.map(predict);
  const res = residuals(ys, yhats);
  const s = rmse(res);

  return {
    name: `Polynomial (deg ${degree})`,
    type: 'polynomial',
    coeffs, degree,
    r2: rSquared(ys, yhats),
    rmse: s,
    params: k,
    predict,
    se: n > k ? s * Math.sqrt(1 + 1 / n) : s,
    fitted: yhats,
    lastYear: Math.max(...xs)
  };
}

/* ── Log-linear (exponential) model: y = a·e^(b·t) ── */
export function fitLogLinear(points) {
  const valid = points.filter(p => p.emissions > 0);
  if (valid.length < MIN_POINTS) return null;
  const logPoints = valid.map(p => ({ year: p.year, emissions: Math.log(p.emissions) }));
  const lin = fitLinear(logPoints);
  if (!lin) return null;
  const a = Math.exp(lin.intercept);
  const b = lin.slope;
  const predict = x => a * Math.exp(b * x);
  const { xs, ys } = toXY(valid);
  const yhats = xs.map(predict);
  const res = residuals(ys, yhats);
  const s = rmse(res);

  return {
    name: 'Log-linear (exponential)',
    type: 'loglinear',
    a, b,
    r2: rSquared(ys, yhats),
    rmse: s,
    params: 2,
    predict,
    se: s * Math.sqrt(1 + 1 / valid.length),
    fitted: yhats,
    trainPoints: valid,
    lastYear: Math.max(...xs)
  };
}

/* ── Holt's linear exponential smoothing (with optional damping) ── */
export function fitHolt(points, alpha = 0.35, beta = 0.15, phi = 1.0) {
  const n = points.length;
  if (n < MIN_POINTS) return null;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  let level = sorted[0].emissions;
  let trend = (sorted[n - 1].emissions - sorted[0].emissions) / (sorted[n - 1].year - sorted[0].year);
  const fitted = [level];

  for (let i = 1; i < n; i++) {
    const y = sorted[i].emissions;
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
    fitted.push(level + phi * trend);
  }

  const lastYear = sorted[n - 1].year;
  const damped = phi < 1;
  const predict = x => {
    const h = x - lastYear;
    if (h <= 0) return level;
    if (!damped) return level + trend * h;
    let dampSum = 0;
    for (let k = 1; k <= h; k++) dampSum += Math.pow(phi, k);
    return level + trend * dampSum;
  };

  const ys = sorted.map(p => p.emissions);
  const s = rmse(residuals(ys, fitted));

  return {
    name: damped ? "Damped Holt" : "Holt's smoothing",
    type: damped ? 'holt_damped' : 'holt',
    level, trend, lastYear, alpha, beta, phi,
    r2: rSquared(ys, fitted),
    rmse: s,
    params: damped ? 3 : 2,
    predict,
    se: s * Math.sqrt(1 + 1 / n),
    fitted
  };
}

/* ── Ridge-regularized polynomial (reduces overfit on sparse data) ── */
export function fitRidgePoly(points, degree = 2, lambda = 5000) {
  const n = points.length;
  if (n < degree + 1) return null;
  const { xs, ys } = toXY(points);
  const k = degree + 1;
  const xtx = Array.from({ length: k }, () => Array(k).fill(0));
  const xty = Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    const powers = Array.from({ length: k }, (_, p) => xs[i] ** p);
    for (let r = 0; r < k; r++) {
      xty[r] += powers[r] * ys[i];
      for (let c = 0; c < k; c++) xtx[r][c] += powers[r] * powers[c];
    }
  }
  for (let i = 0; i < k; i++) xtx[i][i] += lambda;

  const coeffs = solve3x3(xtx, xty);
  if (!coeffs) return null;

  const predict = x => coeffs.reduce((s, c, p) => s + c * x ** p, 0);
  const yhats = xs.map(predict);
  const res = residuals(ys, yhats);
  const s = rmse(res);

  return {
    name: 'Ridge polynomial',
    type: 'ridge',
    coeffs, lambda,
    r2: rSquared(ys, yhats),
    rmse: s,
    params: k,
    predict,
    se: s * Math.sqrt(1 + 1 / n),
    fitted: yhats,
    lastYear: Math.max(...xs)
  };
}

/* ── LOOCV for model selection ── */
function loocvRmse(points, fitFn) {
  const n = points.length;
  if (n < MIN_POINTS) return Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const train = points.filter((_, j) => j !== i);
    const model = fitFn(train);
    if (!model) continue;
    const err = points[i].emissions - model.predict(points[i].year);
    sum += err * err;
    count++;
  }
  return count > 0 ? Math.sqrt(sum / count) : Infinity;
}

function isSaneModel(model, lastPoint, baselineEmissions) {
  const ref = baselineEmissions ?? lastPoint.emissions;
  const ceiling = Math.max(ref * 1.5, lastPoint.emissions * 1.25);
  const floor = 0;
  for (const y of [2030, 2040, 2045]) {
    const p = model.predict(y);
    if (!Number.isFinite(p)) return false;
    const yearsOut = y - lastPoint.year;
    const maxRate = lastPoint.emissions * Math.pow(1.12, yearsOut);
    const minRate = lastPoint.emissions * Math.pow(0.88, yearsOut);
    if (p < floor || p > ceiling || p > maxRate * 1.1 || p < minRate * 0.7) return false;
  }
  return true;
}

function scoreModels(points, lastPoint, baselineEmissions) {
  const n = points.length;
  const candidates = [
    { fit: fitLinear, fn: fitLinear },
    { fit: p => fitWeightedLinear(p, 4), fn: p => fitWeightedLinear(p, 4) },
    ...(n >= 4 ? [{ fit: p => fitPolynomial(p, 2), fn: p => fitPolynomial(p, 2) }] : []),
    ...(n >= MIN_POINTS ? [{ fit: fitLogLinear, fn: fitLogLinear }] : []),
    ...(n >= MIN_POINTS ? [{ fit: fitHolt, fn: fitHolt }] : []),
    ...(n >= MIN_POINTS ? [{ fit: p => fitHolt(p, 0.35, 0.15, 0.85), fn: p => fitHolt(p, 0.35, 0.15, 0.85) }] : []),
    ...(n >= 4 ? [{ fit: p => fitRidgePoly(p, 2, 5000), fn: p => fitRidgePoly(p, 2, 5000) }] : [])
  ];

  const trained = [];
  for (const c of candidates) {
    const model = c.fn(points);
    if (!model) continue;
    if (!isSaneModel(model, lastPoint, baselineEmissions)) continue;
    const cv = loocvRmse(points, c.fit);
    // Effective error: prefer LOOCV; penalize in-sample RMSE when CV unavailable
    const effErr = Number.isFinite(cv) ? cv : (model.rmse || 1) * 1.5;
    trained.push({ ...model, loocvRmse: cv, effErr });
  }
  return trained;
}

function buildEnsemble(models) {
  if (!models.length) return null;
  const inv = models.map(m => {
    const err = Number.isFinite(m.effErr) ? m.effErr
      : (Number.isFinite(m.loocvRmse) ? m.loocvRmse : (m.rmse || 1));
    return 1 / Math.max(err, 1);
  });
  let total = inv.reduce((a, b) => a + b, 0);
  let weights;
  if (!Number.isFinite(total) || total <= 0) {
    weights = models.map(() => 1 / models.length);
  } else {
    weights = inv.map(w => w / total);
  }
  return {
    name: 'LOOCV-weighted ensemble',
    type: 'ensemble',
    models: models.map((m, i) => ({ name: m.name, weight: weights[i], loocvRmse: m.loocvRmse })),
    weights,
    predict: x => models.reduce((s, m, i) => s + weights[i] * m.predict(x), 0),
    sePredict: x => {
      const preds = models.map(m => m.predict(x));
      const ens = preds.reduce((s, p, i) => s + weights[i] * p, 0);
      // Disagreement between models + each model's own (distance-aware) error
      const variance = preds.reduce((s, p, i) => s + weights[i] * (p - ens) ** 2, 0);
      const avgSe = models.reduce((s, m, i) => s + weights[i] * modelSeAt(m, x), 0);
      return Math.sqrt(variance + avgSe ** 2);
    }
  };
}

export function buildForecast(points, policy = UC_POLICY) {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  if (sorted.length < 2) {
    return { error: 'Insufficient data (need ≥2 years)', points: sorted.length };
  }

  const trainFrom = Math.max(2015, sorted[0].year);
  const train = sorted.filter(p => p.year >= trainFrom);
  const lastPoint = sorted[sorted.length - 1];
  const baseline = sorted.find(p => p.year === policy.baselineYear);

  const baselineEmissions = baseline?.emissions ?? null;
  const trainSet = train.length >= MIN_POINTS ? train : sorted;

  let models = scoreModels(trainSet, lastPoint, baselineEmissions);
  if (!models.length) {
    const lin = fitLinear(trainSet);
    if (lin) models = [{ ...lin, loocvRmse: loocvRmse(trainSet, fitLinear) }];
  }

  const fullFit = models;
  const errOf = m => (Number.isFinite(m.effErr) ? m.effErr : (Number.isFinite(m.loocvRmse) ? m.loocvRmse : (m.rmse || Infinity)));
  const best = fullFit.length
    ? fullFit.reduce((a, b) => (errOf(a) <= errOf(b) ? a : b))
    : fitLinear(sorted);

  const ensemble = fullFit.length >= 2 ? buildEnsemble(fullFit) : null;
  const primary = ensemble ?? best;

  if (!primary) {
    return { error: 'Could not fit models', points: sorted.length };
  }

  const forecastStart = lastPoint.year;
  const forecastEnd = policy.targetYear;
  const forecastYears = [];
  for (let y = forecastStart; y <= forecastEnd; y++) forecastYears.push(y);

  const seAt = y => typeof primary.sePredict === 'function' ? primary.sePredict(y) : modelSeAt(primary, y);

  const median = forecastYears.map(y => Math.round(Math.max(0, primary.predict(y))));
  const lower = forecastYears.map((y, i) => {
    const se = seAt(y);
    return Math.round(Math.max(0, predictInterval(median[i], se).lower));
  });
  const upper = forecastYears.map((y, i) => {
    const se = seAt(y);
    return Math.round(Math.max(0, predictInterval(median[i], se).upper));
  });

  const baselineEmissionsVal = baselineEmissions;
  const target2045 = baselineEmissionsVal
    ? commitmentTargetEmissions(baselineEmissionsVal, policy.reductionPct)
    : null;

  const proj2030 = Math.round(Math.max(0, primary.predict(2030)));
  const proj2045 = Math.round(Math.max(0, primary.predict(2045)));
  const gap2045 = target2045 != null ? proj2045 - target2045 : null;

  // Clear, honest headline metric: how big a cut the current trend points to by 2045.
  const goalReductionPct = Math.round(policy.reductionPct * 100);
  const projReductionPct = (baselineEmissionsVal && baselineEmissionsVal > 0)
    ? Math.round(((baselineEmissionsVal - proj2045) / baselineEmissionsVal) * 100)
    : null;

  let attainmentProb = null;
  if (target2045 != null && gap2045 != null) {
    const se2045 = seAt(2045);
    const z = gap2045 / Math.max(se2045, 1);
    attainmentProb = clamp(0.5 * (1 - erf(z / Math.SQRT2)), 0, 1);
  }

  return {
    trainYears: train.length,
    lastYear: lastPoint.year,
    models: fullFit.map(m => ({
      name: m.name,
      r2: m.r2,
      rmse: m.rmse,
      loocvRmse: m.loocvRmse,
      params: m.params
    })),
    bestModel: best?.name ?? 'Linear OLS',
    ensemble: ensemble != null,
    primaryModel: primary.name,
    r2: best?.r2 ?? null,
    rmse: best?.rmse ?? null,
    loocvRmse: best?.loocvRmse ?? null,
    forecastYears,
    median,
    lower,
    upper,
    projections: { 2030: proj2030, 2045: proj2045 },
    target2045,
    gap2045,
    onTrack2045: gap2045 != null ? gap2045 <= 0 : null,
    projReductionPct,
    goalReductionPct,
    attainmentProb,
    baselineEmissions: baselineEmissionsVal
  };
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function formatProb(p) {
  if (p == null || Number.isNaN(p)) return '...';
  return (p * 100).toFixed(0) + '%';
}
