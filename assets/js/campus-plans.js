/* Revitalize | campus-specific climate action plans */

import {
  formatEmissionsShort,
  formatPercent,
  requiredAnnualRate,
  realizedAnnualRate
} from './analytics.js';

/* Campus-specific initiatives from UC 2024-2025 Annual Sustainability Reports */
export const CAMPUS_INITIATIVES = {
  systemwide: [
    { title: 'Pathways to a Fossil-Free UC', detail: 'Systemwide decarbonization roadmap compiled from campus energy studies, guiding phased fossil-fuel retirement across all locations.', status: 'Active' },
    { title: 'UC Clean Power Program', detail: '100% clean electricity for participating campuses since 2018, covering roughly 48% of UC\'s purchased power.', status: 'Active' },
    { title: 'SunZia wind contract', detail: '85 MW from New Mexico wind, the largest renewable energy commitment UC has made to date, serving every campus and health center.', status: 'Underway' }
  ],
  berkeley: [
    { title: 'Berkeley Clean Energy Campus (BCEC)', detail: 'All-electric utility infrastructure targeting ~85% building emissions cut when complete; in preliminary design and Regental approval.', status: 'In progress' },
    { title: 'All-electric new construction', detail: 'Over 1.4M sq ft of all-electric buildings under construction, including Bakar BioEnginuity Hub and Gateway.', status: 'In progress' },
    { title: 'Green lab expansion', detail: 'Incentive program tied to ultra-low-temperature freezer rebates. 28 new Green Lab certifications this cycle.', status: 'Active' }
  ],
  davis: [
    { title: 'Campus energy efficiency', detail: 'Continued HVAC retrofits and building controls to curb Scope 1 natural-gas use across the large Central Valley footprint.', status: 'Active' },
    { title: 'Sustainable transportation', detail: 'Expand EV fleet share and reduce drive-alone commuting, a major opportunity given Davis\'s spread-out campus.', status: 'Active' },
    { title: 'Agricultural carbon programs', detail: 'Leverage UC Davis research strengths in ag sustainability to pilot lower-emission campus food and land management.', status: 'Planned' }
  ],
  irvine: [
    { title: 'Central plant decarbonization', detail: 'Phase out gas cogeneration and shift to grid + on-site renewables as UCI expands in Orange County.', status: 'Planned' },
    { title: 'Commute & Scope 3 reduction', detail: 'Scope 3 is a large share of UCI\'s inventory. Expand transit passes, vanpools, and remote-work policies.', status: 'Active' },
    { title: 'LEED portfolio expansion', detail: 'Continue certifying new construction to Gold/Platinum as the campus ring grows around Aldrich Park.', status: 'Active' }
  ],
  ucla: [
    { title: 'Sustainability Plan dashboard', detail: 'Public tracking of UCLA\'s climate plan milestones. Helps measure progress toward 2045 targets.', status: 'Active' },
    { title: 'Sustainable move-out program', detail: 'Diverts furniture and goods from landfill during student turnover, cutting waste-related Scope 3.', status: 'Active' },
    { title: 'Scope 3 commute & travel', detail: 'Business air travel and commuting rose post-pandemic, a priority area given UCLA\'s flat progress vs. 2019.', status: 'Priority' }
  ],
  merced: [
    { title: 'Net-zero Scopes 1 & 2', detail: 'Merced already offsets direct emissions via voluntary carbon credits. The focus shifts to real reductions and Scope 3.', status: 'Active' },
    { title: 'Experimental Smart Farm', detail: 'Student-led ag tech pilots for low-carbon food and land use on the newest UC campus.', status: 'Active' },
    { title: 'All-electric growth', detail: 'As the smallest and fastest-growing campus, electrify all new buildings to avoid locking in gas infrastructure.', status: 'In progress' }
  ],
  riverside: [
    { title: 'Scope 2 clean electricity', detail: 'Purchased electricity is a major emissions source at UCR. Expand UC Clean Power participation and on-site solar.', status: 'Priority' },
    { title: 'Green building pipeline', detail: 'Certify new lab and housing projects to LEED Gold+ as the Inland Empire campus expands.', status: 'Active' },
    { title: 'Fleet electrification', detail: 'Increase the share of zero-emission vehicles in the campus fleet and charging infrastructure.', status: 'Active' }
  ],
  ucsd: [
    { title: 'Cogeneration plant transition', detail: 'UCSD\'s large cogeneration plant is a core Scope 1 source. Engine replacements and grid power shift are underway.', status: 'In progress' },
    { title: 'SunZia wind allocation', detail: 'UCSD receives a share of the systemwide SunZia wind contract for cleaner purchased electricity.', status: 'Underway' },
    { title: 'Scope 3 business travel', detail: 'Air travel and commuting remain significant. Expand videoconferencing policies and transit incentives.', status: 'Active' }
  ],
  ucsf: [
    { title: 'Multiuse anesthesia circuits', detail: 'UCSF transitioned to reusable breathing circuits in operating rooms, cutting high-GWP anesthetic gas releases.', status: 'Completed' },
    { title: 'Scope 3 supply chain inventory', detail: 'Health-sector supply chain is the largest emissions source. Procurement shifts to lower-carbon suppliers.', status: 'In progress' },
    { title: 'Health Sector Climate Pledge', detail: 'UCSF committed to White House/HHS pledge. Equity-centered resilience and decarbonization plans.', status: 'Active' }
  ],
  ucsb: [
    { title: 'Coastal resilience & energy', detail: 'Protect buildings and microgrids against sea-level rise while cutting gas use in coastal facilities.', status: 'Active' },
    { title: 'Scope 3 commuting', detail: 'Commuting dominates UCSB\'s relatively small total. Expand bike infrastructure and campus shuttles.', status: 'Priority' },
    { title: 'LEED lab retrofits', detail: 'Green lab certification and freezer rebates for research buildings along the coast.', status: 'Active' }
  ],
  ucsc: [
    { title: 'Forest-campus energy', detail: 'Reduce gas heating across hillside buildings through heat pumps and building envelope upgrades.', status: 'Active' },
    { title: 'Scope 3 growth management', detail: 'Scope 3 rose sharply in recent years. Target commuting and air travel as in-person activity returns.', status: 'Priority' },
    { title: 'Water & land stewardship', detail: 'Leverage UCSC\'s environmental sciences strengths for land-management carbon benefits.', status: 'Active' }
  ]
};

