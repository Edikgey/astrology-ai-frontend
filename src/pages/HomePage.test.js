import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './HomePage';
import { PLANS } from '../config/plans';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('../api/paddle', () => ({ paddleConfigured: false }));

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

test('one H1 and meaningful H2/H3 hierarchy across distinct named sections', () => {
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('h1').textContent).toBe('Lunaria — ваш персональный AI-астролог');
  const sections = [...container.querySelectorAll('.landing-v2 > section')];
  expect(sections).toHaveLength(10);
  sections.forEach(section => {
    const heading = section.querySelector('h1, h2');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });
  expect(container.querySelectorAll('h2')).toHaveLength(9);
  expect(container.querySelectorAll('h3')).toHaveLength(8);
  expect(container.querySelectorAll('h4,h5,h6')).toHaveLength(0);
});

test('creation/pricing routes and in-page actions resolve without placeholder links', () => {
  [...container.querySelectorAll('a')].forEach(link => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) expect(container.querySelector(href)).not.toBeNull();
    else expect(['/try-free', '/pricing']).toContain(href);
  });
  expect(container.querySelector('.landing-hero .button').getAttribute('href')).toBe('/try-free');
  expect(container.querySelector('.landing-final .button').getAttribute('href')).toBe('/try-free');
  expect(container.querySelector('.landing-plan-premium .button').getAttribute('href')).toBe('/pricing');
});

test('demo chips switch static first-person questions without network, auth or quota actions', async () => {
  const demo = container.querySelector('#conversation-demo .landing-demo');
  const buttons = [...demo.querySelectorAll('button')];
  expect(buttons).toHaveLength(3);
  const initial = demo.querySelector('.landing-demo-thread').textContent;
  for (const button of buttons) {
    await act(async () => button.click());
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(demo.querySelector('.landing-bubble-user').textContent).toBe(button.textContent.replace('↳ ', ''));
    expect(demo.querySelector('.landing-demo-thread').textContent).not.toBe(initial);
  }
  expect(demo.textContent).toContain('Демонстрация · без запросов к AI');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.querySelector('form,textarea')).toBeNull();
});

test('static chart preview needs no observer and pricing retains shared limits and price component', () => {
  expect(container.querySelector('#chart-showcase .chart-v2.is-preview svg')).not.toBeNull();
  expect(container.querySelector('#chart-showcase .chart-toolbar')).toBeNull();
  expect(global.ResizeObserver).not.toHaveBeenCalled();
  const plans = container.querySelector('.landing-plan-grid').textContent;
  expect(plans).toContain(`До ${PLANS.free.chartLimit} сохранённых карт`);
  expect(plans).toContain(`${PLANS.free.gptLimit} AI-вопросов за всё время аккаунта`);
  expect(plans).toContain(`До ${PLANS.premium.chartLimit} сохранённых карт`);
  expect(plans).toContain(`${PLANS.premium.gptLimit} AI-вопросов за расчётный период`);
  expect(plans).toContain('$9.99 USD / месяц');
});

test('FAQ covers product decisions without the former technical birth-time topics', () => {
  const faq = container.querySelector('.landing-faq');
  expect(faq.querySelectorAll('details > summary')).toHaveLength(5);
  expect(faq.textContent).toContain('Сохраняет ли Lunaria мои карты и разговоры?');
  expect(faq.textContent).not.toMatch(/точное время|точного времени|часов[оы]й пояс|Europe\/|DST|минут|куспид/i);
});
