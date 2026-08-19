/**
 * frontend/src/pages/Checkout.jsx
 *
 * Checkout with three payment methods:
 *   1. ETH    — escrow-protected (ETH held until buyer confirms delivery)
 *   2. Elixir — escrow-protected (LYT held until buyer confirms delivery)
 *   3. RM     — off-chain ledger (instant)
 *
 * ETH and Elixir both route through the PurchaseEscrow contract, so the seller
 * is only paid once the buyer confirms delivery (or a dispute is resolved).
 */

import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";

const ELIXIR_TO_RM = 12; // 1 Elixir = RM 12
const ETH_TO_RM = 12000; // 1 ETH = RM 12000

const PAYMENT_MODES = [
  {
    value: "ETH_ESCROW",
    label: "ETH",
    icon: "⟠",
    desc: "Escrow-protected ETH",
    color: "#7c3aed",
    glow: "rgba(124,58,237,0.35)",
  },
  {
    value: "TOKEN_ESCROW",
    label: "Elixir",
    icon: "✦",
    desc: "Escrow-protected Elixir",
    color: "#0ea5e9",
    glow: "rgba(14,165,233,0.35)",
  },
  {
    value: "RM_ONLY",
    label: "RM",
    icon: "RM",
    desc: "Pay with Ringgit Malaysia",
    color: "#10b981",
    glow: "rgba(16,185,129,0.35)",
  },
];

// Per-item price helpers (mirror ShopPage / backend rates).
function itemPriceRm(it) {
  const eth = parseFloat(it.priceEth || 0);
  return it.priceMyr ? parseFloat(it.priceMyr) : eth * ETH_TO_RM;
}
function itemPriceElixir(it) {
  return Math.ceil(itemPriceRm(it) / ELIXIR_TO_RM);
}

