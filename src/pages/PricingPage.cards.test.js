// FE-PRICING-CARDS (decision 50): four cards in one grid, dollars and roubles of one kind, buttons and conditions as before.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';

let mockUser, mockUsage, mockOffers, mockBeta;
const mockNavigate = jest.fn();
const mockOpenUpgrade = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../context/UsageContext', () => ({ useUsage: () => ({ usage: mockUsage, openUpgrade: mockOpenUpgrade }) }));
jest.mock('../context/ServiceConfigContext', () => ({ useServiceConfig: () => ({ freeBetaEnabled: mockBeta !== false, offers: mockOffers }) }));
jest.mock('../context/BillingContext', () => ({ useBilling: () => ({}) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a> }), { virtual: true });

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockUser = null; mockUsage = null; mockBeta = true; mockOffers = { premium_year: true, question_pack: true };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });
const render = () => act(async () => root.render(<PricingPage />));
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent === text);
const cards = () => [...container.querySelectorAll('.pricing-grid > .pricing-card')];

test('all four cards stand in one grid in the agreed order', async () => {
  await render();
  expect(cards().map(c => c.querySelector('h3').textContent)).toEqual(['Бесплатно', 'Premium на месяц', 'Premium на год', '+50 вопросов']);
  expect(cards()[2].classList.contains('popular')).toBe(true);
  expect(cards()[2].querySelector('.plan-tag').textContent).toBe('Выгоднее всего');
});

test('dollars and roubles are rows of the same kind in every card: same elements, same classes', async () => {
  await render();
  for (const card of cards()) {
    const rows = [...card.querySelectorAll('.plan-prices > .plan-price')];
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toBe(rows[1].className);
    expect(rows.map(r => r.querySelector('.plan-price-value').className)).toEqual(['plan-price-value', 'plan-price-value']);
    expect(rows[0].querySelector('.plan-price-unit')?.className).toBe(rows[1].querySelector('.plan-price-unit')?.className);
  }
  const year = cards()[2].textContent;
  expect(year).toContain('$69.99');
  expect(year).toContain('4 790 ₽');
  expect(year).toContain('$5.83 в месяц, выгоднее на 42%');
  expect(year).toContain('399 ₽ в месяц, выгоднее на 50%');
});

test('the buttons do what they did before', async () => {
  await render();
  await act(async () => button('Начать бесплатно').click());
  expect(mockNavigate).toHaveBeenLastCalledWith('/try-free');
  await act(async () => button('Перейти на Premium').click());
  expect(mockNavigate).toHaveBeenLastCalledWith('/authorization', { state: { returnTo: '/pricing' } });
  mockUser = { id: 1 };
  mockUsage = { plan: 'free', free_beta_enabled: true, stripe_checkout_available: true, stripe_annual_checkout_available: true, stripe_pack_checkout_available: true };
  await render();
  await act(async () => button('Выбрать Premium на год').click());
  expect(mockOpenUpgrade).toHaveBeenLastCalledWith('premium_year');
  await act(async () => button('Купить пакет').click());
  expect(mockOpenUpgrade).toHaveBeenLastCalledWith('question_pack');
});

test('the long conditions sit under the cards in «Подробнее об условиях», words unchanged', async () => {
  await render();
  const details = container.querySelector('details.pricing-terms');
  expect(details.querySelector('summary').textContent).toBe('Подробнее об условиях');
  expect(details.open).toBe(false);
  for (const part of ['Отмена продления в «Мои карты» → «Управление подпиской». Доступ сохраняется до конца оплаченного периода. Отмена не возвращает оплату автоматически.',
    'Неиспользованные вопросы Premium не переносятся на следующий период.', 'Без пробного периода.']) expect(details.textContent).toContain(part);
  expect(container.querySelector('.pricing-grid').textContent).not.toContain('Отмена продления');
  expect(container.querySelector('nav.policy-links')).not.toBeNull();
});

test('without the year and the pack the page shows two cards', async () => {
  mockOffers = {};
  await render();
  expect(cards().map(c => c.querySelector('h3').textContent)).toEqual(['Бесплатно', 'Premium']);
  expect(cards()[1].classList.contains('popular')).toBe(true);
});

// FE-PRICING-TIDY: the review leftovers of the cards.
const RENEWAL_LINE = 'Продление каждый месяц, отмена в любой момент';
const items = list => [...list.querySelectorAll('li')].map(li => li.textContent);

test('in the beta the list under «Обычные лимиты Premium…» holds only limits; the renewal stands apart', async () => {
  await render();
  const month = cards()[1];
  const lead = month.querySelector('.plan-lead');
  expect(lead.textContent).toBe('Обычные лимиты Premium вне бета-теста:');
  const limits = lead.nextElementSibling;
  expect(limits.tagName).toBe('UL');
  expect(items(limits)).toEqual(['10 сохранённых карт', '300 AI-вопросов за расчётный месяц']);
  expect(limits.textContent).not.toContain('Продление');
  const renewal = limits.nextElementSibling;
  expect(items(renewal)).toEqual([RENEWAL_LINE]);
});

test('outside the beta the renewal stays in the one list of the month card, no lead line', async () => {
  mockBeta = false;
  await render();
  const month = cards()[1];
  expect(month.querySelector('.plan-lead')).toBeNull();
  expect(month.querySelectorAll('ul.plan-list')).toHaveLength(1);
  expect(items(month.querySelector('ul.plan-list')).at(-1)).toBe(RENEWAL_LINE);
});

test('the Stripe lines of the conditions stand in a group titled «Premium на месяц», words unchanged', async () => {
  await render();
  const group = container.querySelector('details.pricing-terms .pricing-terms-group');
  expect(group.getAttribute('aria-labelledby')).toBe(group.querySelector('h3').id);
  expect(group.querySelector('h3').textContent).toBe('Premium на месяц');
  expect(group.querySelector('p').textContent).toBe('Stripe · автоматическое продление каждый месяц до отмены. Итоговая сумма и применимые налоги — перед подтверждением оплаты. Без пробного периода.');
});

test('every list of a card is announced as a list', async () => {
  await render();
  const lists = container.querySelectorAll('.pricing-grid ul.plan-list');
  expect(lists.length).toBeGreaterThan(0);
  for (const list of lists) expect(list.getAttribute('role')).toBe('list');
});
