import React, { useState } from "react";
import {
  categoryColor,
  ELIXIR_TO_RM_RATE,
  LIVE_RM_PER_ETH,
  SHOP_CATEGORIES,
} from "../dashboard/dashboardData";
import { css, Section } from "../dashboard/dashboardUi";

export default function ShopPage({
  products,
  productsLoading,
  productsError,
  selectedCategory,
  setSelectedCategory,
  sellerFilter,
  viewSeller,
  clearSeller,
  addToCart,
}) {
  const [qty, setQty] = useState({}); // productId -> quantity
  const [addedId, setAddedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const getQty = (id) => qty[id] || 1;
  const setProductQty = (id, v) =>
    setQty((cur) => ({ ...cur, [id]: Math.max(1, v) }));

  async function handleAdd(product) {
    if (!addToCart) return;
    setBusyId(product.id);
    const ok = await addToCart(product.id, getQty(product.id));
    setBusyId(null);
    if (ok) {
      setAddedId(product.id);
      setTimeout(() => setAddedId((cur) => (cur === product.id ? null : cur)), 1600);
      setProductQty(product.id, 1);
    }
  }

  return (
    <Section label="Shop" title="Browse & Buy Products">
      {sellerFilter ? (
        <div style={sellerBanner.wrap}>
          <div>
            <p style={sellerBanner.kicker}>Viewing store</p>
            <h4 style={sellerBanner.name}>🏪 {sellerFilter.name}</h4>
          </div>
          <button style={sellerBanner.clearBtn} onClick={() => clearSeller?.()}>
            ✕ Show all sellers
          </button>
        </div>
      ) : (
        <div style={css.catRow}>
          {SHOP_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              style={{
                ...css.catBtn,
                ...(selectedCategory === cat.key ? css.catBtnActive : {}),
              }}
              onClick={() => setSelectedCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {productsError && <p style={css.helperText}>{productsError}</p>}

      {productsLoading ? (
        <div style={css.loadingInline}>
          <div style={css.loadingSpinnerSm} />
          <span>Loading products…</span>
        </div>
      ) : (
        <div style={css.productGrid}>
          {products.map((p) => {
            const color = categoryColor(p.category);
            const priceElixir = p.priceMyr
              ? Math.ceil(parseFloat(p.priceMyr) / ELIXIR_TO_RM_RATE)
              : Math.ceil(
                  (parseFloat(p.priceEth) * LIVE_RM_PER_ETH) /
                    ELIXIR_TO_RM_RATE,
                );

            const outOfStock = p.stock <= 0;

            return (
              <div
                key={p.id}
                style={{
                  ...css.productCard,
                  ...(addedId === p.id
                    ? {
                        borderColor: color,
                        boxShadow: `0 0 0 1px ${color}44, 0 8px 32px ${color}22`,
                      }
                    : {}),
                }}
              >
                <div style={css.productTopRow}>
                  <span
                    style={{ ...css.pill, background: `${color}22`, color }}
                  >
                    {p.category}
                  </span>
                  <span style={css.stockBadge}>
                    {p.stock > 0 ? `${p.stock} left` : "Out of stock"}
                  </span>
                </div>

                <h4 style={css.productName}>{p.name}</h4>

                {p.merchantName && (
                  <button
                    style={sellerLink.btn}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p.merchantId) {
                        viewSeller?.({ id: p.merchantId, name: p.merchantName });
                      }
                    }}
                    disabled={!p.merchantId}
                    title={
                      p.merchantId
                        ? `View all products by ${p.merchantName}`
                        : p.merchantName
                    }
                  >
                    by {p.merchantName}
                  </button>
                )}

                <p style={css.productDesc}>
                  {p.description || "Marketplace item."}
                </p>

                <div style={css.productPrices}>
                  <div style={css.priceTag}>
                    <span style={css.priceTagLabel}>ETH</span>
                    <strong style={css.priceTagValue}>
                      {Number(p.priceEth || 0).toFixed(4)}
                    </strong>
                  </div>
                  <div style={css.priceTag}>
                    <span style={css.priceTagLabel}>Elixir</span>
                    <strong style={{ ...css.priceTagValue, color: "#38bdf8" }}>
                      {priceElixir} ✦
                    </strong>
                  </div>
                  <div style={css.priceTag}>
                    <span style={css.priceTagLabel}>RM</span>
                    <strong style={{ ...css.priceTagValue, color: "#34d399" }}>
                      RM{" "}
                      {p.priceMyr ||
                        (parseFloat(p.priceEth) * LIVE_RM_PER_ETH).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div style={cartCtl.row}>
                  <div style={cartCtl.stepper}>
                    <button
                      style={cartCtl.stepBtn}
                      onClick={() => setProductQty(p.id, getQty(p.id) - 1)}
                      disabled={getQty(p.id) <= 1 || outOfStock}
                    >
                      −
                    </button>
                    <span style={cartCtl.qty}>{getQty(p.id)}</span>
                    <button
                      style={cartCtl.stepBtn}
                      onClick={() => setProductQty(p.id, getQty(p.id) + 1)}
                      disabled={outOfStock || getQty(p.id) >= p.stock}
                    >
                      +
                    </button>
                  </div>
                  <button
                    style={{
                      ...cartCtl.addBtn,
                      ...(addedId === p.id ? cartCtl.addBtnDone : {}),
                      ...(outOfStock ? cartCtl.addBtnDisabled : {}),
                    }}
                    onClick={() => handleAdd(p)}
                    disabled={outOfStock || busyId === p.id}
                  >
                    {outOfStock
                      ? "Out of stock"
                      : addedId === p.id
                      ? "Added ✓"
                      : busyId === p.id
                      ? "Adding…"
                      : "🛒 Add to Cart"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

const cartCtl = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(15,23,42,0.7)",
    borderRadius: 10,
    padding: "4px 8px",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  stepBtn: {
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
  qty: { minWidth: 20, textAlign: "center", fontWeight: 800, fontSize: 14, color: "#e2e8f0" },
  addBtn: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  addBtnDone: {
    background: "linear-gradient(135deg, #10b981, #059669)",
  },
  addBtnDisabled: {
    background: "rgba(148,163,184,0.2)",
    color: "#64748b",
    cursor: "not-allowed",
  },
};

const sellerBanner = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(56,189,248,0.08))",
    border: "1px solid rgba(52,211,153,0.25)",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#475569",
  },
  name: { margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#f1f5f9" },
  clearBtn: {
    padding: "8px 16px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15,23,42,0.6)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
};

const sellerLink = {
  btn: {
    alignSelf: "start",
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    color: "#7dd3fc",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },
};