/* Plain-language names for each emissions scope, for readers new to the terms */
export const SCOPE_LABELS = {
  1: 'On-campus fuel',
  2: 'Purchased electricity',
  3: 'Travel, commuting & supplies'
};

const SCOPE_ACTIONS = {
  1: {
    title: 'Switch buildings off gas and onto electricity',
    detail: 'Replace gas boilers, chillers, and on-site power plants with heat pumps and all-electric systems. UC\'s own studies point to this as the single biggest way to cut fuel burned on campus.',
    timeline: 'near'
  },
  2: {
    title: 'Buy more clean electricity',
    detail: 'Add more campus solar and expand UC Clean Power and systemwide renewables such as the SunZia wind project, so the power the campus buys is cleaner.',
    timeline: 'near'
  },
  3: {
    title: 'Reduce travel, commuting, and waste',
    detail: 'Grow transit passes, remote-work options, videoconferencing, and lower-carbon purchasing. These indirect sources have grown again as in-person activity returned.',
    timeline: 'mid'
  }
};

function scopeShares(scopeData, total) {
  if (!scopeData || !total) return null;
  return {
    scope1: (scopeData.scope1 / total) * 100,
    scope2: (scopeData.scope2 / total) * 100,
    scope3: (scopeData.scope3 / total) * 100
  };
}

