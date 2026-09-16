import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './HomePage';
import { LANDING_USE_CASES } from './landingIntent';

jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });

let root, container, originalFetch, originalObserver;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  originalFetch = global.fetch;
  originalObserver = global.ResizeObserver;
  global.ResizeObserver = jest.fn(() => { throw new Error('Static landing preview must not observe detached DOM'); });
  global.fetch = jest.fn(() => { throw new Error('Landing must not call the chat API'); });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<HomePage />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  global.ResizeObserver = originalObserver;
});

test('renders the eight final landing sections with the specified hierarchy and copy', () => {
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('h1').textContent).toBe('Не просто прочитайте свою натальную карту.Поговорите с ней.');
  const sections = [...container.querySelectorAll('.landing-v2 > section')];
  expect(sections).toHaveLength(8);
  sections.forEach(section => {
    const heading = section.querySelector('h1, h2');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });
  expect(container.textContent).toContain('От вашей карты до первого вопроса — три шага');
  expect(container.textContent).toContain('Одна карта — множество вопросов');
  expect(container.textContent).toContain('Вернитесь к разговору с того места, где остановились');
  expect(container.querySelector('.landing-pricing, .landing-faq, .landing-journey')).toBeNull();
});

test('all landing navigation resolves to onboarding or an existing section', () => {
  [...container.querySelectorAll('a')].forEach(link => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) expect(container.querySelector(href)).not.toBeNull();
    else expect(href).toBe('/try-free');
  });
  expect(container.querySelector('.landing-hero .landing-text-link').getAttribute('href')).toBe('#conversation-demo');
  expect(container.querySelectorAll('.landing-arrow').length).toBeGreaterThan(0);
});

test('demo adds precisely one selected continuation without network or chat controls', async () => {
  const demo = container.querySelector('#conversation-demo .landing-demo');
  const buttons = [...demo.querySelectorAll('.landing-demo-options button')];
  expect(buttons).toHaveLength(3);
  expect(demo.querySelectorAll('.landing-message')).toHaveLength(2);
  await act(async () => buttons[1].click());
  expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  expect(demo.querySelectorAll('.landing-message')).toHaveLength(4);
  expect(demo.textContent).toContain('Мне сложно доверять');
  await act(async () => buttons[2].click());
  expect(demo.querySelectorAll('.landing-message')).toHaveLength(4);
  expect(demo.textContent).toContain('Я отдаляюсь, когда становится серьёзно');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.querySelector('form,textarea')).toBeNull();
});

test('use-case questions carry the exact validated landing intent into onboarding', () => {
  const links = [...container.querySelectorAll('.landing-case-question')];
  expect(links).toHaveLength(3);
  links.forEach((link, index) => {
    expect(link.getAttribute('href')).toBe('/try-free');
    expect(link.textContent).toContain(LANDING_USE_CASES[index].question);
    expect(JSON.parse(link.dataset.state)).toEqual({ landingIntent: {
      topic: LANDING_USE_CASES[index].topic,
      question: LANDING_USE_CASES[index].question,
      source: 'landing_use_case',
    } });
  });
});

test('static chart preview stays independent from the frozen renderer runtime', () => {
  expect(container.querySelector('#chart-showcase .chart-v2.is-preview svg')).not.toBeNull();
  expect(container.querySelector('#chart-showcase .chart-toolbar')).toBeNull();
  expect(global.ResizeObserver).not.toHaveBeenCalled();
});
