// Test support for FE-PAY-CHOICE (decision 50): fixtures and finders for the one-product payment window.
// Not product code and not a test file. The window is found by what the buyer sees: the card title outside the dialog,
// the payment method name inside it — never by the labels of the buttons.
import { PRICES } from '../config/plans';

export const FLAGS = { stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
export const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false, ...FLAGS };
export const PREMIUM = { ...FREE, plan: 'premium', saved_charts_limit: 10, gpt_messages_limit: 300, gpt_messages_used: 10,
  gpt_messages_available: 290, gpt_limit_type: 'billing_period', plan_interval: 'month',
  current_period_start: '2026-11-12T00:00:00', current_period_end: '2026-12-12T00:00:00',
  gpt_messages_reset_at: '2026-12-12T00:00:00', payment_provider: 'stripe', subscription_status: 'active',
  stripe_checkout_available: false, lava_checkout_available: false };
export const BETA = { free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
  gpt_messages_available: null, gpt_limit_type: 'unlimited' };
export const OFFERS = { premium_year: true, question_pack: true, pack_size: 50 };

export const TITLES = { premium_month: 'Premium на месяц', premium_year: 'Premium на год', question_pack: '+50 вопросов' };
export const STRIPE_METHOD = 'Карта любой страны';
export const LAVA_METHOD = 'Карта российского банка';
export const STRIPE_LINE = 'Visa, Mastercard и другие карты. Оплата в долларах в окне Stripe.';
export const LAVA_LINE = 'Оплата картой в рублях на странице Lava.top — откроется в новой вкладке.';
const PREFIX = 'Во время бета-теста карты и AI-вопросы доступны бесплатно без лимита.';
export const NOTES = {
  premium_month: `${PREFIX} Покупка Premium необязательна и оформляет платную подписку с ежемесячным продлением.`,
  premium_year: `${PREFIX} Покупка Premium на год необязательна и оформляет платную подписку с ежегодным продлением.`,
  question_pack: `${PREFIX} Покупка пакета необязательна: его вопросы не тратятся до конца бета-теста и не сгорают.`,
};

export const flat = value => (typeof value === 'string' ? value : value.textContent).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
export const count = (text, part) => text.split(part).length - 1;
export const usd = product => flat(PRICES[product].usd);
export const rub = product => flat(PRICES[product].rub);

// The button of a card of the pricing page (outside any dialog), found by the card title.
export const cardButton = (container, title) => {
  const card = [...container.querySelectorAll('.pricing-grid > .pricing-card')].find(item => flat(item.querySelector('h3')) === title);
  if (!card) throw new Error(`The page has no card "${title}"`);
  return card.querySelector('button');
};
export const openDialog = container => container.querySelector('dialog[open]');

// The block of one payment method inside the window: the deepest container that holds the method name and a button.
export const methodBlock = (dialog, name) => {
  const holders = [...dialog.querySelectorAll('section,article,li,div,fieldset')]
    .filter(item => flat(item).includes(name) && item.querySelector('button'));
  return holders.find(item => !holders.some(other => other !== item && item.contains(other)));
};
export const methodButton = (dialog, name) => {
  const block = methodBlock(dialog, name);
  if (!block) throw new Error(`The window offers no payment method "${name}"`);
  const buttons = block.querySelectorAll('button');
  if (buttons.length !== 1) throw new Error(`The method "${name}" must have exactly one button, found ${buttons.length}`);
  return buttons[0];
};
// The element that carries a price inside a method block (not the button, not a wrapper of other elements with the price).
export const priceElement = (block, price) => {
  const found = [...block.querySelectorAll('*')].filter(item => !item.closest('button') && flat(item).includes(price));
  return found.find(item => !found.some(other => other !== item && item.contains(other)));
};
export const buttonTexts = dialog => [...dialog.querySelectorAll('button')].map(item => flat(item));
