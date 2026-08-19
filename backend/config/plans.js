/**
 * backend/config/plans.js
 *
 * Seller subscription plans. Sellers pay a monthly fee (in ETH, to the
 * platform admin wallet) and each plan caps how many active products they
 * may list. `productLimit: null` means unlimited.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const PLANS = {
  starter: {
    key: "starter",
    label: "Starter",
    priceEth: 0.01,
    productLimit: 3,
    blurb: "List up to 3 products",
  },
  pro: {
    key: "pro",
    label: "Pro",
    priceEth: 0.03,
    productLimit: 10,
    blurb: "List up to 10 products",
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    priceEth: 0.06,
    productLimit: null, // unlimited
    blurb: "Unlimited products",
  },
};

const PLAN_KEYS = Object.keys(PLANS);

// Billing cycle length (30 days).
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function getPlan(key) {
  return PLANS[key] || PLANS.starter;
}

function isValidPlan(key) {
  return PLAN_KEYS.includes(key);
}

/**
 * Whether a seller on `planKey` can add another product given current count.
 * Unlimited plans (null limit) always return true.
 */
function canAddProduct(planKey, currentCount) {
  const limit = getPlan(planKey).productLimit;
  if (limit === null || limit === undefined) return true;
  return Number(currentCount) < Number(limit);
}

module.exports = {
  PLANS,
  PLAN_KEYS,
  BILLING_PERIOD_MS,
  getPlan,
  isValidPlan,
  canAddProduct,
};
