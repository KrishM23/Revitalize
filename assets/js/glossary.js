/* Revitalize | shared glossary popovers for key climate terms */

export const GLOSSARY = {
  't-co2e': {
    title: 'What is t CO₂e?',
    body: [
      'Metric tons of carbon dioxide equivalent. One number that adds up all greenhouse gases by climate impact.'
    ],
    example: '1 tonne ≈ a gas car driving about 2,500 miles.'
  },
  'baseline-2019': {
    title: 'What is the 2019 baseline?',
    body: [
      'UC uses 2019 as the reference year for its climate promise.',
      'Progress is measured against how much the campus emitted that year.'
    ],
    example: 'A 10% cut since 2019 is about 11% of the way toward a 90% reduction.'
  },
  'goal-2045': {
    title: 'What is the 2045 goal?',
    body: [
      'UC committed to a 90% reduction in greenhouse gas emissions from 2019 levels by 2045.',
      'That is close to carbon neutrality: emissions are so low they can be offset or eliminated.'
    ]
  },
  'projected': {
    title: 'What does projected mean?',
    body: [
      'An estimate of where emissions are headed based on the trend since 2019.',
      'If nothing changes, this is roughly where the campus would land by 2030 or 2045.'
    ],
    example: 'Projections are not guarantees. New projects can bend the curve.'
  },
  'annual-cut': {
    title: 'What does % per year mean?',
    body: [
      'The average amount emissions need to fall each year to reach the 2045 goal on time.',
      'A higher number means faster cuts are needed.'
    ],
    example: 'Needing 10% per year means cutting roughly one-tenth of emissions every year.'
  },
  'scope-1': {
    title: 'What is Scope 1?',
    body: [
      'Direct emissions from fuel burned on campus.',
      'Examples include gas heating, boilers, and on-site power plants.'
    ]
  },
  'scope-2': {
    title: 'What is Scope 2?',
    body: [
      'Emissions from electricity the campus buys from the grid.',
      'Cleaner grid power or on-site solar lowers this number.'
    ]
  },
  'scope-3': {
    title: 'What is Scope 3?',
    body: [
      'Indirect emissions the campus does not burn directly.',
      'Examples include commuting, business air travel, and purchased goods.'
    ]
  },
  'climate-tier': {
    title: 'What are climate tiers?',
    body: [
      'A ranking based on how close each campus is to the 2045 goal.',
      'Ranges from Sprout (just starting) to Legend (on track or ahead).'
    ]
  },
  'goal-progress': {
    title: 'What is goal progress?',
    body: [
      'How far along a campus is toward the full 90% cut required by 2045.',
      'If emissions fell 27% since 2019, that is about 30% of the way to a 90% reduction.'
    ]
  }
};

/** Inline ? button that opens a glossary popover. */
export function glossaryBtn(id, label = '?') {
  if (!GLOSSARY[id]) return '';
  return `<button type="button" class="unit-tip" aria-describedby="gloss-${id}" aria-label="What does this mean?">${label}</button>`;
}

/** Render hidden tooltip panels for the given term ids (or all terms). */
export function renderGlossaryPopups(ids = null) {
  const entries = ids
    ? ids.map(id => [id, GLOSSARY[id]]).filter(([, term]) => term)
    : Object.entries(GLOSSARY);
  return entries.map(([id, term]) => `
    <div class="unit-tip-popup" id="gloss-${id}" role="tooltip">
      <strong>${term.title}</strong>
      ${term.body.map(p => `<p>${p}</p>`).join('')}
      ${term.example ? `<p class="unit-tip-example">${term.example}</p>` : ''}
    </div>
  `).join('');
}

/** Wire click/keyboard handlers for all .unit-tip triggers inside root. */
let glossaryDocBound = false;
let activeTip = null;

function positionGlossaryTip(trigger, tip) {
  const rect = trigger.getBoundingClientRect();
  tip.classList.add('is-open');
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;
  if (left + tipRect.width > window.innerWidth - 16) {
    left = window.innerWidth - tipRect.width - 16;
  }
  if (top + tipRect.height > window.innerHeight - 16) {
    top = rect.top - tipRect.height - 8;
  }
  tip.style.left = `${Math.max(16, left)}px`;
  tip.style.top = `${Math.max(16, top)}px`;
}

export function closeGlossaryTip() {
  if (!activeTip) return;
  activeTip.tip.classList.remove('is-open');
  activeTip.trigger.setAttribute('aria-expanded', 'false');
  activeTip.tip.style.left = '';
  activeTip.tip.style.top = '';
  activeTip = null;
}

function openGlossaryTip(trigger) {
  const tip = document.getElementById(trigger.getAttribute('aria-describedby'));
  if (!tip) return;
  if (activeTip?.trigger === trigger) {
    closeGlossaryTip();
    return;
  }
  closeGlossaryTip();
  positionGlossaryTip(trigger, tip);
  trigger.setAttribute('aria-expanded', 'true');
  activeTip = { trigger, tip };
}

export function setupGlossaryTips(root = document) {
  const triggers = root.querySelectorAll('.unit-tip[aria-describedby]:not([data-glossary-bound])');
  if (!triggers.length && glossaryDocBound) return;

  triggers.forEach(trigger => {
    trigger.dataset.glossaryBound = '1';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openGlossaryTip(trigger);
    });
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGlossaryTip(trigger);
      }
    });
  });

  if (!glossaryDocBound) {
    document.addEventListener('click', closeGlossaryTip);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeGlossaryTip();
    });
    glossaryDocBound = true;
  }
}
