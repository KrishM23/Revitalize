/* Revitalize | plain-language campus insight notes */

import { formatEmissionsShort, formatPercent } from './analytics.js';
import { SCOPE_LABELS } from './campus-plans.js';

/**
 * One or two sentences explaining why a campus looks the way it does.
 */
export function buildCampusInsight({ campus, metrics, forecast, scopeData, policy }) {
  if (!campus || !metrics || campus.id === 'systemwide') return '';

  const name = campus.shortName ?? campus.name;
  const lines = [];
  const baselineYear = policy?.baselineYear ?? 2019;

  if (scopeData && metrics.latest.emissions > 0) {
    const total = metrics.latest.emissions;
    const shares = [1, 2, 3]
      .map(scope => ({ scope, pct: (scopeData[`scope${scope}`] / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    const top = shares[0];
    if (top.pct >= 32) {
      lines.push(
        `${SCOPE_LABELS[top.scope]} is the biggest driver for ${name} right now (${Math.round(top.pct)}% of latest emissions).`
      );
    }
  }

  if (forecast && !forecast.error) {
    if (forecast.onTrack2045) {
      lines.push(
        `The current trend lands near ${formatEmissionsShort(forecast.projections[2045])} by 2045, which would meet the campus goal.`
      );
    } else if (forecast.gap2045 > 0) {
      lines.push(
        `On the current trend, ${name} would still finish about ${formatEmissionsShort(forecast.gap2045)} above the 2045 goal.`
      );
    }
  }

  if (metrics.pctFromBaseline < 3) {
    lines.push(`Emissions are still close to the ${baselineYear} baseline, so most of the work is still ahead.`);
  } else if (metrics.pctFromBaseline >= 12) {
    lines.push(
      `${name} has cut emissions ${formatPercent(metrics.pctFromBaseline)} since ${baselineYear}, which is real progress toward the 90% goal.`
    );
  }

  if (!metrics.onTrack) {
    lines.push(`The campus is behind the annual pace needed to hit 2045 on schedule.`);
  }

  if (!lines.length) {
    return `Open the what-if simulator or action plan to explore what would move ${name} closer to the 2045 goal.`;
  }

  return lines.slice(0, 2).join(' ');
}
