// Product configuration only. Usage and the active plan must come from backend.
export const FREE_CHART_LIMIT = 3;
export const FREE_GPT_LIMIT = 10;
export const PREMIUM_CHART_LIMIT = 10;
export const PREMIUM_GPT_LIMIT = 300;
export const PLANS = {
  free: { chartLimit: FREE_CHART_LIMIT, gptLimit: FREE_GPT_LIMIT, period: "lifetime" },
  premium: { chartLimit: PREMIUM_CHART_LIMIT, gptLimit: PREMIUM_GPT_LIMIT, period: "billing_period" },
};

// Offer catalogue (decision 28). Display only: the server checks the real price at the provider before every payment,
// and the browser sends nothing but the product name.
export const PACK_SIZE = 50;
export const PRODUCT_IDS = ["premium_month", "premium_year", "question_pack"];
export const OFFER_TITLES = { premium_month: "Premium на месяц", premium_year: "Premium на год", question_pack: `+${PACK_SIZE} вопросов` };
export const PRICES = {
  premium_month: { usd: "$9.99", rub: "799 ₽" },
  premium_year: { usd: "$69.99", rub: "4 790 ₽", usdPerMonth: "$5.83", rubPerMonth: "399 ₽", usdSaving: 42, rubSaving: 50 },
  question_pack: { usd: "$4.99", rub: "399 ₽" },
};
// Server flags that say which provider can sell a product right now.
export const PROVIDER_FLAGS = {
  premium_month: { stripe: "stripe_checkout_available", lava: "lava_checkout_available" },
  premium_year: { stripe: "stripe_annual_checkout_available", lava: "lava_annual_checkout_available" },
  question_pack: { stripe: "stripe_pack_checkout_available", lava: "lava_pack_checkout_available" },
};
