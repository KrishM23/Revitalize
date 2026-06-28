/* Revitalize | progressive-enhancement entrance animations.
   Content is fully visible without JS; this only adds motion when allowed. */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Structural elements that animate once as they scroll into view.
const REVEAL_SELECTORS = [
  '.campus-banner',
  '.kpi-row > .metric-card',
  '.tier-hero',
  '.panel-row > .panel',
  '.panel-row > aside.panel',
  '.tier-reference-panel',
  'section[aria-label="All campuses"]',
  '.page-head',
  '.method-block',
  '.contact-hero',
  '.contact-grid > .contact-card',
  '.plans-hero',
  '.plans-grid > *',
  '.plans-initiatives > *'
];

// Containers whose injected children should animate in with a stagger.
const DYNAMIC_CONTAINERS = [
  '#campusGrid',
  '#tierReference',
  '#standingsList',
  '#compareTableBody',
  '#simContent',
  '#plansContent'
];

function prepare(el, index = 0) {
  if (el.dataset.reveal) return;
  el.dataset.reveal = '1';
  el.classList.add('reveal');
  // Cap the stagger so long lists don't feel slow.
  el.style.transitionDelay = `${Math.min(index, 8) * 55}ms`;
}

function reveal(el) {
  el.classList.add('is-visible');
}

function init() {
  if (REDUCED) return; // respect user preference; leave content as-is
  document.body.classList.add('motion-ready');

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        reveal(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  // Initial structural elements.
  REVEAL_SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      prepare(el, i);
      observer.observe(el);
    });
  });

  // Animate dynamically injected children (campus cards, tier rows, etc.).
  DYNAMIC_CONTAINERS.forEach(sel => {
    const container = document.querySelector(sel);
    if (!container) return;
    const mo = new MutationObserver(mutations => {
      let i = 0;
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          prepare(node, i++);
          observer.observe(node);
        });
      });
    });
    mo.observe(container, { childList: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
