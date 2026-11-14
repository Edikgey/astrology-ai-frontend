// METRICS-2 regression F3, F4, F9 (wheel part), F10 (wheel part).
// A real analytics client sits behind the module; assertions are on what would leave the browser.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import ChartWheel from './ChartWheel';
import { normalizeChart } from './model';
import api from './fixtures/api-placidus.json';
import { createHarness, throwingAnalytics } from '../../analytics/metrics2Harness';
import { saveConsent } from '../../analytics/consent';

let mockTarget;
jest.mock('../../analytics/productAnalytics', () => {
  const real = jest.requireActual('../../analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});

let root, container, model, harness;
beforeEach(async () => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  harness = createHarness(); mockTarget = harness.client;
  await harness.start('/natal-chart-result');
  await harness.settle();
  expect(harness.names()).toContain('page_viewed'); // the harness itself delivers events
  harness.transport.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  model = normalizeChart({ bodies: api.bodies_for_circle, houses: api.houses, aspects: api.aspects_for_circle, structuredAspects: api.aspects_structured, houseSystem: 'Placidus' });
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  harness.client.halt(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});
const render = props => act(async () => root.render(<ChartWheel model={model} onAsk={jest.fn()} {...props} />));
const click = el => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const askButton = () => [...container.querySelectorAll('.wheel-tip button')].find(b => b.textContent === 'Спросить об этом');
const planet = id => container.querySelector(`[data-label="${id}"]`);
const aspectId = () => model.aspects.find(a => a.from === '☉' && a.to === '☿').id;
const aspectHit = () => container.querySelector(`[data-aspect-id="${aspectId()}"] .aspect-hit`);
const opened = async () => { await harness.settle(); return harness.named('wheel_tooltip_opened'); };

describe('F3: wheel_tooltip_opened', () => {
  test('a click on a planet gives exactly one event with object=point', async () => {
    await render();
    await click(planet('♀'));
    expect(container.querySelector('.wheel-tip')).not.toBeNull();
    const events = await opened();
    expect(events).toHaveLength(1);
    expect(events[0].properties).toEqual({ object: 'point' });
    expect(events[0].route_key).toBe('chart_view');
  });

  test('Enter on a planet gives exactly one event with object=point', async () => {
    await render();
    await act(async () => Simulate.keyDown(planet('☉'), { key: 'Enter', preventDefault() {} }));
    const events = await opened();
    expect(events.map(value => value.properties)).toEqual([{ object: 'point' }]);
  });

  test('an angle (ASC) is a point; a house sector is a house; an aspect line is an aspect', async () => {
    await render();
    await click(container.querySelector('.angle-marker'));
    await click(container.querySelector('.house-hit'));
    await click(aspectHit());
    expect((await opened()).map(value => value.properties.object)).toEqual(['point', 'house', 'aspect']);
  });

  test('buttons of the text lists open the same tooltips', async () => {
    await render();
    await act(async () => container.querySelector('.wheel-point-list button').click());
    await act(async () => container.querySelector('.wheel-house-list button').click());
    await act(async () => container.querySelectorAll('.wheel-aspect-list button')[model.aspects.findIndex(a => a.id === aspectId())].click());
    expect((await opened()).map(value => value.properties.object)).toEqual(['point', 'house', 'aspect']);
  });

  test('a member button of a dense group opens a point tooltip, the group itself does not', async () => {
    const bodies = Object.fromEntries(Object.entries(api.bodies_for_circle).map(([id, body]) => [id, { ...body, degree: ['AS', 'DS', 'MC', 'IC'].includes(id) ? body.degree : 359.8 }]));
    model = normalizeChart({ bodies, houses: api.houses, aspects: api.aspects_for_circle });
    await render();
    const group = container.querySelector('[aria-label^="Группа:"]');
    expect(group).not.toBeNull();
    await click(group);
    expect(container.querySelector('.wheel-tip')).toBeNull();
    expect(await opened()).toHaveLength(0);
    await click(container.querySelectorAll('.group-members button')[0]);
    expect((await opened()).map(value => value.properties)).toEqual([{ object: 'point' }]);
  });

  test('hover, focus, a repeated pick of the same object and a pattern do not count', async () => {
    await render();
    await act(async () => Simulate.mouseEnter(planet('♀')));
    await act(async () => Simulate.focus(planet('♂')));
    await act(async () => Simulate.mouseEnter(container.querySelector('.house-hit')));
    expect(await opened()).toHaveLength(0);
    await click(planet('♀'));
    await click(planet('♀'));
    await act(async () => Simulate.mouseEnter(planet('♂')));
    await act(async () => Simulate.mouseLeave(planet('♂')));
    expect(await opened()).toHaveLength(1);
    const pattern = container.querySelector('.pattern-focus-list button:not([disabled])');
    if (pattern) await act(async () => pattern.click());
    expect(await opened()).toHaveLength(1);
  });

  test('picking another object counts again', async () => {
    await render();
    await click(planet('♀')); await click(planet('♂'));
    expect(await opened()).toHaveLength(2);
  });

  test('nothing about the chart leaves the browser: no planet, sign, house, orb or question text', async () => {
    await render();
    await click(planet('♀')); await click(askButton());
    await click(container.querySelector('.house-hit')); await click(aspectHit());
    await harness.settle();
    const wire = harness.wire();
    expect(harness.names().filter(name => name.startsWith('wheel_')).length).toBeGreaterThanOrEqual(3);
    expect(wire).not.toMatch(/Венера|Солнце|Меркурий|Стрелец|Стрельце|дом|орбис|Что значит|куспид|242\.8|♀|☉/i);
    for (const value of harness.records().filter(item => item.name.startsWith('wheel_'))) {
      expect(Object.keys(value.properties)).toEqual(['object']);
    }
  });

  test('preview mode (landing illustration) never reports', async () => {
    await render({ preview: true, onAsk: undefined });
    await click(planet('♀')); await click(container.querySelector('.house-hit'));
    await act(async () => Simulate.keyDown(planet('☉'), { key: 'Enter', preventDefault() {} }));
    expect(container.querySelector('.wheel-tip')).toBeNull();
    expect(harness.names().filter(name => name.startsWith('wheel_'))).toEqual([]);
    expect(harness.transport.mock.calls.filter(([url]) => url.endsWith('/events'))).toEqual([]);
    // preview must not hide a broken reporter: a normal wheel still reports
    await render({ preview: false });
    await click(planet('♀'));
    expect(await opened()).toHaveLength(1);
  });
});

describe('F4: wheel_question_selected', () => {
  test.each([['point'], ['house'], ['aspect']])('«Спросить об этом» for a %s gives one event, the chat still gets the question', async object => {
    const onAsk = jest.fn();
    await render({ onAsk });
    if (object === 'point') await click(planet('♀'));
    if (object === 'house') await click(container.querySelector('.house-hit'));
    if (object === 'aspect') await click(aspectHit());
    await harness.settle();
    expect(harness.named('wheel_question_selected')).toHaveLength(0);
    onAsk.mockImplementation(() => { onAsk.pendingAtCall = harness.client.status().pending; });
    await click(askButton());
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk.mock.calls[0][0]).toMatch(/^Что значит /);
    // the event is queued before the question is handed to the chat
    expect(onAsk.pendingAtCall).toBeGreaterThanOrEqual(1);
    await harness.settle();
    const events = harness.named('wheel_question_selected');
    expect(events).toHaveLength(1);
    expect(events[0].properties).toEqual({ object });
    expect(harness.wire()).not.toMatch(/Что значит|Венера|в моей карте/);
  });

  test('a tooltip that is only open, or hover, does not report a question', async () => {
    await render();
    await click(planet('♀'));
    await act(async () => Simulate.mouseEnter(askButton()));
    await harness.settle();
    expect(harness.named('wheel_tooltip_opened')).toHaveLength(1);
    expect(harness.named('wheel_question_selected')).toHaveLength(0);
  });
});

describe('F9: no consent, no wheel events', () => {
  test.each(['rejected', 'undecided'])('with %s consent nothing is queued or sent', async state => {
    document.cookie = 'userCookieConsent=; Max-Age=0; Path=/'; document.cookie = 'lunariaAnalyticsPolicy=; Max-Age=0; Path=/';
    if (state === 'rejected') document.cookie = 'userCookieConsent=false; Path=/';
    harness.client.halt(); harness.transport.mockClear();
    await harness.client.refresh({ actorKey: null, pathname: '/natal-chart-result' });
    const onAsk = jest.fn();
    await render({ onAsk });
    await click(planet('♀'));
    expect(container.querySelector('.wheel-tip')).not.toBeNull(); // the page itself still works
    await click(askButton());
    expect(onAsk).toHaveBeenCalledTimes(1);
    await harness.settle();
    expect(harness.transport.mock.calls.filter(([url]) => url.endsWith('/events'))).toEqual([]);
    expect(harness.client.status().pending).toBe(0);
  });

  test('on a section without a key (/reset-password) the wheel reports nothing, on a keyed one it does', async () => {
    await harness.client.refresh({ actorKey: null, pathname: '/reset-password' });
    await render();
    await click(planet('♀')); await click(askButton());
    await harness.settle();
    expect(harness.named('wheel_tooltip_opened')).toHaveLength(0);
    await harness.client.refresh({ actorKey: null, pathname: '/natal-chart-result' });
    await click(planet('♂'));
    expect(await opened()).toHaveLength(1);
  });
});

describe('F10 (guard): the wheel does not depend on analytics', () => {
  test('with analytics throwing, selection, tooltip and the question still work', async () => {
    mockTarget = throwingAnalytics();
    const onAsk = jest.fn();
    await render({ onAsk });
    await click(planet('♀'));
    expect(container.querySelector('.wheel-tip')).not.toBeNull();
    expect(container.querySelector('.wheel-detail').textContent).toContain('Венера');
    await click(askButton());
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledWith('Что значит Венера в Стрельце в 6 доме в моей карте?');
  });
});
