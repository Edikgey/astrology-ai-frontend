// PRICING-1 slice 0 (DESIGN §10), frontend side: which publishable keys the browser accepts.
// pk_live_ and pk_test_ are Stripe publishable keys; nothing else may configure checkout.
const NAME = 'REACT_APP_STRIPE_PUBLISHABLE_KEY';
let saved;
beforeEach(() => { saved = process.env[NAME]; });
afterEach(() => { if (saved === undefined) delete process.env[NAME]; else process.env[NAME] = saved; jest.resetModules(); });

jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));

const load = key => {
  if (key === undefined) delete process.env[NAME]; else process.env[NAME] = key;
  let loaded;
  jest.isolateModules(() => {
    loaded = { stripe: require('./stripe'), loadStripe: require('@stripe/stripe-js').loadStripe };
  });
  loaded.loadStripe.mockResolvedValue({ isolated: true });
  return loaded;
};

test.each(['pk_live_fixture', 'pk_test_fixture'])('%s configures checkout and is the key given to Stripe.js', async key => {
  const { stripe, loadStripe } = load(key);
  expect(stripe.stripeConfigured).toBe(true);
  await stripe.getStripe();
  expect(loadStripe).toHaveBeenCalledWith(key);
});

test.each([undefined, '', 'sk_live_fixture', 'sk_test_fixture', 'rk_live_fixture', 'pk_fixture', 'pk_other_fixture',
  ' pk_live_fixture', 'PK_LIVE_fixture', 'whsec_fixture'])('key %p leaves checkout unconfigured and never reaches Stripe.js', async key => {
  const { stripe, loadStripe } = load(key);
  expect(stripe.stripeConfigured).toBe(false);
  expect(() => stripe.getStripe()).toThrow('Оплата пока не настроена.');
  expect(loadStripe).not.toHaveBeenCalled();
});
