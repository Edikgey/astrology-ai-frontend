import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Footer from './Footer';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

let root, container;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); await act(async () => root.render(<Footer />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('the plan page has the same name «Тарифы» in the footer as in the menu', () => {
  const link = container.querySelector('a[href="/pricing"]');
  expect(link.textContent).toBe('Тарифы');
  expect(container.textContent).not.toContain('Free и Premium');
});
