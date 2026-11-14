// METRICS-2 regression F11: the privacy page names the new analytics events (owner decision №24).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivacyPage } from './LegalPages';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const SENTENCE = 'На странице карты учитывается, какой вид объекта круга открыт — планета, дом или аспект — без самой планеты, знака и дома; также фиксируются вид технической ошибки страницы и момент, когда в бете бесплатный аккаунт достиг бы обычного лимита.';

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('the PostHog paragraph of the privacy page contains the owner-approved sentence, verbatim', async () => {
  await act(async () => root.render(<PrivacyPage />));
  const paragraph = [...container.querySelectorAll('p')].find(p => p.textContent.includes('PostHog для необязательной продуктовой аналитики'));
  expect(paragraph).toBeDefined();
  expect(paragraph.textContent).toContain(SENTENCE);
});
