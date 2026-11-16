// FE-PAY-CHOICE regression (decision 50, DESIGN §5, tests 1-6 and 8): the button of a pricing card opens the window of
// that one product with two payment methods. Real providers and page, mocked network and Stripe.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';
import { UsageProvider } from '../context/UsageContext';
import { ServiceConfigProvider } from '../context/ServiceConfigContext';
import { loadStripe } from '@stripe/stripe-js';
import { FREE, PREMIUM, BETA, OFFERS, TITLES, STRIPE_METHOD, LAVA_METHOD, STRIPE_LINE, LAVA_LINE, NOTES,
  flat, count, usd, rub, cardButton, openDialog, methodBlock, methodButton, priceElement, buttonTexts } from './payChoiceTestKit';

let mockAuth;
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }) => children,
  EmbeddedCheckout: () => <div data-testid="stripe-fields">Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const SESSION = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const INVOICE = { url: 'https://pay.example.test/invoice' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, publicConfig, serverUsage, tab, checkoutReply, usageReply;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false }; localStorage.setItem('access_token', 'jwt');
  publicConfig = { free_beta_enabled: false, offers: OFFERS };
  serverUsage = { ...FREE }; checkoutReply = null; usageReply = null;
  tab = { opener: {}, close: jest.fn(), location: {} };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.includes('/public-config')) return ok(publicConfig);
    if (url.endsWith('/account/usage')) return usageReply ? usageReply() : ok(serverUsage);
    if (url.endsWith('/payments/stripe/checkout')) return checkoutReply ? checkoutReply() : ok(SESSION);
    if (url.endsWith('/payments/lava/checkout')) return checkoutReply ? checkoutReply() : ok(INVOICE);
    throw new Error(`Unexpected test request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks(); mockNavigate.mockReset();
});
const render = async () => act(async () => root.render(
  <ServiceConfigProvider><UsageProvider><PricingPage /></UsageProvider></ServiceConfigProvider>));
const click = async el => act(async () => el.click());
const posts = path => global.fetch.mock.calls.filter(([url, options]) => url.endsWith(path) && options?.method === 'POST');
const stripePosts = () => posts('/payments/stripe/checkout');
const lavaPosts = () => posts('/payments/lava/checkout');
const openProduct = async product => { await render(); await click(cardButton(container, TITLES[product])); return openDialog(container); };
const PRODUCTS = Object.keys(TITLES);
const others = product => PRODUCTS.filter(item => item !== product).map(item => TITLES[item]);

describe('1. the button of a card opens the window of that one product', () => {
  test.each(PRODUCTS)('%s: its own title, no other product, two methods with the price of this product in each', async product => {
    const dialog = await openProduct(product);
    expect(dialog).not.toBeNull();
    expect([...dialog.querySelectorAll('h2,h3')].map(item => flat(item))).toContain(TITLES[product]);
    for (const title of others(product)) expect(flat(dialog)).not.toContain(title);
    const stripe = methodBlock(dialog, STRIPE_METHOD), lava = methodBlock(dialog, LAVA_METHOD);
    expect(stripe).toBeDefined(); expect(lava).toBeDefined();
    expect(stripe).not.toBe(lava);
    expect(flat(stripe)).toContain(usd(product)); expect(flat(stripe)).not.toContain(rub(product));
    expect(flat(lava)).toContain(rub(product)); expect(flat(lava)).not.toContain(usd(product));
    expect(flat(stripe)).toContain(STRIPE_LINE); expect(flat(lava)).toContain(LAVA_LINE);
    expect(flat(methodButton(dialog, STRIPE_METHOD))).toBe(`Оплатить ${usd(product)}`);
    expect(flat(methodButton(dialog, LAVA_METHOD))).toBe(`Оплатить ${rub(product)}`);
    // Equal weight: the two prices are elements of one kind and one class (decision 50).
    const stripePrice = priceElement(stripe, usd(product)), lavaPrice = priceElement(lava, rub(product));
    expect(stripePrice.tagName).toBe(lavaPrice.tagName);
    expect(stripePrice.className).toBe(lavaPrice.className);
    expect(methodButton(dialog, STRIPE_METHOD).className).toBe(methodButton(dialog, LAVA_METHOD).className);
    expect(stripePosts()).toHaveLength(0); expect(lavaPosts()).toHaveLength(0);
  });
});

describe('2. one click, one payment start', () => {
  test('the year: two clicks on Stripe and one on Lava while Stripe has not answered make one request', async () => {
    const dialog = await openProduct('premium_year');
    let finish; checkoutReply = () => new Promise(resolve => { finish = resolve; });
    await click(methodButton(dialog, STRIPE_METHOD)); await click(methodButton(dialog, STRIPE_METHOD));
    await click(methodButton(dialog, LAVA_METHOD));
    expect(stripePosts()).toHaveLength(1);
    expect(stripePosts()[0][1].body).toBe(JSON.stringify({ product: 'premium_year' }));
    expect(lavaPosts()).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    expect(methodButton(dialog, STRIPE_METHOD).disabled).toBe(true);
    expect(methodButton(dialog, LAVA_METHOD).disabled).toBe(true);
    await act(async () => finish(ok(SESSION)));
    expect(stripePosts()).toHaveLength(1);
  });

  test('the pack through Lava: one request with the product only, one tab opened without an opener', async () => {
    const dialog = await openProduct('question_pack');
    await click(methodButton(dialog, LAVA_METHOD));
    expect(lavaPosts()).toHaveLength(1);
    expect(lavaPosts()[0][1].body).toBe(JSON.stringify({ product: 'question_pack' }));
    expect(stripePosts()).toHaveLength(0);
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(INVOICE.url);
  });

  test('the month through Stripe: one request, the old bodiless one', async () => {
    const dialog = await openProduct('premium_month');
    await click(methodButton(dialog, STRIPE_METHOD));
    expect(stripePosts()).toHaveLength(1);
    expect(stripePosts()[0][1].body).toBeUndefined();
    expect(lavaPosts()).toHaveLength(0);
  });
});

describe('3. a method the server does not sell is not shown', () => {
  test('the year with only the Stripe flag shows only «Карта любой страны»', async () => {
    serverUsage = { ...FREE, lava_annual_checkout_available: false };
    const dialog = await openProduct('premium_year');
    expect(methodBlock(dialog, STRIPE_METHOD)).toBeDefined();
    expect(flat(dialog)).not.toContain(LAVA_METHOD);
    expect(buttonTexts(dialog).filter(text => text.startsWith('Оплатить'))).toEqual([`Оплатить ${usd('premium_year')}`]);
  });

  test('the pack with only the Lava flag shows only «Карта российского банка»', async () => {
    serverUsage = { ...FREE, stripe_pack_checkout_available: false };
    const dialog = await openProduct('question_pack');
    expect(methodBlock(dialog, LAVA_METHOD)).toBeDefined();
    expect(flat(dialog)).not.toContain(STRIPE_METHOD);
    expect(buttonTexts(dialog).filter(text => text.startsWith('Оплатить'))).toEqual([`Оплатить ${rub('question_pack')}`]);
  });
});

describe('4. no method at all', () => {
  test('a month nobody sells: its own window says so and gives no payment button, no other product, no old month window', async () => {
    serverUsage = { ...FREE, stripe_checkout_available: false, lava_checkout_available: false };
    const dialog = await openProduct('premium_month');
    expect(dialog).not.toBeNull();
    expect([...dialog.querySelectorAll('h2,h3')].map(item => flat(item))).toContain(TITLES.premium_month);
    expect(flat(dialog)).toContain('Сейчас этот тариф нельзя оплатить. Обновите страницу; если не поможет, напишите в поддержку: lunariaai.support@gmail.com.');
    expect(buttonTexts(dialog).filter(text => /Оплат|Stripe|RUB/.test(text))).toEqual([]);
    expect(flat(dialog)).not.toContain(STRIPE_METHOD); expect(flat(dialog)).not.toContain(LAVA_METHOD);
    for (const title of others('premium_month')) expect(flat(dialog)).not.toContain(title);
    expect(stripePosts()).toHaveLength(0); expect(lavaPosts()).toHaveLength(0);
  });
});

describe('5. a Premium account', () => {
  test('only the pack has a button; its window is the pack window with the pack line and one Stripe call', async () => {
    serverUsage = { ...PREMIUM };
    await render();
    expect(cardButton(container, TITLES.premium_month)).toBeNull();
    expect(cardButton(container, TITLES.premium_year)).toBeNull();
    await click(cardButton(container, TITLES.question_pack));
    const dialog = openDialog(container);
    expect([...dialog.querySelectorAll('h2,h3')].map(item => flat(item))).toContain(TITLES.question_pack);
    expect(flat(dialog)).toContain('Пакет добавляет вопросы к вашему лимиту и не меняет подписку.');
    for (const title of others('question_pack')) expect(flat(dialog)).not.toContain(title);
    await click(methodButton(dialog, STRIPE_METHOD));
    expect(stripePosts()).toHaveLength(1);
    expect(stripePosts()[0][1].body).toBe(JSON.stringify({ product: 'question_pack' }));
  });

  test('the plan becomes Premium while a month window is open: it shows the plan and no payment buttons', async () => {
    const dialog = await openProduct('premium_month');
    expect(methodButton(dialog, STRIPE_METHOD)).toBeDefined();
    serverUsage = { ...PREMIUM };
    await act(async () => window.dispatchEvent(new Event('focus')));
    const after = openDialog(container);
    expect(flat(after)).toContain('Ваш текущий план — Premium.');
    expect(buttonTexts(after).filter(text => /Оплат|Stripe|RUB/.test(text))).toEqual([]);
    expect(flat(after)).not.toContain(STRIPE_METHOD); expect(flat(after)).not.toContain(LAVA_METHOD);
    expect(stripePosts()).toHaveLength(0); expect(lavaPosts()).toHaveLength(0);
  });
});

describe('6. beta: the note of this product once, no note of another', () => {
  beforeEach(() => { publicConfig = { free_beta_enabled: true, offers: OFFERS }; serverUsage = { ...FREE, ...BETA }; });
  test.each(PRODUCTS)('%s window', async product => {
    const dialog = await openProduct(product);
    const text = flat(dialog);
    expect(count(text, flat(NOTES[product]))).toBe(1);
    for (const other of PRODUCTS.filter(item => item !== product)) expect(count(text, flat(NOTES[other]))).toBe(0);
    expect(count(text, 'Во время бета-теста')).toBe(1);
  });
});

describe('8. guard (green on the base too): the guest and the account that is still loading', () => {
  test('a guest on any paid card goes to sign-in with a return to /pricing: no window, no payment request', async () => {
    mockAuth = { user: null, token: null, loading: false }; localStorage.clear();
    await render();
    for (const product of PRODUCTS) {
      mockNavigate.mockClear();
      await click(cardButton(container, TITLES[product]));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/authorization', { state: { returnTo: '/pricing' } });
    }
    expect(openDialog(container)).toBeNull();
    expect(stripePosts()).toHaveLength(0); expect(lavaPosts()).toHaveLength(0);
  });

  test('a signed-in account whose usage is not loaded yet: the paid card buttons are disabled and open no window', async () => {
    usageReply = () => new Promise(() => {});
    await render();
    for (const product of PRODUCTS) {
      const button = cardButton(container, TITLES[product]);
      expect(button.disabled).toBe(true);
      await click(button);
    }
    expect(openDialog(container)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(stripePosts()).toHaveLength(0); expect(lavaPosts()).toHaveLength(0);
  });
});

describe('9. FE-PAY-POLISH: the start of a payment fails in the window of a product', () => {
  const NETWORK = 'Нет связи с сервером. Не оплачивайте повторно — обновите страницу через минуту.';
  const NO_DETAIL = 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  const SESSION_OVER = 'Сессия истекла. Войдите снова.';
  const PENDING = 'Предыдущая оплата ещё проверяется. Подождите пару минут и обновите страницу.';
  const html502 = () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } });
  const pending409 = () => ({ ok: false, status: 409, json: async () => ({ detail: { code: 'CHECKOUT_PENDING', message: PENDING } }) });
  const posted = method => (method === STRIPE_METHOD ? stripePosts : lavaPosts);

  test.each([[STRIPE_METHOD], [LAVA_METHOD]])('%s: the connection breaks — a Russian alert, one request, the buttons work again', async method => {
    const dialog = await openProduct('premium_year');
    checkoutReply = () => { throw new TypeError('Failed to fetch'); };
    await click(methodButton(dialog, method));
    expect(flat(dialog.querySelector('[role="alert"]'))).toBe(NETWORK);
    expect(posted(method)()).toHaveLength(1);
    expect(methodButton(dialog, STRIPE_METHOD).disabled).toBe(false);
    expect(methodButton(dialog, LAVA_METHOD).disabled).toBe(false);
  });

  test.each([[STRIPE_METHOD], [LAVA_METHOD]])('%s: the server answers with HTML (502) — the text of an error without detail, one request', async method => {
    const dialog = await openProduct('premium_year');
    checkoutReply = html502;
    await click(methodButton(dialog, method));
    expect(flat(dialog.querySelector('[role="alert"]'))).toBe(NO_DETAIL);
    expect(posted(method)()).toHaveLength(1);
    expect(methodButton(dialog, STRIPE_METHOD).disabled).toBe(false);
    expect(methodButton(dialog, LAVA_METHOD).disabled).toBe(false);
  });

  test.each([[STRIPE_METHOD], [LAVA_METHOD]])('%s: 401 with HTML — the same text as 401 with JSON, about the session', async method => {
    const dialog = await openProduct('premium_year');
    checkoutReply = () => ({ ok: false, status: 401, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } });
    await click(methodButton(dialog, method));
    expect(flat(dialog.querySelector('[role="alert"]'))).toBe(SESSION_OVER);
    expect(posted(method)()).toHaveLength(1);
    checkoutReply = () => ({ ok: false, status: 401, json: async () => ({ detail: 'Not authenticated' }) });
    await click(methodButton(dialog, method));
    expect(flat(dialog.querySelector('[role="alert"]'))).toBe(SESSION_OVER);
    expect(posted(method)()).toHaveLength(2);
  });

  test.each([[STRIPE_METHOD], [LAVA_METHOD]])('%s: 409 CHECKOUT_PENDING in the year window — the server text, the buttons work again', async method => {
    const dialog = await openProduct('premium_year');
    checkoutReply = pending409;
    await click(methodButton(dialog, method));
    expect(flat(dialog.querySelector('[role="alert"]'))).toBe(PENDING);
    expect(posted(method)()).toHaveLength(1);
    expect(methodButton(dialog, STRIPE_METHOD).disabled).toBe(false);
    expect(methodButton(dialog, LAVA_METHOD).disabled).toBe(false);
  });

  test('the year window says what the buyer gets, without comparing with another plan', async () => {
    const dialog = await openProduct('premium_year');
    expect(flat(dialog)).toContain('300 AI-вопросов в месяц и до 10 сохранённых карт. Продление раз в год, отмена в любой момент.');
    expect(flat(dialog)).not.toContain('Те же');
  });
});
