import React, { useEffect, useState } from "react";
import Checkout from "./Checkout";
import { ELIXIR_TO_RM_RATE, LIVE_RM_PER_ETH } from "../dashboard/dashboardData";
import { css, Section } from "../dashboard/dashboardUi";

// Per-item price helpers (mirror ShopPage / backend rates).
function priceRm(it) {
  const eth = parseFloat(it.priceEth || 0);
  return it.priceMyr ? parseFloat(it.priceMyr) : eth * LIVE_RM_PER_ETH;
}
function priceElixir(it) {
  return Math.ceil(priceRm(it) / ELIXIR_TO_RM_RATE);
}

export default function CartPage({
  cart = [],
  cartLoading,
  cartMessage,
  updateCartItem,
  removeCartItem,
  loadCart,
  refreshWallet,
  refreshOrders,
}) {
  const [checkoutMerchant, setCheckoutMerchant] = useState(null);

  useEffect(() => {
    loadCart?.();
  }, []); // eslint-disable-line

  // Group cart items by seller — one order per store.
  const groups = {};
  for (const it of cart) {
    const key = it.merchantId || it.merchantName || "unknown";
    if (!groups[key]) {
      groups[key] = {
        merchantId: it.merchantId,
        merchantName: it.merchantName,
        merchantWallet: it.merchantWallet,
        merchantHasMetamask: it.merchantHasMetamask,
        items: [],
      };
    }
    groups[key].items.push(it);
  }
  const groupList = Object.values(groups);

  async function handleSuccess() {
    setCheckoutMerchant(null);
    await loadCart?.();
    await refreshWallet?.();
    await refreshOrders?.();
  }

  function buildBasket(group) {
    return {
      merchantWallet: group.merchantWallet,
      merchantName: group.merchantName,
      merchantHasMetamask: group.merchantHasMetamask,
      productRef: `Order from ${group.merchantName || "seller"}`,
      items: group.items.map((i) => ({
        id: i.productId,
        name: i.name,
        priceEth: i.priceEth,
        priceMyr: i.priceMyr,
        quantity: i.quantity,
      })),
    };
  }

  return (
    <Section label="Cart" title="Your Shopping Cart">
      {cartMessage?.text && (
        <div
          style={{
            ...t.banner,
            color: cartMessage.type === "error" ? "#fca5a5" : "#34d399",
            background:
              cartMessage.type === "error"
                ? "rgba(239,68,68,0.1)"
                : "rgba(16,185,129,0.1)",
            borderColor:
              cartMessage.type === "error"
                ? "rgba(248,113,113,0.3)"
                : "rgba(52,211,153,0.3)",
          }}
        >
          {cartMessage.text}
        </div>
      )}

      {cartLoading && cart.length === 0 ? (
        <div style={css.loadingInline}>
          <div style={css.loadingSpinnerSm} />
          <span>Loading cart…</span>
        </div>
      ) : cart.length === 0 ? (
        <div style={css.emptyState}>
          <span style={css.emptyIcon}>🛒</span>
          <p style={css.emptyTitle}>Your cart is empty</p>
          <p style={css.muted}>
            Browse the Shop and add products — you can buy multiple items from a
            seller together in one order.
          </p>
        </div>
      ) : (
        <div style={t.groups}>
          {groupList.map((group) => {
            const key = group.merchantId || group.merchantName;
            const subEth = group.items.reduce(
              (s, it) => s + parseFloat(it.priceEth || 0) * it.quantity,
              0,
            );
            const subRm = group.items.reduce(
              (s, it) => s + priceRm(it) * it.quantity,
              0,
            );
            const subElixir = group.items.reduce(
              (s, it) => s + priceElixir(it) * it.quantity,
              0,
            );
            const units = group.items.reduce((s, it) => s + it.quantity, 0);
            const isCheckingOut = checkoutMerchant === key;

            return (
              <div key={key} style={t.storeCard}>
                <div style={t.storeHead}>
                  <span style={t.storeName}>🏪 {group.merchantName}</span>
                  <span style={t.storeMeta}>
                    {units} item{units !== 1 ? "s" : ""}
                  </span>
                </div>

                <div style={t.items}>
                  {group.items.map((it) => (
                    <div key={it.id} style={t.item}>
                      <div style={t.itemIcon}>
                        {(it.name || "P")[0].toUpperCase()}
                      </div>
                      <div style={t.itemInfo}>
                        <p style={t.itemName}>{it.name}</p>
                        <p style={t.itemPrice}>
                          {parseFloat(it.priceEth || 0).toFixed(6)} ETH ·{" "}
                          {priceElixir(it)} ✦ · RM {priceRm(it).toFixed(2)}
                        </p>
                      </div>
                      <div style={t.qtyBox}>
                        <button
                          style={t.qtyBtn}
                          onClick={() =>
                            updateCartItem?.(it.id, Math.max(1, it.quantity - 1))
                          }
                          disabled={it.quantity <= 1}
                        >
                          −
                        </button>
                        <span style={t.qtyVal}>{it.quantity}</span>
                        <button
                          style={t.qtyBtn}
                          onClick={() =>
                            updateCartItem?.(it.id, it.quantity + 1)
                          }
                          disabled={it.quantity >= it.stock}
                        >
                          +
                        </button>
                      </div>
                      <button
                        style={t.removeBtn}
                        onClick={() => removeCartItem?.(it.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={t.subtotalRow}>
                  <span style={t.subtotalLabel}>Subtotal</span>
                  <div style={t.subtotalVals}>
                    <strong style={{ color: "#a78bfa" }}>
                      {subEth.toFixed(6)} ETH
                    </strong>
                    <span style={t.subtotalAlt}>
                      {subElixir} ✦ · RM {subRm.toFixed(2)}
                    </span>
                  </div>
                </div>

                {isCheckingOut ? (
                  <div style={t.checkoutWrap}>
                    <div style={t.checkoutHead}>
                      <p style={css.sectionLabel}>Checkout</p>
                      <button
                        style={t.cancelBtn}
                        onClick={() => setCheckoutMerchant(null)}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                    <Checkout
                      basket={buildBasket(group)}
                      onSuccess={handleSuccess}
                    />
                  </div>
                ) : (
                  <button
                    style={t.checkoutBtn}
                    onClick={() => setCheckoutMerchant(key)}
                  >
                    Checkout this store — {subEth.toFixed(6)} ETH
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

const t = {
  banner: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  groups: { display: "grid", gap: 16 },
  storeCard: {
    borderRadius: 18,
    background: "rgba(8, 15, 28, 0.6)",
    border: "1px solid rgba(148,163,184,0.12)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  storeHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },
  storeName: { fontSize: 15, fontWeight: 800, color: "#f1f5f9" },
  storeMeta: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  items: { display: "grid", gap: 10 },
  item: { display: "flex", alignItems: "center", gap: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(129,140,248,0.25))",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    color: "#7dd3fc",
    flexShrink: 0,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  itemPrice: { margin: "3px 0 0", fontSize: 11, color: "#64748b" },
  qtyBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(15,23,42,0.7)",
    borderRadius: 10,
    padding: "4px 8px",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "none",
    background: "rgba(148,163,184,0.14)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
  },
  qtyVal: { minWidth: 20, textAlign: "center", fontWeight: 800, fontSize: 14 },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.25)",
    background: "rgba(248,113,113,0.08)",
    color: "#f87171",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  subtotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTop: "1px solid rgba(148,163,184,0.1)",
  },
  subtotalLabel: { fontSize: 13, color: "#94a3b8", fontWeight: 700 },
  subtotalVals: { textAlign: "right", display: "grid", gap: 2 },
  subtotalAlt: { fontSize: 11, color: "#64748b" },
  checkoutBtn: {
    padding: "13px 18px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  checkoutWrap: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    background: "rgba(2,6,23,0.5)",
    border: "1px solid rgba(148,163,184,0.12)",
  },
  checkoutHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cancelBtn: {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15,23,42,0.6)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
};
