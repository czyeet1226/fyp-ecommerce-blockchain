export const SECTIONS = [
  { id: "shop", label: "Shop", icon: "🛍", path: "/shop" },
  { id: "cart", label: "Cart", icon: "🛒", path: "/cart" },
  { id: "wallet", label: "Wallet", icon: "💎", path: "/wallet" },
  { id: "staking", label: "Staking", icon: "📈", path: "/staking" },
  { id: "track-order", label: "Track Order", icon: "📦", path: "/track-order" },
  { id: "history", label: "History", icon: "📋", path: "/history" },
  { id: "profile", label: "Profile", icon: "👤", path: "/profile" },
];

export const SHOP_CATEGORIES = [
  { key: "hot selling", label: "🔥 Hot", emoji: "🔥" },
  { key: "clothes", label: "👕 Clothes", emoji: "👕" },
  { key: "toys", label: "🧸 Toys", emoji: "🧸" },
  { key: "foods", label: "🍱 Foods", emoji: "🍱" },
  { key: "electronics", label: "💻 Electronics", emoji: "💻" },
];

export const SAMPLE_PRODUCTS = [
  {
    id: "sample-1",
    name: "Aurora Hoodie",
    category: "clothes",
    priceEth: "0.045000",
    priceMyr: "215.00",
    description: "Soft everyday hoodie with a clean storefront finish.",
    stock: 12,
  },
  {
    id: "sample-2",
    name: "Orbit Speaker",
    category: "electronics",
    priceEth: "0.080000",
    priceMyr: "380.00",
    description: "Compact speaker for your desk, room, or shop display.",
    stock: 8,
  },
  {
    id: "sample-3",
    name: "Mini Racer Set",
    category: "toys",
    priceEth: "0.030000",
    priceMyr: "145.00",
    description: "Fast-moving toy pack for the customer catalog.",
    stock: 18,
  },
  {
    id: "sample-4",
    name: "Snack Box",
    category: "foods",
    priceEth: "0.022000",
    priceMyr: "99.00",
    description: "Snacks bundle for quick repeat orders.",
    stock: 25,
  },
];

export const ORDER_STEPS = [
  "Order placed",
  "Processing",
  "Packed",
  "Shipped",
  "Delivered",
];

export const LIVE_RM_PER_ETH = 12000;
export const ELIXIR_TO_RM_RATE = 12;
export const RM_TO_ELIXIR_RATE = 1 / ELIXIR_TO_RM_RATE;

// ── Multi-currency swap config (mirrors backend RM_VALUE base) ──────────────
export const CURRENCIES = [
  { code: "ETH", label: "ETH", icon: "⟠", color: "#7c3aed" },
  { code: "ELIXIR", label: "Elixir", icon: "✦", color: "#0ea5e9" },
  { code: "RM", label: "RM", icon: "RM", color: "#10b981" },
];

// Value of 1 unit of each currency expressed in RM (the common base)
export const RM_VALUE = {
  RM: 1,
  ELIXIR: ELIXIR_TO_RM_RATE,
  ETH: LIVE_RM_PER_ETH,
};

export function convertCurrency(amount, fromCurrency, toCurrency) {
  const value = Number(amount || 0) * (RM_VALUE[fromCurrency] || 0);
  return value / (RM_VALUE[toCurrency] || 1);
}

export function fmt(value, digits = 2) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(digits) : `0.${"0".repeat(digits)}`;
}

export function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    category: p.category || "hot selling",
    priceEth: String(p.priceEth || "0"),
    priceMyr: p.priceMyr ? String(p.priceMyr) : "",
    description: p.description || "",
    stock: p.stock ?? 0,
    imageUrl: p.imageUrl || "",
    merchantId: p.merchantId || p.merchant?.id || null,
    merchantName: p.merchant?.name || p.merchantName || "Marketplace",
    // Payments settle to the seller's MetaMask when linked, else their
    // platform (Hardhat) wallet as a fallback.
    merchantWallet:
      p.merchant?.metamaskAddress ||
      p.merchant?.walletAddress ||
      p.merchantWallet ||
      "",
    merchantHasMetamask: Boolean(p.merchant?.metamaskAddress),
    // Backwards-compatible alias
    merchant: p.merchant?.name || p.merchantName || "Marketplace",
  };
}

export function orderEarnedElixir(order) {
  const earned = Number(order?.tokensEarned);
  if (Number.isFinite(earned) && earned > 0) return earned;
  const baseEth = Number(order?.totalPriceEth || order?.product?.priceEth || 0);
  const qty = Number(order?.quantity || 1);
  return Math.round(baseEth * qty * 1000);
}

export function getOrderStageIndex(order) {
  if (!order) return -1;
  if (order.status === "cancelled") return 0;
  // Seller-controlled delivery progress is authoritative when present.
  if (
    order.fulfillmentStage !== undefined &&
    order.fulfillmentStage !== null
  ) {
    return Number(order.fulfillmentStage);
  }
  if (order.status === "completed") return 0; // paid → order placed
  return 0;
}

export function categoryColor(cat) {
  const map = {
    "hot selling": "#f59e0b",
    clothes: "#818cf8",
    toys: "#34d399",
    foods: "#fb923c",
    electronics: "#38bdf8",
  };
  return map[cat?.toLowerCase()] || "#94a3b8";
}
