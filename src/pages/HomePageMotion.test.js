import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './HomePage';
import fs from 'fs';
import path from 'path';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/UsageContext', () => ({ useUsage: () => ({ usage: null }) }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const HERO_ANSWER = 'Представьте: 14 сентября 2027-го вы говорите «да» человеку, которого сегодня зовёте «просто другом». А теперь вопрос от вашей Венеры в Близнецах: кому вы пишете первым, когда хочется рассказать что-то смешное?';
const DEMO_ANSWER = 'В этой карте Луна в Скорпионе может быть интересной отправной точкой для разговора о близости и доверии. Но сама карта не расскажет, что именно повторяется в вашей жизни.\n\nЧто вам знакомо больше: вас привлекают похожие люди, становится сложно доверять или хочется отдалиться, когда отношения становятся серьёзнее?';
const BRANCH_TRUST = 'Недоверие может быть способом защитить важную для вас эмоциональную глубину. В каких ситуациях оно возникает сильнее: когда человек отдаляется, когда становится слишком близко или когда вам не хватает ясности?';

let root, container, observers, originalMatchMedia, originalObserver;

class MockObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
  observe(target) { this.targets.add(target); }
  unobserve(target) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
}
const intersect = (target, isIntersecting = true) => act(() => {
  observers.forEach(observer => { if (observer.targets.has(target)) observer.callback([{ target, isIntersecting }], observer); });
});
const intersectEverything = () => act(() => {
  observers.forEach(observer => [...observer.targets].forEach(target => observer.callback([{ target, isIntersecting: true }], observer)));
});
// One act per tick: each typed character is a React update that schedules the next timer.
const advance = async ms => { for (let spent = 0; spent < ms; spent += 10) await act(async () => { jest.advanceTimersByTime(10); }); };

async function mount({ reduced }) {
  window.matchMedia = jest.fn(query => ({ matches: reduced && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
  window.IntersectionObserver = MockObserver;
  await act(async () => root.render(<HomePage />));
}
const heroAnswer = () => container.querySelector('.landing-demo-mini .landing-message:not(.landing-message-user) p');
const demo = () => container.querySelector('#conversation-demo .landing-demo');
const demoAnswer = () => demo().querySelector('.landing-message:not(.landing-message-user) p');
// Number of times a path of "M x y" + cubic "C" segments crosses itself (curve sampled into short chords).
function selfCrossings(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [[nums[0], nums[1]]];
  for (let i = 2; i + 5 < nums.length + 0; i += 6) {
    const [p0, p1, p2, p3] = [pts[pts.length - 1], [nums[i], nums[i + 1]], [nums[i + 2], nums[i + 3]], [nums[i + 4], nums[i + 5]]];
    for (let step = 1; step <= 40; step += 1) {
      const t = step / 40, u = 1 - t;
      pts.push([0, 1].map(k => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k]));
    }
  }
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  let count = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (let j = i + 2; j < pts.length - 1; j += 1) {
      if (side(pts[i], pts[i + 1], pts[j]) !== side(pts[i], pts[i + 1], pts[j + 1])
        && side(pts[j], pts[j + 1], pts[i]) !== side(pts[j], pts[j + 1], pts[i + 1])) count += 1;
    }
  }
  return count;
}
const typed = p => p.querySelector('.landing-typed').textContent;

beforeEach(() => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  observers = [];
  originalMatchMedia = window.matchMedia;
  originalObserver = window.IntersectionObserver;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.matchMedia = originalMatchMedia;
  window.IntersectionObserver = originalObserver;
  jest.useRealTimers();
});

test('reduced motion: both answers are complete at once, no cursor, no hidden blocks', async () => {
  await mount({ reduced: true });
  expect(heroAnswer().textContent).toBe(HERO_ANSWER);
  expect(demoAnswer().textContent).toBe(DEMO_ANSWER);
  expect(typed(demoAnswer())).toBe(DEMO_ANSWER);
  expect(container.querySelector('.landing-caret')).toBeNull();
  expect(container.querySelector('.landing-reveal')).toBeNull();
  expect(container.querySelector('.is-live')).toBeNull();
});

