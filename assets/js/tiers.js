/* Carbon Trackers | climate progress tier system (12 shield ranks) */

/** @typedef {{ id: string, material: string, level: number, min: number, max: number, title: string, tagline: string, label: string }} TierDef */

const MATERIALS = {
  bronze: { base: '#6B7F5E', light: '#9AAF8A', dark: '#465240', rim: '#B8C8AA', glow: 'rgba(107,127,94,.35)' },
  silver: { base: '#A8B4C4', light: '#D8E2EC', dark: '#6E7A8A', rim: '#EEF2F6', glow: 'rgba(168,180,196,.35)' },
  gold: { base: '#E8B84A', light: '#F5D078', dark: '#B8862A', rim: '#FFE8B0', glow: 'rgba(232,184,74,.4)' },
  diamond: { base: '#5BC4E8', light: '#9AE4FF', dark: '#2A8FB8', rim: '#D0F4FF', glow: 'rgba(91,196,232,.45)' }
};

/** Ordered lowest → highest; thresholds use progress-to-2045-goal %. */
export const TIER_LADDER = [
  { id: 'bronze-1', material: 'bronze', level: 1, min: 0, max: 10, title: 'Sprout', tagline: 'Every journey starts with a first step.', label: 'Bronze I' },
  { id: 'bronze-2', material: 'bronze', level: 2, min: 10, max: 20, title: 'Sapling', tagline: 'Early roots are taking hold.', label: 'Bronze II' },
  { id: 'bronze-3', material: 'bronze', level: 3, min: 20, max: 30, title: 'Grove', tagline: 'Steady growth on the path.', label: 'Bronze III' },
  { id: 'silver-1', material: 'silver', level: 1, min: 30, max: 40, title: 'Spark', tagline: 'Momentum is building.', label: 'Silver I' },
  { id: 'silver-2', material: 'silver', level: 2, min: 40, max: 50, title: 'Stream', tagline: 'Consistent cuts add up.', label: 'Silver II' },
  { id: 'silver-3', material: 'silver', level: 3, min: 50, max: 60, title: 'Surge', tagline: 'Halfway to the promise.', label: 'Silver III' },
  { id: 'gold-1', material: 'gold', level: 1, min: 60, max: 70, title: 'Rise', tagline: 'Leading from the front.', label: 'Gold I' },
  { id: 'gold-2', material: 'gold', level: 2, min: 70, max: 80, title: 'Rally', tagline: 'Others are watching.', label: 'Gold II' },
  { id: 'gold-3', material: 'gold', level: 3, min: 80, max: 90, title: 'Radiant', tagline: 'Almost at the summit.', label: 'Gold III' },
  { id: 'diamond-1', material: 'diamond', level: 1, min: 90, max: 95, title: 'Guardian', tagline: 'On pace for 2045.', label: 'Diamond I' },
  { id: 'diamond-2', material: 'diamond', level: 2, min: 95, max: 100, title: 'Luminary', tagline: 'The goal is in sight.', label: 'Diamond II' },
  { id: 'diamond-3', material: 'diamond', level: 3, min: 100, max: Infinity, title: 'Legend', tagline: 'Goal achieved.', label: 'Diamond III' }
];

/**
 * @param {number} pctOfGoal Progress toward 2045 goal (0-100+)
 * @returns {TierDef}
 */
export function getTier(pctOfGoal) {
  const p = Math.max(0, pctOfGoal ?? 0);
  for (let i = TIER_LADDER.length - 1; i >= 0; i--) {
    if (p >= TIER_LADDER[i].min) return TIER_LADDER[i];
  }
  return TIER_LADDER[0];
}

/** @param {TierDef} tier */
export function getNextTier(tier) {
  const idx = TIER_LADDER.findIndex(t => t.id === tier.id);
  return idx >= 0 && idx < TIER_LADDER.length - 1 ? TIER_LADDER[idx + 1] : null;
}

/**
 * @param {number} pctOfGoal
 * @param {TierDef} [tier]
 */
export function tierProgress(pctOfGoal, tier = getTier(pctOfGoal)) {
  if (!Number.isFinite(tier.max) || tier.max === Infinity) return 1;
  const range = tier.max - tier.min;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, (pctOfGoal - tier.min) / range));
}

/**
 * @param {number} pctOfGoal
 * @param {TierDef} [tier]
 */
export function pointsToNextTier(pctOfGoal, tier = getTier(pctOfGoal)) {
  const next = getNextTier(tier);
  if (!next) return 0;
  return Math.max(0, next.min - pctOfGoal);
}

/** Shield body paths by level (viewBox 0 0 64 72). */
const SHIELD_PATHS = {
  1: 'M32 5 L50 13 L50 38 C50 54 42 64 32 68 C22 64 14 54 14 38 L14 13 Z',
  2: 'M32 3 L54 15 L50 40 C48 56 40 65 32 68 C24 65 16 56 14 40 L10 15 Z',
  3: 'M32 3 L54 15 L50 40 C48 56 40 65 32 68 C24 65 16 56 14 40 L10 15 Z'
};

let _shieldUid = 0;

