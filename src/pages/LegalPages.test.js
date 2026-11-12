import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TermsPage, PrivacyPage, RefundPage, SupportPage } from './LegalPages';
import Footer from '../components/Footer';
import { PolicyLinks, SUPPLIER_NAME } from '../components/ServiceDisclosures';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async element => act(async () => root.render(element));

test('Terms identify the individual supplier, unregistered product and actual plan allowances', async () => {
  await render(<TermsPage />);
  const text = container.textContent;
  expect(container.querySelector('#supplier').textContent).toContain(SUPPLIER_NAME);
  for (const value of ['Онтарио, Канада', 'не отдельное юридическое лицо', 'не зарегистрированное фирменное наименование',
    '3 сохранённых', '10 успешных AI-запросов за всё время', '10 сохранённых', '300 успешных AI-запросов', '$9.99 USD', '799 ₽',
    'не является продавцом (merchant of record)', 'не означает одобрения']) expect(text).toContain(value);
});

test('cancellation explains period end, preserved charts, no fresh Free allowance and distinct refunds', async () => {
  await render(<TermsPage />);
  const text = container.querySelector('#cancellation').textContent;
  for (const value of ['Управление подпиской', 'Отключить продление Lava', 'конец оплаченного периода',
    'карты и история не удаляются', 'лимит вопросов не начинается заново', 'отдельные действия']) expect(text).toContain(value);
  expect(container.querySelector('a[href="/my-charts"]')).not.toBeNull();
});

test('refund policy preserves statutory remedies without promising automatic or pro-rata refunds', async () => {
  await render(<RefundPage />);
  for (const value of ['не предлагается безусловная гарантия', 'пропорционального возврата',
    'не зависит от нашего усмотрения', 'не отменяет подписку', 'lunariaai.support@gmail.com']) expect(container.textContent).toContain(value);
});

test('privacy describes actual processing and routes supplier identity without duplicating it', async () => {
  await render(<PrivacyPage />);
  for (const value of ['OpenAI', 'Brevo', 'OpenCage', 'Google Fonts', 'Stripe и Lava.top', 'за пределами Канады',
    'не отключает необходимое', 'фиксированный срок хранения', 'не заменяет']) expect(container.textContent).toContain(value);
  expect(container.textContent).not.toContain(SUPPLIER_NAME);
  expect(container.querySelector('a[href="/terms#supplier"]')).not.toBeNull();
});

test('support offers direct email, safe payment-information instructions and management links', async () => {
  await render(<SupportPage />);
  expect(container.querySelector('a[href="mailto:lunariaai.support@gmail.com"]')).not.toBeNull();
  expect(container.textContent).toContain('Не отправляйте пароль');
  expect(container.querySelector('a[href="/my-charts"]')).not.toBeNull();
  expect(container.querySelector('a[href="/terms#supplier"]')).not.toBeNull();
  expect(container.textContent).not.toContain(SUPPLIER_NAME);
});

test.each([TermsPage, PrivacyPage, RefundPage, SupportPage])('legal page heading has no English label above the Russian title', async Page => {
  await render(<Page />);
  const heading = container.querySelector('.page-heading').textContent;
  expect(heading).not.toMatch(/Terms|Privacy|Refund|Contact|Conditions|Support/);
  expect(container.querySelector('.page-heading .eyebrow')).toBeNull();
});

test.each([TermsPage, PrivacyPage, RefundPage, SupportPage])('legal page has an accessible heading, current revision and all policy links', async Page => {
  const oldTitle = document.title;
  await render(<Page />);
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(document.title).toContain('Lunaria');
  expect(container.querySelector('time').dateTime).toBe(Page===PrivacyPage?'2026-11-04':'2026-10-06');
  const emails = [...container.querySelectorAll('a[href^="mailto:"]')];
  expect(emails.length).toBeGreaterThan(0);
  for (const email of emails) {
    expect(email.getAttribute('href')).toBe('mailto:lunariaai.support@gmail.com');
    expect(email.textContent).toBe('lunariaai.support@gmail.com');
  }
  expect([...container.querySelectorAll('.legal-navigation a')].map(a => a.getAttribute('href')))
    .toEqual(['/terms', '/privacy', '/refunds', '/support']);
  await render(null);
  expect(document.title).toBe(oldTitle);
});

test('footer has labeled navigation, direct cancellation/support access and no personal identity', async () => {
  await render(<Footer />);
  expect(container.querySelectorAll('footer')).toHaveLength(1);
  for (const nav of container.querySelectorAll('nav')) expect(container.querySelector(`#${nav.getAttribute('aria-labelledby')}`)).not.toBeNull();
  for (const href of ['/terms', '/privacy', '/refunds', '/support', '/terms#cancellation', 'mailto:lunariaai.support@gmail.com'])
    expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
  expect(container.textContent).toContain('AI может ошибаться');
  expect(container.textContent).not.toContain(SUPPLIER_NAME);
});

test('policy links preserve the open purchase context', async () => {
  await render(<PolicyLinks />);
  for (const link of container.querySelectorAll('nav a')) {
    expect(link.target).toBe('_blank');expect(link.rel).toContain('noopener');
  }
});
