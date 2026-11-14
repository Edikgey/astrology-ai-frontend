import { PROVIDER_FLAGS } from "../config/plans";

// What may be bought is only what the server says: /account/usage flags, in the free beta as outside it (decision 41).
export const providersFor = (usage, product) =>
  ({ stripe: usage?.[PROVIDER_FLAGS[product].stripe] === true, lava: usage?.[PROVIDER_FLAGS[product].lava] === true });
export const canBuy = (usage, product) => { const found = providersFor(usage, product); return found.stripe || found.lava; };
// An older server has none of the new flags: then the old Premium offer stays as it was.
export const hasNewOffers = usage => canBuy(usage, "premium_year") || canBuy(usage, "question_pack");
export const packBalance = usage => Number.isFinite(usage?.pack_questions_remaining) ? usage.pack_questions_remaining : 0;
