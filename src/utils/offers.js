import { PROVIDER_FLAGS } from "../config/plans";

// What may be bought is only what the server says: /account/usage flags, and never during the free beta.
// The monthly plan stays buyable in the beta as before; the year and the pack are not sold then.
export const providersFor = (usage, product) => usage?.free_beta_enabled === true && product !== "premium_month" ? { stripe: false, lava: false } :
  { stripe: usage?.[PROVIDER_FLAGS[product].stripe] === true, lava: usage?.[PROVIDER_FLAGS[product].lava] === true };
export const canBuy = (usage, product) => { const found = providersFor(usage, product); return found.stripe || found.lava; };
// An older server has none of the new flags: then the old Premium offer stays as it was.
export const hasNewOffers = usage => canBuy(usage, "premium_year") || canBuy(usage, "question_pack");
export const packBalance = usage => Number.isFinite(usage?.pack_questions_remaining) ? usage.pack_questions_remaining : 0;
