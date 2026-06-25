/* Carbon Trackers | Chart.js rendering with ML forecast bands */

import {
  formatEmissionsFull,
  formatEmissionsShort,
  buildCommitmentLine,
  UC_POLICY
} from './analytics.js';

const COLORS = {
  actual: '#2FC4A0',
  actualFill: 'rgba(47,196,160,.16)',
  forecast: '#E2A04A',
  forecastFill: 'rgba(226,160,74,.16)',
  commitment: '#5B8DEF',
  scope1: '#2FC4A0',
  scope2: '#5B8DEF',
  scope3: '#E2A04A'
};

const GRID = 'rgba(255,255,255,.06)';
const AXIS_TEXT = '#7E8A99';
const PANEL_BORDER = '#28333F';

const tooltipDefaults = {
  backgroundColor: '#0E141D',
  borderColor: PANEL_BORDER,
  borderWidth: 1,
  padding: 12,
  cornerRadius: 10,
  titleColor: '#EAEEF4',
  bodyColor: '#AEB9C7',
  titleFont: { family: 'Inter', size: 12.5, weight: '600' },
  bodyFont: { family: 'Inter', size: 12.5 },
  displayColors: false,
  filter: item => item.parsed.y !== null && item.parsed.y !== undefined
};

function commitmentDeadlinePlugin(targetYear) {
  return {
    id: 'commitmentDeadline',
    afterDraw(chart) {
      const x = chart.scales.x.getPixelForValue(targetYear);
      const { top, bottom, left, right } = chart.chartArea;
      if (x < left || x > right) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(91, 141, 239, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5B8DEF';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(targetYear), x, top - 4);
      ctx.restore();
    }
  };
}

function confidenceBandPlugin(years, lower, upper) {
  return {
    id: 'confidenceBand',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !lower?.length) return;
      ctx.save();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < years.length; i++) {
        if (lower[i] == null || upper[i] == null) continue;
        const x = scales.x.getPixelForValue(years[i]);
        const y = scales.y.getPixelForValue(upper[i]);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      for (let i = years.length - 1; i >= 0; i--) {
        if (lower[i] == null || upper[i] == null) continue;
        const x = scales.x.getPixelForValue(years[i]);
        const y = scales.y.getPixelForValue(lower[i]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = COLORS.forecastFill;
      ctx.fill();
      ctx.restore();
    }
  };
}

function axisDefaults() {
  return {
    grid: { color: GRID, drawBorder: false },
    border: { display: false },
    ticks: {
      font: { family: 'JetBrains Mono', size: 10 },
      color: AXIS_TEXT,
      padding: 8
    }
  };
}

export function destroyChart(chart) {
  if (chart) chart.destroy();
}

function buildChartYears(series, policy) {
  const chartStart = Math.max(2015, series[0].year);
  const chartEnd = policy.targetYear;
  const years = [];
  for (let y = chartStart; y <= chartEnd; y++) years.push(y);
  return years;
}

export function createTrajectoryChart(canvas, {
  series,
  baselineEmissions,
  campusColor,
  policy = UC_POLICY,
  forecast = null
}) {
  const ctx = canvas.getContext('2d');
  const lastPoint = series[series.length - 1];
  const chartYears = buildChartYears(series, policy);
  const actualByYear = Object.fromEntries(series.map(p => [p.year, p.emissions]));
  const actualSeries = chartYears.map(y =>
    y <= lastPoint.year ? (actualByYear[y] ?? null) : null
  );

  const chartStart = chartYears[0];

  const commitmentSeries = baselineEmissions
    ? buildCommitmentLine(
        policy.baselineYear, baselineEmissions, policy.targetYear, policy.reductionPct, chartYears
      )
    : chartYears.map(() => null);

  const color = campusColor || COLORS.actual;

  // Projection line starts at the last real point so it visually continues the story
  const forecastSeries = chartYears.map(y => {
    if (!forecast || y < lastPoint.year) return null;
    const idx = forecast.forecastYears.indexOf(y);
    return idx >= 0 ? forecast.median[idx] : null;
  });

  const datasets = [
    {
      label: 'Reported',
      data: actualSeries,
      borderColor: color,
      backgroundColor: color + '1F',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      spanGaps: false,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: (context) => actualSeries[context.dataIndex] != null ? 5 : 0,
      pointHoverRadius: 7,
      order: 2
    }
  ];

  if (forecast && !forecast.error) {
    datasets.push({
      label: 'Projection',
      data: forecastSeries,
      borderColor: COLORS.forecast,
      borderWidth: 3,
      borderDash: [7, 5],
      fill: false,
      tension: 0.3,
      pointRadius: (context) => {
        const y = chartYears[context.dataIndex];
        return [2030, 2045].includes(y) && forecastSeries[context.dataIndex] != null ? 5 : 0;
      },
      pointBackgroundColor: COLORS.forecast,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverRadius: 7,
      order: 1
    });
  }

  datasets.push({
    label: '2045 goal path',
    data: commitmentSeries,
    borderColor: COLORS.commitment,
    borderWidth: 2,
    borderDash: [3, 5],
    fill: false,
    pointRadius: 0,
    order: 4
  });

  const plugins = [commitmentDeadlinePlugin(policy.targetYear)];
  if (forecast && !forecast.error) {
    const bandYears = chartYears.filter(y => y >= lastPoint.year);
    const bandLower = bandYears.map(y => {
      const idx = forecast.forecastYears.indexOf(y);
      return idx >= 0 ? forecast.lower[idx] : null;
    });
    const bandUpper = bandYears.map(y => {
      const idx = forecast.forecastYears.indexOf(y);
      return idx >= 0 ? forecast.upper[idx] : null;
    });
    plugins.push(confidenceBandPlugin(bandYears, bandLower, bandUpper));
  }

  return new Chart(ctx, {
    type: 'line',
    data: { labels: chartYears, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 14 } },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            title: items => items[0].label,
            label: c => ` ${c.dataset.label}: ${formatEmissionsFull(c.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          ...axisDefaults(),
          beginAtZero: true,
          ticks: { ...axisDefaults().ticks, callback: v => formatEmissionsShort(v) }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            ...axisDefaults().ticks,
            maxRotation: 0,
            autoSkip: false,
            callback: (val, i) => {
              const y = chartYears[i];
              const marks = [chartStart, policy.baselineYear, lastPoint.year, 2030, 2040, policy.targetYear];
              return marks.includes(y) ? y : '';
            }
          }
        }
      }
    },
    plugins
  });
}

export function createEmissionsChart(opts) {
  return createTrajectoryChart(opts.canvas ?? opts, opts);
}

export function createSystemTrendChart(canvas, { series, policy, forecast = null }) {
  const baseline = series.find(p => p.year === policy.baselineYear)?.emissions ?? null;
  return createTrajectoryChart(canvas, {
    series,
    baselineEmissions: baseline,
    campusColor: COLORS.actual,
    policy,
    forecast
  });
}

/* Tiny sparkline for KPI cards */
export function createSparkline(canvas, { values, color = COLORS.actual }) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const data = (values || []).filter(v => v != null && Number.isFinite(v));
  if (data.length < 2) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 48);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '00');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        borderWidth: 2,
        fill: true,
        backgroundColor: grad,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: false
    }
  });
}

/* Main dashboard chart: reported emissions as bars + projection bars + goal line.
   A single bar dataset (colored per year) keeps every bar centered on its year. */
export function createEmissionsBarChart(canvas, {
  series,
  baselineEmissions,
  policy = UC_POLICY,
  forecast = null
}) {
  const ctx = canvas.getContext('2d');
  const reportedYears = series.map(p => p.year);
  const lastYear = reportedYears[reportedYears.length - 1];
  const milestones = [2030, 2035, 2040, policy.targetYear].filter(y => y > lastYear);
  const cats = Array.from(new Set([...reportedYears, ...milestones])).sort((a, b) => a - b);

  const reportedByYear = Object.fromEntries(series.map(p => [p.year, p.emissions]));

  const projByYear = {};
  if (forecast && !forecast.error) {
    for (const y of milestones) {
      const idx = forecast.forecastYears.indexOf(y);
      if (idx >= 0) projByYear[y] = forecast.median[idx];
    }
  }

  // Use the fixed semantic colors so bars always match the legend:
  // teal = reported, amber = projection (campus identity is shown elsewhere).
  const barData = cats.map(y => reportedByYear[y] ?? projByYear[y] ?? null);
  const barColors = cats.map(y => reportedByYear[y] != null ? COLORS.actual : COLORS.forecast);

  const goalData = baselineEmissions
    ? buildCommitmentLine(policy.baselineYear, baselineEmissions, policy.targetYear, policy.reductionPct, cats)
    : cats.map(() => null);

  const datasets = [
    {
      type: 'bar',
      label: 'Emissions',
      data: barData,
      backgroundColor: barColors,
      borderRadius: 6,
      maxBarThickness: 34,
      categoryPercentage: 0.7,
      barPercentage: 0.9,
      order: 2
    },
    {
      type: 'line',
      label: '2045 goal path',
      data: goalData,
      borderColor: COLORS.commitment,
      borderWidth: 2,
      borderDash: [4, 5],
      pointRadius: 0,
      tension: 0,
      fill: false,
      order: 1
    }
  ];

  return new Chart(ctx, {
    type: 'bar',
    data: { labels: cats, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 12 } },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            title: items => items[0].label,
            label: c => {
              if (c.parsed.y == null) return null;
              if (c.dataset.type === 'line') return ` 2045 goal path: ${formatEmissionsFull(c.parsed.y)}`;
              const y = cats[c.dataIndex];
              const lbl = reportedByYear[y] != null ? 'Reported' : 'Projection';
              return ` ${lbl}: ${formatEmissionsFull(c.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { ...axisDefaults().ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
        },
        y: {
          ...axisDefaults(),
          beginAtZero: true,
          ticks: { ...axisDefaults().ticks, callback: v => formatEmissionsShort(v) }
        }
      }
    },
    plugins: [commitmentDeadlinePlugin(policy.targetYear)]
  });
}