function dominantScope(shares) {
  if (!shares) return null;
  const entries = [
    ['scope1', shares.scope1],
    ['scope2', shares.scope2],
    ['scope3', shares.scope3]
  ].filter(([, v]) => Number.isFinite(v));
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

function timelineLabel(key) {
  return { near: 'Now - 2030', mid: '2030 - 2035', long: '2035 - 2045' }[key] ?? key;
}

function phaseTitle(key) {
  return {
    near: 'Start now',
    mid: 'Build momentum',
    long: 'Finish the job'
  }[key] ?? key;
}

function phaseSub(key) {
  return {
    near: 'The actions with the biggest and fastest payoff.',
    mid: 'Build on early progress through 2035.',
    long: 'The final steps to reach the 2045 goal.'
  }[key] ?? '';
}

function priorityFromGap(gapToPace, share) {
  if (gapToPace > 0 && share >= 30) return 'high';
  if (gapToPace > 0 || share >= 25) return 'medium';
  return 'standard';
}

/**
 * Build a campus-specific action plan from emissions metrics and scope data.
 */
export function buildCampusPlan({ campus, metrics, forecast, scopeData, policy }) {
  if (!metrics || !campus) return null;

  const { latest, baselineEmissions, targetEmissions, pctFromBaseline, pctOfGoal, gapToPace, onTrack } = metrics;
  const shares = scopeShares(scopeData, latest.emissions);
  const dom = dominantScope(shares);
  const required = requiredAnnualRate(latest.emissions, latest.year, targetEmissions, policy.targetYear);
  const realized = realizedAnnualRate(baselineEmissions, policy.baselineYear, latest.emissions, latest.year);
  const rateGap = (required != null && realized != null) ? required - realized : null;

  const reqStr = required != null ? `${required.toFixed(1)}%` : 'steady';
  const summary = onTrack
    ? `${campus.shortName} is on track for the 2045 carbon neutrality goal. Holding that course means cutting emissions about ${reqStr} every year from ${latest.year} onward.`
    : `To reach carbon neutrality by 2045, ${campus.shortName} needs to cut emissions about ${reqStr} every year starting in ${latest.year}${realized != null && realized > 0 ? `, faster than the ${realized.toFixed(1)}% per year it has averaged since 2019.` : ', a faster pace than recent years.'}`;

  const actions = [];

  // Pace-critical action
  if (!onTrack && rateGap != null && rateGap > 2) {
    actions.push({
      id: 'pace',
      scope: 'all',
      priority: 'high',
      timeline: 'near',
      title: 'Speed up the pace of cuts',
      detail: `Emissions are about ${formatEmissionsShort(gapToPace)} above the straight-line path to the 2045 goal. Catching up means cutting roughly ${required.toFixed(1)}% each year, about ${rateGap.toFixed(1)} points faster than the average since ${policy.baselineYear}.`,
      metric: `${formatPercent(pctOfGoal, 0)} of the way to the goal`
    });
  }

  // Scope-targeted actions
  if (shares) {
    for (const [key, scopeNum] of [['scope1', 1], ['scope2', 2], ['scope3', 3]]) {
      const share = shares[key];
      if (!Number.isFinite(share) || share < 15) continue;
      const base = SCOPE_ACTIONS[scopeNum];
      actions.push({
        id: `scope-${scopeNum}`,
        scope: scopeNum,
        priority: priorityFromGap(gapToPace, share),
        timeline: dom === key ? 'near' : base.timeline,
        title: base.title,
        detail: `About ${Math.round(share)}% of ${campus.shortName}'s emissions come from ${SCOPE_LABELS[scopeNum].toLowerCase()}. ${base.detail}`,
        metric: `${Math.round(share)}% of total emissions`
      });
    }
  }

  // Forecast gap action
  if (forecast && !forecast.error && forecast.gap2045 > 0) {
    actions.push({
      id: 'forecast',
      scope: 'all',
      priority: forecast.onTrack2045 ? 'standard' : 'high',
      timeline: 'long',
      title: 'Plan beyond the current trend',
      detail: `If recent trends continue, ${campus.shortName} would still emit about ${formatEmissionsShort(forecast.projections[2045])} in 2045, roughly ${formatEmissionsShort(forecast.gap2045)} above the goal. New projects will need to close that remaining gap.`,
      metric: `${forecast.projReductionPct ?? '...'}% projected cut by 2045`
    });
  }

  // Per-capita / enrollment growth (systemwide or large campuses)
  if (campus.enrollment && latest.emissions / campus.enrollment > 4) {
    actions.push({
      id: 'intensity',
      scope: 'all',
      priority: 'medium',
      timeline: 'mid',
      title: 'Lower emissions per student',
      detail: `Each student accounts for about ${Math.round(latest.emissions / campus.enrollment)} tonnes of CO₂e a year. Efficiency upgrades and slower growth in high-energy services can add up to large total cuts.`,
      metric: `${Math.round(latest.emissions / campus.enrollment)} t CO₂e per student`
    });
  }

  // Sort: high priority first, then near timeline
  const prio = { high: 0, medium: 1, standard: 2 };
  const time = { near: 0, mid: 1, long: 2 };
  actions.sort((a, b) => prio[a.priority] - prio[b.priority] || time[a.timeline] - time[b.timeline]);

  const initiatives = CAMPUS_INITIATIVES[campus.id] ?? CAMPUS_INITIATIVES.systemwide;

  const phases = ['near', 'mid', 'long']
    .map(key => ({
      key,
      label: timelineLabel(key),
      title: phaseTitle(key),
      sub: phaseSub(key),
      items: actions.filter(a => a.timeline === key)
    }))
    .filter(p => p.items.length);

  return {
    summary,
    onTrack,
    required,
    realized,
    pctFromBaseline,
    pctOfGoal,
    gapToPace,
    actions,
    phases,
    initiatives,
    dominantScope: dom
  };
}

export function renderPlanAction(action) {
  const prioClass = action.priority === 'high' ? 'plan-priority-high' : action.priority === 'medium' ? 'plan-priority-med' : '';
  const scopeLabel = action.scope === 'all'
    ? 'Whole campus'
    : `Scope ${action.scope} · ${SCOPE_LABELS[action.scope] ?? ''}`;
  const flag = action.priority === 'high'
    ? '<span class="plan-flag">Start here</span>'
    : action.priority === 'medium'
      ? '<span class="plan-flag plan-flag-med">Worth prioritizing</span>'
      : '';
  return `
    <article class="plan-card ${prioClass}">
      <div class="plan-card-top">
        <span class="plan-scope scope-${action.scope}">${scopeLabel}</span>
        ${flag}
      </div>
      <h4>${action.title}</h4>
      <p>${action.detail}</p>
      ${action.metric ? `<p class="plan-metric">${action.metric}</p>` : ''}
    </article>`;
}

export function renderInitiative(item) {
  const statusClass = item.status === 'Completed' ? 'done'
    : item.status === 'Priority' ? 'focus'
    : 'active';
  return `
    <article class="plan-initiative">
      <div class="plan-initiative-head">
        <h4>${item.title}</h4>
        <span class="plan-status plan-status-${statusClass}">${item.status}</span>
      </div>
      <p>${item.detail}</p>
    </article>`;
}
