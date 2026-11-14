import { PRODUCT_IDS } from "../config/plans";

// Only the product name goes to the server, never a price or an id. The monthly plan keeps the old bodiless request.
export function productRequest(product) {
  if (product === "premium_month" || !PRODUCT_IDS.includes(product)) return { headers: {} };
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product }) };
}
