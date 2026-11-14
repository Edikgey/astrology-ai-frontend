import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ShareCard from './ShareCard';

const bodies = {
  '☉': { symbol: '☉', label: 'Солнце', sign: 'Козерог', degree: 281.4 },
  '☽': { symbol: '☽', label: 'Луна', sign: 'Скорпион', degree: 235.5 },
  AS: { symbol: 'AS', label: 'Асцендент', sign: 'Рыбы', degree: 350.2 },
};
let container, root, painted, blob;
const ctx = () => new Proxy({}, {
  get: (target, key) => {
    if (key === 'measureText') return text => ({ width: String(text).length * 10 });
    if (key === 'fillText') return text => painted.push(text);
    if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
    return key in target ? target[key] : () => {};
  },
  set: (target, key, value) => { target[key] = value; return true; },
});
const render = async props => act(async () => root.render(<ShareCard bodies={bodies} timeProvenance="local_iana" {...props} />));
const open = async () => act(async () => { container.querySelector('.share-card-open').click(); });
const dialogButton = label => [...container.querySelectorAll('dialog button')].find(button => button.textContent === label);

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  painted = [];
  blob = new Blob(['png'], { type: 'image/png' });
  global.Path2D = class {};
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  HTMLCanvasElement.prototype.getContext = () => ctx();
  HTMLCanvasElement.prototype.toBlob = function (callback) { callback(blob); };
  URL.createObjectURL = jest.fn(() => 'blob:card');
  URL.revokeObjectURL = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete global.Path2D;
  delete navigator.share;
  delete navigator.canShare;
});

test('the button is there and the preview opens with the three signs from the chart', async () => {
  await render();
  expect(container.querySelector('.share-card-open').textContent).toBe('Поделиться картой');
  expect(container.querySelector('dialog')).toBeNull();
  await open();
  const canvas = container.querySelector('dialog canvas');
  expect(canvas).not.toBeNull();
  expect(canvas.width).toBe(1080);
  expect(canvas.height).toBe(1920);
  expect(canvas.getAttribute('aria-label')).toBe('Моя большая тройка: Солнце — Козерог, Луна — Скорпион, Асцендент — Рыбы');
  for (const sign of ['Козерог', 'Скорпион', 'Рыбы']) expect(painted).toContain(sign);
});

test('without a Sun or Moon sign there is no button', async () => {
  await render({ bodies: { AS: bodies.AS } });
  expect(container.querySelector('.share-card-open')).toBeNull();
});

test('without a verified birth time the preview has two positions and the honest note', async () => {
  await render({ timeProvenance: 'legacy_unverified' });
  await open();
  expect(container.querySelector('dialog canvas').getAttribute('aria-label')).toBe('Моя большая тройка: Солнце — Козерог, Луна — Скорпион');
  expect(painted).not.toContain('Рыбы');
  expect(painted.join(' ')).toMatch(/Асцендент не показан/);
});

test('nothing personal reaches the image or its caption', async () => {
  await render({ chartData: { name: 'Анна', birth_utc: '1992-09-02T20:00:00', place: 'Москва' } });
  await open();
  const text = [...painted, container.querySelector('dialog canvas').getAttribute('aria-label'), container.querySelector('dialog').textContent].join(' ');
  expect(text).not.toMatch(/Анна|Москва|1992|20:00|\d{1,2}\.\d{1,2}\.\d{2,4}/);
  expect(container.querySelector('dialog').textContent).toMatch(/нет имени, даты, времени и места рождения/);
});

test('"Поделиться" is hidden when the browser cannot share files', async () => {
  await render();
  await open();
  expect(dialogButton('Поделиться')).toBeUndefined();
  expect(dialogButton('Скачать картинку')).toBeTruthy();
});

test('"Поделиться" sends the PNG file to the system share sheet where the browser can', async () => {
  navigator.canShare = jest.fn(() => true);
  navigator.share = jest.fn(() => Promise.resolve());
  await render();
  await open();
  await act(async () => { dialogButton('Поделиться').click(); });
  expect(navigator.share).toHaveBeenCalledTimes(1);
  const [{ files }] = navigator.share.mock.calls[0];
  expect(files).toHaveLength(1);
  expect(files[0].type).toBe('image/png');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('closing the share sheet is not an error', async () => {
  navigator.canShare = jest.fn(() => true);
  navigator.share = jest.fn(() => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })));
  await render();
  await open();
  await act(async () => { dialogButton('Поделиться').click(); });
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('"Скачать картинку" saves a PNG file', async () => {
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await render();
  await open();
  await act(async () => { dialogButton('Скачать картинку').click(); });
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledTimes(1);
  expect(click.mock.instances[0].download).toMatch(/\.png$/);
  click.mockRestore();
});

test('a failed export tells the person what to do', async () => {
  HTMLCanvasElement.prototype.toBlob = function (callback) { callback(null); };
  await render();
  await open();
  await act(async () => { dialogButton('Скачать картинку').click(); });
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/Не удалось подготовить картинку/);
});

test('closing with the cross returns the focus to the "Поделиться картой" button', async () => {
  await render();
  await open();
  await act(async () => { container.querySelector('dialog .modal-dismiss').click(); });
  expect(container.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(container.querySelector('.share-card-open'));
});

test('closing with Escape returns the focus to the "Поделиться картой" button', async () => {
  await render();
  await open();
  await act(async () => { container.querySelector('dialog').dispatchEvent(new Event('cancel')); });
  expect(container.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(container.querySelector('.share-card-open'));
});

test('a drawing error is shown with what to do and the buttons are not stuck disabled', async () => {
  HTMLCanvasElement.prototype.getContext = () => null;
  await render();
  await open();
  expect(container.querySelector('[role="alert"]').textContent).toBe('Не удалось подготовить картинку. Закройте окно и попробуйте ещё раз.');
  expect(dialogButton('Скачать картинку').disabled).toBe(false);
  await act(async () => { dialogButton('Скачать картинку').click(); });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

test('a second "Поделиться" while the share sheet is open is ignored and shows no error', async () => {
  let finish;
  navigator.canShare = jest.fn(() => true);
  navigator.share = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  await render();
  await open();
  await act(async () => { dialogButton('Поделиться').click(); });
  await act(async () => { dialogButton('Поделиться').click(); });
  expect(navigator.share).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => { finish(); });
  await act(async () => { dialogButton('Поделиться').click(); });
  expect(navigator.share).toHaveBeenCalledTimes(2);
});