test('motion allowed: the demo answer types out after its block enters the viewport and ends with the original text', async () => {
  await mount({ reduced: false });
  const answer = demoAnswer();
  expect(typed(answer)).toBe('');
  expect(accessibleText(answer)).toBe(DEMO_ANSWER);
  await advance(2000);
  expect(typed(answer)).toBe('');
  await intersect(answer);
  await advance(300);
  const partial = typed(answer);
  expect(partial.length).toBeGreaterThan(0);
  expect(partial.length).toBeLessThan(DEMO_ANSWER.length);
  expect(DEMO_ANSWER.startsWith(partial)).toBe(true);
  expect(answer.querySelector('.landing-caret')).not.toBeNull();
  await advance(20000);
  expect(typed(answer)).toBe(DEMO_ANSWER);
  expect(accessibleText(answer)).toBe(DEMO_ANSWER);
  expect(answer.querySelector('.landing-caret')).toBeNull();
});

test('the hero answer types out once and does not restart when it leaves and re-enters the viewport', async () => {
  await mount({ reduced: false });
  const answer = heroAnswer();
  await intersect(answer);
  await advance(20000);
  expect(typed(answer)).toBe(HERO_ANSWER);
  await intersect(answer, false);
  await intersect(answer);
  expect(typed(answer)).toBe(HERO_ANSWER);
});

test('demo choices keep working while the first answer is typing, and the chosen answer types out too', async () => {
  await mount({ reduced: false });
  await intersect(demoAnswer());
  await advance(200);
  const buttons = [...demo().querySelectorAll('.landing-demo-options button')];
  await act(async () => buttons[1].click());
  expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  expect(demo().querySelectorAll('.landing-message')).toHaveLength(4);
  expect(demo().textContent).toContain('Мне сложно доверять');
  const branch = demo().querySelectorAll('.landing-message:not(.landing-message-user) p')[1];
  expect(accessibleText(branch)).toBe(BRANCH_TRUST);
  expect(typed(branch)).toBe('');
  await intersectEverything();
  await advance(20000);
  expect(typed(branch)).toBe(BRANCH_TRUST);
  await act(async () => buttons[2].click());
  expect(demo().querySelectorAll('.landing-message')).toHaveLength(4);
  expect(demo().textContent).toContain('Я отдаляюсь, когда становится серьёзно');
});

test('the page text is identical with and without motion', async () => {
  await mount({ reduced: true });
  const still = container.textContent;
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount({ reduced: false });
  // The only difference is the single screen-reader copy of each typed answer (clipped, not drawn).
  container.querySelectorAll('.landing-message .sr-only').forEach(node => node.remove());
  expect(container.textContent).toBe(still);
});

test('motion allowed: blocks below the first screen fade in once; the demo chart is live only while visible', async () => {
  await mount({ reduced: false });
  const shells = [...container.querySelectorAll('.landing-v2 > section:not(.landing-hero) > .shell')];
  expect(shells).toHaveLength(8);
  shells.forEach(shell => {
    expect(shell.classList.contains('landing-reveal')).toBe(true);
    expect(shell.classList.contains('is-in')).toBe(false);
  });
  expect(container.querySelector('.landing-hero .landing-reveal')).toBeNull();
  await intersect(shells[2]);
  expect(shells[2].classList.contains('is-in')).toBe(true);
  expect(shells[3].classList.contains('is-in')).toBe(false);
  await intersect(shells[2], false);
  expect(shells[2].classList.contains('is-in')).toBe(true);

  const figure = container.querySelector('.landing-chart-visual');
  expect(figure.classList.contains('is-live')).toBe(false);
  await intersect(figure);
  expect(figure.classList.contains('is-live')).toBe(true);
  await intersect(figure, false);
  expect(figure.classList.contains('is-live')).toBe(false);
});

// What a screen reader gets: everything except aria-hidden parts (the cursor).
const accessibleText = p => { const copy = p.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove()); return copy.textContent; };

test('screen readers get the full answer before and during typing, without busy flags', async () => {
  await mount({ reduced: false });
  const answer = demoAnswer();
  expect(accessibleText(answer)).toBe(DEMO_ANSWER);
  expect(answer.hasAttribute('aria-busy')).toBe(false);
  await intersect(answer);
  await advance(300);
  expect(answer.querySelector('.landing-caret')).not.toBeNull();
  expect(accessibleText(answer)).toBe(DEMO_ANSWER);
  expect(answer.hasAttribute('aria-busy')).toBe(false);
});

