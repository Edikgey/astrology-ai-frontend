// PRICING-1 regression FE-2 and FE-3 (DESIGN §4, §9): the offer appears at the right moment,
// only outside the beta, and only from what /account/usage says. The server decides; the UI reflects.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider, useUsage } from '../context/UsageContext';
import AskGptForm from './AskGptForm';

let mockAuth, limit;
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });

const FLAGS = { stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 3, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, current_period_start: null, current_period_end: null,
  stripe_checkout_available: true, lava_checkout_available: true, plan_interval: null,
  gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false, ...FLAGS };
const PREMIUM = { ...FREE, plan: 'premium', saved_charts_limit: 10, gpt_messages_limit: 300, gpt_messages_used: 300,
  gpt_messages_available: 0, gpt_limit_type: 'billing_period', plan_interval: 'month',
  current_period_start: '2026-11-12T00:00:00', current_period_end: '2026-12-12T00:00:00',
  gpt_messages_reset_at: '2026-12-12T00:00:00', payment_provider: 'stripe', subscription_status: 'active',
  stripe_checkout_available: false, lava_checkout_available: false };
const BETA = { ...FREE, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
  gpt_messages_available: null, gpt_limit_type: 'unlimited' };
const TITLES = ['Premium на месяц', 'Premium на год', '+50 вопросов'];
const ok = data => ({ ok: true, status: 200, json: async () => data });
const fail = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) });
let root, container, originalFetch, serverUsage;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem('access_token', 'jwt');
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  serverUsage = { ...FREE };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return ok(serverUsage);
    if (url.includes('/gpt-messages')) return ok([{ role: 'gpt', content: 'Saved answer' }]);
    throw new Error(`Unexpected test request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockNavigate.mockReset();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch; jest.restoreAllMocks();
});
const Probe = () => { limit = useUsage().handleLimitError; return null; };
const render = async (page = null) => act(async () => root.render(<UsageProvider><Probe />{page}</UsageProvider>));
const flat = el => el.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const button = text => [...container.querySelectorAll('button')].find(el => el.textContent === text);
const click = async el => act(async () => el.click());
const modal = () => container.querySelector('dialog[open]');
// An option is one container that holds the option title and its own payment buttons.
const optionButton = (scope, title, provider) => {
  const candidates = [...scope.querySelectorAll('section,article,li,div,fieldset')]
    .filter(el => el.textContent.replace(/[  ]/g, ' ').includes(title) && el.querySelector('button'));
  const deepest = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
  for (const el of deepest) {
    const found = [...el.querySelectorAll('button')].find(b => provider.test(b.textContent));
    if (found) return found;
  }
  return undefined;
};
const STRIPE = /Stripe/i;
const offered = scope => TITLES.filter(title => optionButton(scope, title, STRIPE) || optionButton(scope, title, /RUB|₽|рубл|Lava/i));
const limitError = (code, plan, used, cap) => ({ code: code.toLowerCase(), detail: { code, plan, used, limit: cap } });
const ask = async (answerUsage, answer = { response: 'New answer' }) => {
  serverUsage = answerUsage;
  global.fetch.mockResolvedValueOnce(ok(answer));
  await click(button('Спросить'));
};

describe('FE-2: the limit window by moment (outside the beta)', () => {
  test('free account, GPT_LIMIT_REACHED: window «Бесплатные вопросы закончились» with the three options, draft and history kept', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 9, gpt_messages_available: 1 };
    await render(<AskGptForm chartId={7} initialQuestion="Pending question" />);
    serverUsage = { ...FREE, gpt_messages_used: 10, gpt_messages_available: 0 };
    global.fetch.mockResolvedValueOnce(fail(409, { code: 'GPT_LIMIT_REACHED', plan: 'free', used: 10, limit: 10 }));
    await click(button('Спросить'));
    const dialog = modal();
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('h2').textContent).toBe('Бесплатные вопросы закончились');
    expect(flat(dialog)).toContain('Вы задали все 10 бесплатных вопросов. Чтобы продолжить разговор, выберите Premium или пакет вопросов. История сохранится.');
    expect(offered(dialog)).toEqual(TITLES);
    expect(container.querySelector('textarea').value).toBe('Pending question');
    expect(container.textContent).toContain('Saved answer');
    expect(global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'))).toHaveLength(1);
  });

  test('Premium account, GPT_LIMIT_REACHED: the monthly reset date and a pack, no Premium plans', async () => {
    serverUsage = { ...PREMIUM };
    await render();
    await act(async () => limit(limitError('GPT_LIMIT_REACHED', 'premium', 300, 300)));
    const dialog = modal();
    expect(flat(dialog)).toContain('Вопросы Premium на этот месяц закончились. Новые 300 — 12.12.2026 (UTC). Чтобы не ждать, купите пакет +50 вопросов.');
    expect(optionButton(dialog, '+50 вопросов', STRIPE)).toBeDefined();
    expect(optionButton(dialog, 'Premium на год', STRIPE)).toBeUndefined();
    expect(optionButton(dialog, 'Premium на месяц', STRIPE)).toBeUndefined();
    expect(flat(dialog)).not.toContain('Free');
    expect(button('Перейти на Premium')).toBeUndefined();
  });

  test('free account, CHART_LIMIT_REACHED: charts text, Premium plans, never a question pack', async () => {
    await render();
    await act(async () => limit(limitError('CHART_LIMIT_REACHED', 'free', 3, 3)));
    const dialog = modal();
    expect(flat(dialog)).toContain('Бесплатно можно сохранить 3 карты. Удалите ненужную в «Мои карты» или перейдите на Premium — до 10 карт.');
    expect(optionButton(dialog, 'Premium на год', STRIPE)).toBeDefined();
    expect(optionButton(dialog, 'Premium на месяц', STRIPE)).toBeDefined();
    expect(flat(dialog)).not.toContain('+50 вопросов');
    expect(flat(dialog)).not.toMatch(/пакет/i);
  });

  test('Premium account, CHART_LIMIT_REACHED: unchanged, no plans and no pack', async () => {
    serverUsage = { ...PREMIUM, saved_charts_used: 10 };
    await render();
    await act(async () => limit(limitError('CHART_LIMIT_REACHED', 'premium', 10, 10)));
    expect(modal().querySelector('h2').textContent).toBe('Достигнут лимит сохранённых карт');
    expect(offered(modal())).toEqual([]);
  });

  test.each(['GPT_LIMIT_REACHED', 'CHART_LIMIT_REACHED'])('beta on: %s window is the old one and offers nothing new', async code => {
    serverUsage = { ...BETA };
    await render();
    await act(async () => limit(limitError(code, 'free', 3, 3)));
    const dialog = modal();
    expect(dialog.querySelector('h2').textContent).not.toBe('Бесплатные вопросы закончились');
    expect(flat(dialog)).not.toContain('Premium на год');
    expect(flat(dialog)).not.toContain('+50 вопросов');
    expect(flat(dialog)).not.toMatch(/пакет/i);
  });
});

describe('FE-3: the chat — last free question, empty balance, balance with a pack', () => {
  test('one free question left, no pack: a line under the chat with a way to the options', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 8, gpt_messages_available: 2 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    expect(container.textContent).not.toContain('Остался 1 бесплатный вопрос');
    await ask({ ...FREE, gpt_messages_used: 9, gpt_messages_available: 1 });
    const chat = container.querySelector('.askgpt-container');
    expect(flat(chat)).toContain('Остался 1 бесплатный вопрос. Потом — Premium или пакет вопросов.');
    expect(modal()).toBeNull();
    const link = [...chat.querySelectorAll('button,a')].find(el => el.textContent === 'Посмотреть варианты');
    expect(link).toBeDefined();
    await click(link);
    // DESIGN §12: the same options window as the limit, no navigation away from the chat.
    expect(modal()).not.toBeNull();
    expect(offered(modal())).toEqual(TITLES);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('free questions used up, no pack: a card in the chat with the options, no window over the page', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 9, gpt_messages_available: 1 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    await ask({ ...FREE, gpt_messages_used: 10, gpt_messages_available: 0 });
    const chat = container.querySelector('.askgpt-container');
    expect(flat(chat)).toContain('Бесплатные вопросы закончились');
    expect(modal()).toBeNull();
    expect(offered(chat)).toEqual(TITLES);
    expect(flat(chat)).not.toContain('Остался 1 бесплатный вопрос');
  });

  test('with a pack the balance is «X + Y из пакета» and neither the line nor the card appears', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 9, gpt_messages_available: 1, pack_questions_remaining: 12 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    expect(container.querySelector('.chat-allowance').textContent).toBe('Бесплатно · Доступно вопросов: 1 + 12 из пакета');
    expect(container.textContent).not.toContain('Остался 1 бесплатный вопрос');
    await ask({ ...FREE, gpt_messages_used: 10, gpt_messages_available: 0, pack_questions_remaining: 12 });
    expect(container.querySelector('.chat-allowance').textContent).toBe('Бесплатно · Доступно вопросов: 0 + 12 из пакета');
    expect(container.textContent).not.toContain('Бесплатные вопросы закончились');
    expect(optionButton(container.querySelector('.askgpt-container'), 'Premium на год', STRIPE)).toBeUndefined();
  });

  test('a Premium balance with a pack is shown the same way', async () => {
    serverUsage = { ...PREMIUM, gpt_messages_used: 13, gpt_messages_available: 287, pack_questions_remaining: 12 };
    await render(<AskGptForm chartId={7} />);
    expect(container.querySelector('.chat-allowance').textContent).toBe('Premium · Доступно вопросов: 287 + 12 из пакета');
  });

  test('guard: an empty or missing pack keeps the balance exactly as before', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 4, gpt_messages_available: 6 };
    await render(<AskGptForm chartId={7} />);
    expect(container.querySelector('.chat-allowance').textContent).toBe('Бесплатно · Доступно вопросов: 6');
    const old = { ...serverUsage }; delete old.pack_questions_remaining; delete old.pack_pending;
    serverUsage = old;
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(container.querySelector('.chat-allowance').textContent).toBe('Бесплатно · Доступно вопросов: 6');
  });

  test('guard: Premium with one question left sees no free-question line or card', async () => {
    serverUsage = { ...PREMIUM, gpt_messages_used: 299, gpt_messages_available: 1 };
    await render(<AskGptForm chartId={7} />);
    expect(container.textContent).not.toContain('Остался 1 бесплатный вопрос');
    expect(container.textContent).not.toContain('Бесплатные вопросы закончились');
  });

  test('beta on: nothing new in the chat — no line, no card, no pack balance — even with one question or a leftover pack', async () => {
    serverUsage = { ...BETA, gpt_messages_available: 1, pack_questions_remaining: 12 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    expect(container.querySelector('.chat-allowance').textContent).toBe('Бесплатный бета-тест · AI-вопросы без лимита');
    await ask({ ...BETA, gpt_messages_available: 0, pack_questions_remaining: 12 });
    expect(container.textContent).not.toContain('Остался 1 бесплатный вопрос');
    expect(container.textContent).not.toContain('Бесплатные вопросы закончились');
    expect(container.textContent).not.toContain('из пакета');
    expect(button('Посмотреть варианты')).toBeUndefined();
  });
});