/**
 * @param {string} material
 * @param {number} level 1-3
 * @param {{ size?: number, className?: string, title?: string, uid?: string }} [opts]
 */
export function renderShield(material, level, opts = {}) {
  const size = opts.size ?? 64;
  const pal = MATERIALS[material] ?? MATERIALS.bronze;
  const lvl = Math.min(3, Math.max(1, level));
  const uid = opts.uid ?? `sh${++_shieldUid}`;
  const path = SHIELD_PATHS[lvl];
  const star = lvl === 1 ? 'M32 30 L34.2 36.5 L41 36.5 L35.4 40.5 L37.6 47 L32 43 L26.4 47 L28.6 40.5 L23 36.5 L29.8 36.5 Z'
    : lvl === 2 ? 'M32 28 L35 37 L44.5 37 L37 42.5 L39.5 52 L32 46 L24.5 52 L27 42.5 L19.5 37 L29 37 Z'
    : 'M32 26 L36 38 L48 38 L38.5 45 L42 57 L32 49 L22 57 L25.5 45 L16 38 L28 38 Z';

  const wingExtra = lvl === 3
    ? `<path d="M6 28 L2 36 L8 38 Z" fill="${pal.dark}"/><path d="M58 28 L62 36 L56 38 Z" fill="${pal.dark}"/>`
    : '';

  return `<svg class="tier-shield ${opts.className ?? ''}" width="${size}" height="${Math.round(size * 1.125)}" viewBox="0 0 64 72" role="img"${opts.title ? ` aria-label="${opts.title}"` : ''}>
    <defs>
      <linearGradient id="grad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.light}"/>
        <stop offset="45%" stop-color="${pal.base}"/>
        <stop offset="100%" stop-color="${pal.dark}"/>
      </linearGradient>
      <filter id="glow-${uid}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${pal.glow}"/></filter>
    </defs>
    ${wingExtra}
    <path d="${path}" fill="url(#grad-${uid})" stroke="${pal.rim}" stroke-width="1.5" filter="url(#glow-${uid})"/>
    <path d="${star}" fill="${pal.rim}" opacity="0.95"/>
  </svg>`;
}

/**
 * @param {TierDef} tier
 * @param {{ size?: number, showLabel?: boolean }} [opts]
 */
export function renderTierBadge(tier, opts = {}) {
  const size = opts.size ?? 40;
  const shield = renderShield(tier.material, tier.level, { size, title: tier.label });
  if (!opts.showLabel) return shield;
  return `<span class="tier-badge tier-${tier.material}" title="${tier.tagline}">
    ${shield}
    <span class="tier-badge-text"><strong>${tier.title}</strong><small>${tier.label}</small></span>
  </span>`;
}

/**
 * @param {number} pctOfGoal
 * @param {{ onTrack?: boolean }} [opts]
 */
export function tierProgressLabel(pctOfGoal, opts = {}) {
  const tier = getTier(pctOfGoal);
  const next = getNextTier(tier);
  const pct = Math.round(tierProgress(pctOfGoal, tier) * 100);
  if (!next) {
    return opts.onTrack
      ? `Highest tier reached. ${Math.round(pctOfGoal)}% of the way to 2045`
      : `Highest tier. Continue progress toward 2045`;
  }
  const gap = pointsToNextTier(pctOfGoal, tier);
  return `${pct}% through ${tier.label} · ${gap.toFixed(1)} pts to ${next.title} (${next.label})`;
}

/**
 * Build the 4×3 tier ladder grid HTML.
 * @param {{ campus: object, metrics: object }[]} items
 * @param {string} [activeCampusId]
 */
export function renderTierLadder(items, activeCampusId = null) {
  const byTier = Object.fromEntries(TIER_LADDER.map(t => [t.id, []]));
  for (const item of items) {
    const tier = getTier(item.metrics.pctOfGoal);
    byTier[tier.id].push(item);
  }

  const rows = [1, 2, 3];
  const cols = ['bronze', 'silver', 'gold', 'diamond'];

  let html = '<div class="tier-ladder-grid">';
  for (const row of rows) {
    for (const mat of cols) {
      const tier = TIER_LADDER.find(t => t.material === mat && t.level === row);
      const occupants = byTier[tier.id] ?? [];
      const isActive = occupants.some(o => o.campus.id === activeCampusId);
      html += `
        <div class="tier-ladder-cell${isActive ? ' active' : ''}${occupants.length ? ' has-campus' : ''}" data-tier="${tier.id}" title="${tier.tagline}">
          <div class="tier-ladder-shield">${renderShield(tier.material, tier.level, { size: 52, title: tier.label })}</div>
          <div class="tier-ladder-name">${tier.title}</div>
          <div class="tier-ladder-label">${tier.label}</div>
          <div class="tier-ladder-range">${tier.min}${tier.max === Infinity ? '+' : '-' + tier.max}%</div>
          <div class="tier-ladder-dots">
            ${occupants.map(o => `<span class="tier-dot" style="background:${o.campus.color}" title="${o.campus.shortName}"></span>`).join('')}
          </div>
        </div>`;
    }
  }
  html += '</div>';
  return html;
}