test('css: untyped rest is hidden inside the aria-hidden layer, cursor is a zero-width inline border, print shows everything', () => {
  const css = fs.readFileSync(path.join(__dirname, 'HomePage.css'), 'utf8');
  const rest = css.match(/\.landing-typed-rest \{[^}]*\}/)[0];
  expect(rest).toContain('visibility: hidden');
  const caret = css.match(/\.landing-caret \{[^}]*\}/)[0];
  expect(caret).toContain('border-left');
  expect(caret).not.toContain('inline-block');
  expect(caret).not.toMatch(/width/);
  expect(css).toMatch(/@media print \{[^@]*visibility: visible/);
});

test('screen-reader text is one stable copy: all typing changes happen inside the aria-hidden layer', async () => {
  await mount({ reduced: false });
  const answer = demoAnswer();
  const copies = answer.querySelectorAll('.sr-only');
  expect(copies).toHaveLength(1);
  expect(copies[0].textContent).toBe(DEMO_ANSWER);
  const records = [];
  const watcher = new MutationObserver(list => records.push(...list));
  watcher.observe(answer, { subtree: true, childList: true, characterData: true, attributes: true });
  await intersect(answer);
  await advance(20000);
  records.push(...watcher.takeRecords());
  watcher.disconnect();
  expect(records.length).toBeGreaterThan(50);
  // A changed node is never the paragraph or the screen-reader copy; nodes still in the tree sit inside aria-hidden
  // (typed text nodes swapped out by React are already detached when the records are read).
  const copy = answer.querySelector('.sr-only');
  records.forEach(record => {
    expect(record.target).not.toBe(answer);
    expect(copy.contains(record.target)).toBe(false);
    const node = record.target.nodeType === 3 ? record.target.parentElement : record.target;
    if (node) expect(node.closest('[aria-hidden="true"]')).not.toBeNull();
  });
  expect(answer.querySelector('.sr-only').textContent).toBe(DEMO_ANSWER);
  expect(accessibleText(answer)).toBe(DEMO_ANSWER);
});

test('click cue: static when motion is reduced; otherwise draws itself once when the block is seen', async () => {
  await mount({ reduced: true });
  const staticCue = demo().querySelector('.landing-demo-cue');
  expect(staticCue.classList.contains('is-static')).toBe(true);
  expect(staticCue.querySelector('.landing-demo-cue-line')).not.toBeNull();
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount({ reduced: false });
  const cue = demo().querySelector('.landing-demo-cue');
  expect(cue.classList.contains('is-pending')).toBe(true);
  await intersect(cue);
  expect(cue.classList.contains('is-drawn')).toBe(true);
  await intersect(cue, false);
  await intersect(cue);
  expect(cue.classList.contains('is-drawn')).toBe(true);
  expect(cue.classList.contains('is-pending')).toBe(false);
});

test('click cue: decorative, sits in the buttons grid next to the middle choice, never in the text column', async () => {
  await mount({ reduced: true });
  const group = demo().querySelector('.landing-demo-options');
  const cue = group.querySelector(':scope > .landing-demo-cue');
  expect(cue).not.toBeNull();
  expect(cue.getAttribute('aria-hidden')).toBe('true');
  expect(cue.textContent).toBe('Нажмите');
  expect(group.lastElementChild).toBe(cue);
  const css = fs.readFileSync(path.join(__dirname, 'HomePage.css'), 'utf8');
  const cueRule = css.match(/\.landing-demo-options > \.landing-demo-cue \{[^}]*\}/)[0];
  expect(cueRule).toContain('grid-column: 2');
  expect(cueRule).toContain('grid-row: 2');
  expect(cueRule).toContain('align-self: center');
});

test('click cue: minimalist - one smooth loop and a clean two-stroke head, no sparkle; reduced-motion CSS stops every cue animation', async () => {
  await mount({ reduced: true });
  const cue = demo().querySelector('.landing-demo-cue');
  expect(cue.querySelector('.landing-demo-cue-spark')).toBeNull();
  expect(cue.querySelectorAll('svg path')).toHaveLength(2);
  expect(selfCrossings(cue.querySelector('.landing-demo-cue-line').getAttribute('d'))).toBe(1);
  const css = fs.readFileSync(path.join(__dirname, 'HomePage.css'), 'utf8');
  const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  // more specific state rules (.is-drawn ...) must not win over the reduced-motion block
  expect(reduce).toMatch(/\.landing-demo-cue[^{]*\{[^}]*animation: none !important/);
  expect(reduce).toMatch(/\.is-pending[^{]*\{[^}]*opacity: 1/);
});
