// PRICING-1, decision 29: the owner-approved legal sentences are rendered exactly as approved (tasks/PRICING-1/LEGAL-TEXTS.md, items 1-5).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TermsPage, PrivacyPage, RefundPage } from './LegalPages';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const textOf = async page => { await act(async () => root.render(page)); return container.textContent; };

test('terms: annual paragraph, price paragraph and question pack paragraph', async () => {
  const text = await textOf(<TermsPage />);
  for (const sentence of [
    'Годовой Premium включает те же до 10 сохранённых натальных карт и 300 успешных AI-запросов в каждом месяце оплаченного года. Неиспользованные вопросы месяца не переносятся на следующий.',
    'Premium — подписка с автоматическим продлением, без пробного периода: помесячно или на год. Через Stripe — $9.99 USD в месяц или $69.99 USD в год; итоговая сумма и применимые налоги показываются перед подтверждением оплаты. Через Lava.top — 799 ₽ в месяц или 4 790 ₽ в год. Годовую подписку можно оформить, когда нет действующего Premium. Подробнее — на странице тарифов.',
    'Пакет вопросов — разовая покупка без подписки и без автоматического продления: +50 успешных AI-запросов за $4.99 USD через Stripe или 399 ₽ через Lava.top. Вопросы пакета не сгорают, не добавляют сохранённых карт и тратятся, когда закончились бесплатные вопросы или вопросы Premium за текущий месяц. Во время бесплатного бета-теста пакеты не продаются и не расходуются.',
  ]) expect(text).toContain(sentence);
  expect(text).not.toContain('Premium — ежемесячная подписка');
});

test('refunds: the question pack sentence', async () => {
  expect(await textOf(<RefundPage />)).toContain('При возврате оплаты за пакет вопросов или споре по ней неиспользованные вопросы этого пакета снимаются; уже заданные вопросы не возвращаются.');
});

test('privacy: the offer view and pack purchases are named in the analytics paragraph', async () => {
  expect(await textOf(<PrivacyPage />)).toContain('выборе оплаты, показ предложения тарифа, технические результаты этих действий и подтверждённые сервером события подписки и покупки пакетов вопросов.');
});
