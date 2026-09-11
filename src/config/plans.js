// Product configuration only. Usage and the active plan must come from backend.
export const FREE_CHART_LIMIT = 3;
export const FREE_GPT_LIMIT = 10;
export const PREMIUM_CHART_LIMIT = 10;
export const PREMIUM_GPT_LIMIT = 300;
export const PLANS = {
  free: { chartLimit: FREE_CHART_LIMIT, gptLimit: FREE_GPT_LIMIT, period: "lifetime" },
  premium: { chartLimit: PREMIUM_CHART_LIMIT, gptLimit: PREMIUM_GPT_LIMIT, period: "billing_period" },
};