export default function Checkout({ basket, product, quantity = 1, onSuccess }) {
  const { wallet, fetchWallet } = useAuth();
  const {
    isConnected,
    connectWallet,
    createEscrowOnChain,
    createTokenEscrowOnChain,
  } = useWeb3();

  const [paymentMode, setPaymentMode] = useState("ETH_ESCROW");
  const [deliveryAddress, setDelivery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);

  // Normalise into a "basket" so single-product and cart checkout share code.
  const order =
    basket ||
    (product
      ? {
          merchantWallet: product.merchantWallet,
          merchantName: product.merchantName || product.merchant,
          productRef: product.id,
          items: [
            {
              id: product.id,
              name: product.name,
              priceEth: product.priceEth,
              priceMyr: product.priceMyr,
              quantity,
            },
          ],
        }
      : { items: [], merchantWallet: "", productRef: "" });

  const items = order.items || [];
  const merchantWallet = order.merchantWallet;

  const ethBalance = parseFloat(wallet.ethBalance || 0);
  const elixirBalance = parseInt(wallet.lytBalance || 0);
  const rmBalance = elixirBalance * ELIXIR_TO_RM; // Derived RM from Elixir

  const totalEth = items.reduce(
    (s, it) => s + parseFloat(it.priceEth || 0) * it.quantity,
    0,
  );
  const totalRm = items.reduce((s, it) => s + itemPriceRm(it) * it.quantity, 0);
  const totalElixir = items.reduce(
    (s, it) => s + itemPriceElixir(it) * it.quantity,
    0,
  );
  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

  const handleCheckout = async () => {
    setError("");

    if (items.length === 0) {
      setError("Your basket is empty.");
      return;
    }

    // RM is the off-chain fiat ledger; every other mode needs MetaMask.
    const needsWallet = paymentMode !== "RM_ONLY";
    if (needsWallet && !isConnected) {
      setError("Please connect your MetaMask wallet to pay with crypto.");
      return;
    }
    if (needsWallet && !merchantWallet) {
      setError(
        "This seller has no on-chain wallet configured, so crypto payment isn't available.",
      );
      return;
    }

    setLoading(true);
    try {
      let res;
      const orderItems = items.map((it) => ({
        productId: it.id,
        quantity: it.quantity,
      }));
      const productRef = order.productRef || `Cart (${totalUnits} items)`;
      const base = { items: orderItems, deliveryAddress };

      if (paymentMode === "ETH_ESCROW") {
        // MetaMask locks the ETH in the escrow contract; the seller is paid
        // only once the buyer confirms delivery (from the Track Order page).
        const txHash = await createEscrowOnChain(
          merchantWallet,
          productRef,
          totalEth,
        );
        res = await axios.post("/api/payment/escrow", { ...base, txHash });
      } else if (paymentMode === "TOKEN_ESCROW") {
        // MetaMask approves + locks the Elixir in the escrow contract; the
        // seller receives the tokens only after delivery is confirmed.
        // (This prompts two MetaMask signatures: approve, then escrow.)
        const txHash = await createTokenEscrowOnChain(
          merchantWallet,
          productRef,
          totalElixir,
        );
        res = await axios.post("/api/payment/escrow-token", {
          ...base,
          txHash,
          tokensSpent: totalElixir,
        });
      } else {
        // RM: pure off-chain ledger deduction.
        res = await axios.post("/api/payment/rm", base);
      }

      setResult(res.data);
      fetchWallet();
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err?.shortMessage ||
          err?.message ||
          "Payment failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  if (result) {
    return (
      <div style={s.successBox}>
        <div style={s.successIconRing}>
          <span style={s.successIcon}>✓</span>
        </div>
        <h2 style={s.successTitle}>Payment Successful!</h2>
        <div style={s.successDetails}>
          <div style={s.successRow}>
            <span style={s.successLabel}>Order ID</span>
            <strong style={s.successValue}>{result.orderId}</strong>
          </div>
          <div style={s.successRow}>
            <span style={s.successLabel}>Payment Mode</span>
            <strong style={s.successValue}>{result.paymentMode}</strong>
          </div>
          {result.ethPaid && (
            <div style={s.successRow}>
              <span style={s.successLabel}>ETH Paid</span>
              <strong style={s.successValue}>{result.ethPaid} ETH</strong>
            </div>
          )}
          {result.tokensSpent && (
            <div style={s.successRow}>
              <span style={s.successLabel}>Elixir Spent</span>
              <strong style={s.successValue}>{result.tokensSpent} ✦</strong>
            </div>
          )}
          <div style={s.successHash}>
            <span style={s.successLabel}>Transaction Hash</span>
            <code style={s.hashCode}>{result.txHash || "Pending"}</code>
          </div>
        </div>
        <p style={s.successNote}>
          🎉 Elixir loyalty tokens have been added to your wallet!
        </p>
        <button style={s.resetBtn} onClick={() => setResult(null)}>
          Place Another Order
        </button>
      </div>
    );
  }

  const activeMode = PAYMENT_MODES.find((m) => m.value === paymentMode);

  return (
    <div style={s.container}>
      {/* Order Summary */}
      <div style={s.productSummary}>
        <div style={s.productSummaryLeft}>
          <div style={s.productSummaryIcon}>
            {(order.merchantName || "S")[0]?.toUpperCase()}
          </div>
          <div>
            <p style={s.productSummaryName}>
              {items.length === 1
                ? items[0].name
                : `${totalUnits} items · ${items.length} products`}
            </p>
            <p style={s.productSummaryMeta}>
              {order.merchantName ? `from ${order.merchantName}` : "Your order"}
            </p>
          </div>
        </div>
        <div style={s.productSummaryPrices}>
          <span style={s.pricePrimary}>RM {totalRm.toFixed(2)}</span>
          <span style={s.priceSecondary}>
            {totalElixir} ✦ · {totalEth.toFixed(6)} ETH
          </span>
        </div>
      </div>

      {/* Line items (only when more than one product) */}
      {items.length > 1 && (
        <div style={s.lineItems}>
          {items.map((it) => (
            <div key={it.id} style={s.lineItem}>
              <span style={s.lineItemName}>
                {it.name} <span style={s.lineItemQty}>× {it.quantity}</span>
              </span>
              <span style={s.lineItemPrice}>
                {(parseFloat(it.priceEth || 0) * it.quantity).toFixed(6)} ETH
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Wallet Balances */}
      <div style={s.balanceRow}>
        <div style={s.balanceChip}>
          <span style={s.balanceIcon}>⟠</span>
          <div>
            <p style={s.balanceLabel}>ETH</p>
            <p style={s.balanceAmount}>{ethBalance.toFixed(4)}</p>
          </div>
        </div>
        <div style={s.balanceChip}>
          <span style={s.balanceIcon}>✦</span>
          <div>
            <p style={s.balanceLabel}>Elixir</p>
            <p style={s.balanceAmount}>{elixirBalance.toLocaleString()}</p>
          </div>
        </div>
        <div style={s.balanceChip}>
          <span style={s.balanceIcon}>RM</span>
          <div>
            <p style={s.balanceLabel}>RM value</p>
            <p style={s.balanceAmount}>{rmBalance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Payment Mode Selector */}
      <p style={s.sectionLabel}>Choose Payment Method</p>
      <div style={s.modeGrid}>
        {PAYMENT_MODES.map((mode) => {
          const isActive = paymentMode === mode.value;
          return (
            <button
              key={mode.value}
              style={{
                ...s.modeCard,
                ...(isActive
                  ? {
                      borderColor: mode.color,
                      boxShadow: `0 0 0 1px ${mode.color}, 0 4px 20px ${mode.glow}`,
                      background: `linear-gradient(135deg, rgba(${hexToRgb(
                        mode.color,
                      )},0.15), rgba(${hexToRgb(mode.color)},0.05))`,
                    }
                  : {}),
                ...(hover === mode.value && !isActive
                  ? { borderColor: "rgba(148,163,184,0.35)" }
                  : {}),
              }}
              onClick={() => setPaymentMode(mode.value)}
              onMouseEnter={() => setHover(mode.value)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                style={{
                  ...s.modeCardIcon,
                  color: isActive ? mode.color : "#94a3b8",
                }}
              >
                {mode.icon}
              </span>
              <p
                style={{
                  ...s.modeCardLabel,
                  color: isActive ? "#f8fafc" : "#cbd5e1",
                }}
              >
                {mode.label}
              </p>
              <p style={s.modeCardDesc}>{mode.desc}</p>
            </button>
          );
        })}
      </div>

      {/* MetaMask connection notice for crypto payments (ETH / Elixir escrow) */}
      {paymentMode !== "RM_ONLY" && !isConnected && (
        <div style={s.metamaskNotice}>
          <span style={{ fontSize: 16 }}>🦊</span>
          <span>MetaMask wallet required for crypto payments.</span>
          <button style={s.metamaskConnectInline} onClick={connectWallet}>
            Connect Now
          </button>
        </div>
      )}

      {/* Payment Summary based on mode */}
      <div style={s.costSummary}>
        {paymentMode === "ETH_ESCROW" && (
          <>
            <div style={s.costRow}>
              <span>Items</span>
              <strong>{totalUnits}</strong>
            </div>
            <div style={{ ...s.costRow, ...s.costTotal }}>
              <span>Held in escrow</span>
              <strong style={{ color: "#7c3aed" }}>
                {totalEth.toFixed(6)} ETH
              </strong>
            </div>
            <p style={s.costEquivalent}>
              ≈ RM {(totalEth * ETH_TO_RM).toFixed(2)}
            </p>
            <div style={s.escrowNote}>
              🛡 Your ETH is locked in the escrow smart contract. The seller is
              paid only after you confirm delivery in Track Order. You can raise
              a dispute before releasing.
            </div>
          </>
        )}

        {paymentMode === "TOKEN_ESCROW" && (
          <>
            <div style={s.costRow}>
              <span>Items</span>
              <strong>{totalUnits}</strong>
            </div>
            <div style={{ ...s.costRow, ...s.costTotal }}>
              <span>Held in escrow</span>
              <strong style={{ color: "#0ea5e9" }}>
                {totalElixir} ✦ Elixir
              </strong>
            </div>
            <p style={s.costEquivalent}>≈ RM {totalRm.toFixed(2)}</p>
            {elixirBalance < totalElixir && (
              <p style={s.costWarning}>
                ⚠ Insufficient Elixir balance ({elixirBalance} ✦ available)
              </p>
            )}
            <div style={s.escrowNote}>
              🛡 Your Elixir is locked in the escrow smart contract. The seller
              receives it only after you confirm delivery in Track Order. Paying
              with Elixir needs two MetaMask approvals (approve, then lock).
            </div>
          </>
        )}

        {paymentMode === "RM_ONLY" && (
          <>
            <div style={s.costRow}>
              <span>Items</span>
              <strong>{totalUnits}</strong>
            </div>
            <div style={{ ...s.costRow, ...s.costTotal }}>
              <span>Total</span>
              <strong style={{ color: "#10b981" }}>
                RM {totalRm.toFixed(2)}
              </strong>
            </div>
            <p style={s.costEquivalent}>
              ≈ {totalElixir} ✦ Elixir · {totalEth.toFixed(6)} ETH
            </p>
          </>
        )}
      </div>

      {/* Delivery Address */}
      <div style={s.fieldGroup}>
        <label style={s.fieldLabel}>📍 Delivery Address</label>
        <textarea
          value={deliveryAddress}
          onChange={(e) => setDelivery(e.target.value)}
          style={s.textarea}
          placeholder="Enter your full delivery address..."
          rows={3}
        />
      </div>

      {error && (
        <div style={s.errorBox}>
          <span>⚠</span> {error}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          ...s.confirmBtn,
          background: loading
            ? "rgba(148,163,184,0.2)"
            : `linear-gradient(135deg, ${
                activeMode?.color || "#7c3aed"
              }, ${shiftColor(activeMode?.color || "#7c3aed")})`,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <span style={s.loadingText}>
            <span style={s.spinner} /> Processing on blockchain...
          </span>
        ) : (
          `Confirm & Pay — ${getPayLabel(
            paymentMode,
            totalEth,
            totalElixir,
            totalRm,
          )}`
        )}
      </button>

      {paymentMode === "ETH_ESCROW" && (
        <p style={s.earnNote}>
          🎁 You'll earn{" "}
          <strong style={{ color: "#38bdf8" }}>
            {Math.max(1, Math.round(totalEth * 1000))} Elixir
          </strong>{" "}
          loyalty tokens when you confirm delivery
        </p>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getPayLabel(mode, eth, elixir, rm) {
  if (mode === "ETH_ESCROW") return `${eth.toFixed(6)} ETH to escrow`;
  if (mode === "TOKEN_ESCROW") return `${elixir} ✦ Elixir to escrow`;
  if (mode === "RM_ONLY") return `RM ${rm.toFixed(2)}`;
  return "Confirm";
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(
        result[3],
        16,
      )}`
    : "148,163,184";
}

function shiftColor(hex) {
  // Creates a slightly shifted variant of a hex color for gradients
  const map = {
    "#7c3aed": "#9333ea",
    "#0ea5e9": "#38bdf8",
    "#10b981": "#34d399",
    "#f59e0b": "#fbbf24",
    "#ec4899": "#f472b6",
  };
  return map[hex] || "#818cf8";
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = {
  container: {
    display: "grid",
    gap: 20,
  },
  productSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: 18,
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    gap: 12,
    flexWrap: "wrap",
  },
  productSummaryLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  productSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 18,
    color: "#07111f",
    flexShrink: 0,
  },
  productSummaryName: {
    margin: 0,
    fontWeight: 700,
    fontSize: 16,
    color: "#f8fafc",
  },
  productSummaryMeta: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "capitalize",
  },
  productSummaryPrices: {
    textAlign: "right",
  },
  pricePrimary: {
    display: "block",
    fontWeight: 800,
    fontSize: 20,
    color: "#10b981",
  },
  priceSecondary: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  balanceRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  balanceChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(2, 6, 23, 0.5)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  balanceIcon: {
    fontSize: 18,
    color: "#94a3b8",
    flexShrink: 0,
    fontWeight: 700,
  },
  balanceLabel: {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceAmount: {
    margin: "2px 0 0",
    fontWeight: 700,
    fontSize: 14,
    color: "#e2e8f0",
  },

  sectionLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#64748b",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
    gap: 10,
  },
  modeCard: {
    padding: "14px 10px",
    borderRadius: 16,
    border: "1px solid rgba(148, 163, 184, 0.14)",
    background: "rgba(15, 23, 42, 0.5)",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s ease",
  },
  modeCardIcon: {
    display: "block",
    fontSize: 22,
    marginBottom: 6,
    fontWeight: 700,
  },
  modeCardLabel: {
    margin: 0,
    fontWeight: 700,
    fontSize: 13,
  },
  modeCardDesc: {
    margin: "4px 0 0",
    fontSize: 10,
    color: "#64748b",
    lineHeight: 1.3,
  },

  lineItems: {
    display: "grid",
    gap: 8,
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(2, 6, 23, 0.4)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
  },
  lineItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    color: "#cbd5e1",
  },
  lineItemName: { color: "#e2e8f0" },
  lineItemQty: { color: "#64748b", fontWeight: 700 },
  lineItemPrice: { color: "#94a3b8", fontWeight: 600, fontSize: 12 },
  costSummary: {
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(2, 6, 23, 0.5)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    display: "grid",
    gap: 10,
  },
  costRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    color: "#cbd5e1",
    padding: "4px 0",
  },
  costTotal: {
    borderTop: "1px solid rgba(148, 163, 184, 0.14)",
    paddingTop: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#f8fafc",
  },
  costEquivalent: {
    margin: 0,
    fontSize: 12,
    color: "#475569",
    textAlign: "right",
  },
  costWarning: {
    margin: 0,
    fontSize: 12,
    color: "#f87171",
    padding: "8px 12px",
    borderRadius: 10,
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.2)",
  },
  escrowNote: {
    margin: 0,
    fontSize: 12,
    color: "#f9a8d4",
    lineHeight: 1.5,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(236, 72, 153, 0.08)",
    border: "1px solid rgba(236, 72, 153, 0.25)",
  },

  hybridInput: {
    display: "grid",
    gap: 8,
  },
  hybridLabel: {
    fontSize: 13,
    color: "#94a3b8",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hybridMax: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 700,
  },
  hybridNumberInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "#e2e8f0",
    fontSize: 15,
    boxSizing: "border-box",
    outline: "none",
  },

  fieldGroup: {
    display: "grid",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 600,
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "#e2e8f0",
    fontSize: 14,
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },

  errorBox: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#fca5a5",
    fontSize: 14,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  confirmBtn: {
    width: "100%",
    padding: "16px 20px",
    borderRadius: 16,
    border: "none",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: 0.5,
    transition: "opacity 0.2s",
  },
  loadingText: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  spinner: {
    display: "inline-block",
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  earnNote: {
    margin: 0,
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
  },

  // Success state
  successBox: {
    display: "grid",
    gap: 18,
    placeItems: "center",
    padding: "28px 24px",
    borderRadius: 24,
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    textAlign: "center",
  },
  successIconRing: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #10b981, #34d399)",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 0 0 8px rgba(16, 185, 129, 0.15)",
  },
  successIcon: {
    fontSize: 28,
    color: "#fff",
    fontWeight: 800,
  },
  successTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#34d399",
  },
  successDetails: {
    width: "100%",
    display: "grid",
    gap: 10,
    textAlign: "left",
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(2, 6, 23, 0.5)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  successRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    color: "#cbd5e1",
  },
  successLabel: {
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  successValue: {
    color: "#f8fafc",
  },
  successHash: {
    display: "grid",
    gap: 6,
    paddingTop: 10,
    borderTop: "1px solid rgba(148, 163, 184, 0.1)",
  },
  hashCode: {
    display: "block",
    padding: "8px 12px",
    borderRadius: 10,
    background: "rgba(2, 6, 23, 0.7)",
    color: "#7dd3fc",
    fontSize: 11,
    wordBreak: "break-all",
    border: "1px solid rgba(125, 211, 252, 0.14)",
  },
  successNote: {
    margin: 0,
    fontSize: 14,
    color: "#34d399",
  },
  resetBtn: {
    padding: "12px 24px",
    borderRadius: 14,
    border: "1px solid rgba(52, 211, 153, 0.3)",
    background: "rgba(16, 185, 129, 0.12)",
    color: "#34d399",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  metamaskNotice: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.25)",
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: 600,
  },
  metamaskConnectInline: {
    marginLeft: "auto",
    padding: "6px 14px",
    borderRadius: 10,
    border: "1px solid rgba(245,158,11,0.4)",
    background: "rgba(245,158,11,0.15)",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: "nowrap",
  },
};