export function createScopeChart(canvas, { scope1, scope2, scope3, year }) {
  const ctx = canvas.getContext('2d');
  const total = scope1 + scope2 + scope3;
  if (!total) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Scope 1. On-campus', 'Scope 2. Purchased energy', 'Scope 3. Commute & travel'],
      datasets: [{
        data: [scope1, scope2, scope3],
        backgroundColor: [COLORS.scope1, COLORS.scope2, COLORS.scope3],
        borderColor: '#19222F',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter', size: 11.5 },
            color: '#AEB9C7',
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            label: c => {
              const val = typeof c.parsed === 'number' ? c.parsed : c.raw;
              return ` ${c.label}: ${formatEmissionsFull(val)}`;
            }
          }
        },
        title: {
          display: true,
          text: `Scope breakdown · ${year}`,
          font: { family: 'Inter', size: 12.5, weight: '600' },
          color: '#EAEEF4',
          padding: { bottom: 8 }
        }
      }
    }
  });
}

export function createComparisonChart(canvas, { items }) {
  const ctx = canvas.getContext('2d');
  const sorted = [...items].sort((a, b) => b.metrics.latest.emissions - a.metrics.latest.emissions);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(i => i.campus.shortName),
      datasets: [
        {
          label: 'Latest reported',
          data: sorted.map(i => i.metrics.latest.emissions),
          backgroundColor: COLORS.actual,
          borderWidth: 0,
          borderRadius: 5
        },
        {
          label: '2045 goal (90% cut)',
          data: sorted.map(i => i.metrics.targetEmissions),
          backgroundColor: 'rgba(91, 141, 239, 0.55)',
          borderWidth: 0,
          borderRadius: 5
        },
        {
          label: 'Projected 2045',
          data: sorted.map(i => i.forecast?.projections?.[2045] ?? null),
          backgroundColor: 'rgba(226, 160, 74, 0.6)',
          borderWidth: 0,
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      categoryPercentage: 0.72,
      barPercentage: 0.9,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 11.5 }, color: '#AEB9C7', padding: 16, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            label: c => {
              const val = c.parsed.x ?? c.parsed.y;
              return val != null ? ` ${c.dataset.label}: ${formatEmissionsFull(val)}` : null;
            }
          }
        }
      },
      scales: {
        x: {
          ...axisDefaults(),
          ticks: { ...axisDefaults().ticks, callback: v => formatEmissionsShort(v) }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { family: 'Inter', size: 11.5, weight: '500' }, color: '#EAEEF4' }
        }
      }
    }
  });
}

export function createModelComparisonChart(canvas, { models }) {
  if (!models?.length) return null;
  const ctx = canvas.getContext('2d');
  const sorted = [...models].sort((a, b) => a.loocvRmse - b.loocvRmse);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(m => m.name),
      datasets: [{
        label: 'Cross-validation error',
        data: sorted.map(m => m.loocvRmse),
        backgroundColor: sorted.map((m, i) => i === 0 ? '#E2A04A' : 'rgba(226,160,74,.4)'),
        borderRadius: 5,
        maxBarThickness: 26
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      categoryPercentage: 0.78,
      barPercentage: 0.9,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipDefaults,
          callbacks: {
            afterLabel: c => {
              const m = sorted[c.dataIndex];
              return [` Fit (R²): ${m.r2.toFixed(2)}`];
            },
            label: c => ` Typical error: ±${Math.round(c.parsed.x).toLocaleString()} t CO₂e`
          }
        }
      },
      scales: {
        x: {
          ...axisDefaults(),
          ticks: { ...axisDefaults().ticks, callback: v => formatEmissionsShort(v) }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { family: 'Inter', size: 10.5 }, color: '#EAEEF4' }
        }
      }
    }
  });
}
