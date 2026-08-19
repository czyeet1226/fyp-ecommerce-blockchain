import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ORDER_STEPS,
  getOrderStageIndex,
} from "../dashboard/dashboardData";
import { css, LogItem, Section, SummaryItem } from "../dashboard/dashboardUi";
import { useWeb3 } from "../context/Web3Context";

const ESCROW_LABELS = {
  funded: "In escrow",
  released: "Released to seller",
  refunded: "Refunded to you",
  disputed: "Under dispute",
};
const ESCROW_COLORS = {
  funded: "#ec4899",
  released: "#34d399",
  refunded: "#fbbf24",
  disputed: "#f87171",
};

export default function TrackOrderPage({
  orders,
  ordersLoading,
  refreshOrders,
  fmt,
  orderEarnedElixir,
}) {
  const { isConnected, connectWallet, confirmDeliveryOnChain, raiseDisputeOnChain } =
    useWeb3();

  const [tab, setTab] = useState("ongoing"); // "ongoing" | "complete"
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState({}); // orderId -> { blockchainLog }
  const [detailLoading, setDetailLoading] = useState(false);
  const [escrowBusy, setEscrowBusy] = useState(null); // orderId being processed
  const [actionMsg, setActionMsg] = useState({ text: "", type: "" });

  function flash(text, type = "info") {
    setActionMsg({ text, type });
    if (type !== "error") setTimeout(() => setActionMsg({ text: "", type: "" }), 5000);
  }

  // Buyer confirms delivery → releases the escrowed ETH on-chain.
  async function handleConfirmDelivery(order) {
    if (!isConnected) {
      flash("Connect MetaMask to confirm delivery.", "error");
      return;
    }
    setEscrowBusy(order.id);
    try {
      flash("Confirm the release in MetaMask…", "info");
      const txHash = await confirmDeliveryOnChain(order.escrowId);
      await axios.post("/api/escrow/confirm", { orderId: order.id, txHash });
      flash("Delivery confirmed — payment released and receipt minted.", "success");
      await refreshOrders?.();
    } catch (err) {
      flash(
        err?.response?.data?.message || err?.message || "Unable to confirm delivery.",
        "error",
      );
    } finally {
      setEscrowBusy(null);
    }
  }

  // Buyer raises a dispute on a funded escrow.
  async function handleDispute(order) {
    if (!isConnected) {
      flash("Connect MetaMask to raise a dispute.", "error");
      return;
    }
    setEscrowBusy(order.id);
    try {
      flash("Confirm the dispute in MetaMask…", "info");
      const txHash = await raiseDisputeOnChain(order.escrowId);
      await axios.post("/api/escrow/dispute", { orderId: order.id, txHash });
      flash("Dispute raised. The platform will review it.", "success");
      await refreshOrders?.();
    } catch (err) {
      flash(
        err?.response?.data?.message || err?.message || "Unable to raise dispute.",
        "error",
      );
    } finally {
      setEscrowBusy(null);
    }
  }

  // Pull the latest orders whenever the page opens so seller progress shows.
  useEffect(() => {
    refreshOrders?.();
  }, []); // eslint-disable-line

  const { ongoing, complete } = useMemo(() => {
    const on = [];
    const done = [];
    (orders || []).forEach((o) => {
      const stage = getOrderStageIndex(o);
      // An order is "finished" once it's been delivered, OR once its escrow
      // has reached a terminal state — released (paid out) or refunded (money
      // back to the buyer). A disputed/refunded order never reaches the
      // "Delivered" fulfillment stage, so it must be moved out of On-going
      // explicitly rather than relying on stage alone.
      const escrowFinished =
        o.escrowStatus === "refunded" || o.escrowStatus === "released";
      const finished =
        stage >= ORDER_STEPS.length - 1 ||
        escrowFinished ||
        o.status === "cancelled";
      if (finished) done.push(o);
      else on.push(o);
    });
    return { ongoing: on, complete: done };
  }, [orders]);

  const list = tab === "ongoing" ? ongoing : complete;

  async function toggleExpand(order) {
    if (expandedId === order.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(order.id);
    // Fetch the blockchain audit log lazily (once per order).
    if (!detail[order.id]) {
      setDetailLoading(true);
      try {
        const res = await axios.get(`/api/orders/${order.id}`);
        setDetail((cur) => ({
          ...cur,
          [order.id]: { blockchainLog: res.data.blockchainLog || null },
        }));
      } catch {
        setDetail((cur) => ({ ...cur, [order.id]: { blockchainLog: null } }));
      } finally {
        setDetailLoading(false);
      }
    }
  }

  return (
    <Section label="Track Order" title="Your Orders & Delivery Progress">
      {/* Tabs + refresh */}
      <div style={t.tabBar}>
        <div style={t.tabs}>
          <button
            style={{ ...t.tab, ...(tab === "ongoing" ? t.tabActive : {}) }}
            onClick={() => setTab("ongoing")}
          >
            🚚 On-going
            <span style={t.tabCount}>{ongoing.length}</span>
          </button>
          <button
            style={{ ...t.tab, ...(tab === "complete" ? t.tabActive : {}) }}
            onClick={() => setTab("complete")}
          >
            ✓ Completed
            <span style={t.tabCount}>{complete.length}</span>
          </button>
        </div>
        <button
          style={t.refreshBtn}
          onClick={() => refreshOrders?.()}
          disabled={ordersLoading}
        >
          {ordersLoading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {actionMsg.text && (
        <div
          style={{
            ...t.banner,
            color:
              actionMsg.type === "success"
                ? "#34d399"
                : actionMsg.type === "error"
                ? "#fca5a5"
                : "#7dd3fc",
            background:
              actionMsg.type === "success"
                ? "rgba(16,185,129,0.1)"
                : actionMsg.type === "error"
                ? "rgba(239,68,68,0.1)"
                : "rgba(56,189,248,0.1)",
            borderColor:
              actionMsg.type === "success"
                ? "rgba(52,211,153,0.3)"
                : actionMsg.type === "error"
                ? "rgba(248,113,113,0.3)"
                : "rgba(125,211,252,0.3)",
          }}
        >
          {actionMsg.text}
        </div>
      )}

      {ordersLoading && (orders || []).length === 0 ? (
        <div style={css.loadingInline}>
          <div style={css.loadingSpinnerSm} />
          <span>Loading orders…</span>
        </div>
      ) : list.length === 0 ? (
        <div style={css.emptyState}>
          <span style={css.emptyIcon}>{tab === "ongoing" ? "📦" : "✅"}</span>
          <p style={css.emptyTitle}>
            {tab === "ongoing"
              ? "No orders in progress"
              : "No completed orders yet"}
          </p>
          <p style={css.muted}>
            {tab === "ongoing"
              ? "Orders you place will appear here while they're being delivered."
              : "Delivered orders will move here once the seller marks them complete."}
          </p>
        </div>
      ) : (
        <div style={t.rows}>
          {list.map((order) => {
            const stage = getOrderStageIndex(order);
            const expanded = expandedId === order.id;
            const isRefunded = order.escrowStatus === "refunded";
            const isCancelled = order.status === "cancelled" && !isRefunded;
            const stageLabel = isRefunded
              ? "Refunded"
              : isCancelled
              ? "Cancelled"
              : ORDER_STEPS[Math.max(0, stage)] || ORDER_STEPS[0];
            const delivered =
              stage >= ORDER_STEPS.length - 1 ||
              order.escrowStatus === "released";
            const log = detail[order.id]?.blockchainLog;
            const orderItems = order.items || [];
            const orderTitle =
              orderItems.length > 1
                ? `${orderItems.length} products`
                : orderItems[0]?.productName ||
                  orderItems[0]?.product?.name ||
                  order.product?.name ||
                  "Order";

            return (
              <div key={order.id} style={t.row}>
                {/* Row header */}
                <button style={t.rowHead} onClick={() => toggleExpand(order)}>
                  <div style={t.rowLeft}>
                    <div style={t.rowIcon}>
                      {(orderTitle || "O")[0].toUpperCase()}
                    </div>
                    <div style={t.rowInfo}>
                      <p style={t.rowName}>{orderTitle}</p>
                      <p style={t.rowMeta}>
                        {order.paymentMode || "—"} · qty {order.quantity || 1} ·{" "}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div style={t.rowRight}>
                    <span
                      style={{
                        ...t.stageBadge,
                        color: isRefunded || isCancelled
                          ? "#fbbf24"
                          : delivered
                          ? "#34d399"
                          : "#fbbf24",
                        background: isRefunded || isCancelled
                          ? "rgba(251,191,36,0.12)"
                          : delivered
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(251,191,36,0.12)",
                        borderColor: isRefunded || isCancelled
                          ? "rgba(251,191,36,0.3)"
                          : delivered
                          ? "rgba(52,211,153,0.3)"
                          : "rgba(251,191,36,0.3)",
                      }}
                    >
                      {delivered && !isRefunded && !isCancelled ? "✓ " : ""}
                      {stageLabel}
                    </span>
                    <span style={t.chevron}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div style={t.rowBody}>
                    {/* Progress timeline (horizontal) */}
                    <div style={t.steps}>
                      {ORDER_STEPS.map((step, idx) => {
                        const done = idx <= stage;
                        return (
                          <React.Fragment key={step}>
                            <div style={t.stepItem}>
                              <div
                                style={{
                                  ...t.stepDot,
                                  background: done
                                    ? "linear-gradient(135deg,#38bdf8,#818cf8)"
                                    : "rgba(100,116,139,0.3)",
                                  borderColor: done
                                    ? "transparent"
                                    : "rgba(100,116,139,0.4)",
                                  color: done ? "#04101f" : "#64748b",
                                }}
                              >
                                {done ? "✓" : idx + 1}
                              </div>
                              <span
                                style={{
                                  ...t.stepLabel,
                                  color: done ? "#e2e8f0" : "#64748b",
                                }}
                              >
                                {step}
                              </span>
                            </div>
                            {idx < ORDER_STEPS.length - 1 && (
                              <div
                                style={{
                                  ...t.stepLine,
                                  background:
                                    idx < stage
                                      ? "rgba(56,189,248,0.5)"
                                      : "rgba(100,116,139,0.2)",
                                }}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Order summary */}
                    <div style={css.summaryGrid}>
                      <SummaryItem label="Order ID" value={order.id} />
                      <SummaryItem
                        label="Seller"
                        value={order.merchant?.name || "—"}
                      />
                      <SummaryItem
                        label="Payment Mode"
                        value={order.paymentMode || "—"}
                      />
                      <SummaryItem
                        label="Quantity"
                        value={String(order.quantity || 1)}
                      />
                      <SummaryItem
                        label="Total"
                        value={`${fmt(
                          order.totalPriceEth || order.product?.priceEth,
                          6,
                        )} ETH`}
                      />
                      <SummaryItem
                        label="Delivery"
                        value={order.deliveryAddress || "No address"}
                      />
                    </div>

                    {orderItems.length > 0 && (
                      <div style={t.itemsBox}>
                        <p style={css.txLabel}>Items ({order.quantity})</p>
                        {orderItems.map((it) => (
                          <div key={it.id} style={t.itemLine}>
                            <span>
                              {it.productName || it.product?.name || "Item"}{" "}
                              <span style={{ color: "#64748b" }}>
                                × {it.quantity}
                              </span>
                            </span>
                            <span style={{ color: "#94a3b8" }}>
                              {(Number(it.unitPriceEth || 0) * it.quantity).toFixed(
                                6,
                              )}{" "}
                              ETH
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={css.txBox}>
                      <span style={css.txLabel}>Transaction Hash</span>
                      <code style={css.txCode}>
                        {order.txHash || "Off-chain (RM)"}
                      </code>
                    </div>

                    <div style={css.elixirEarned}>
                      <span>🎁 Elixir Earned</span>
                      <strong style={{ color: "#38bdf8" }}>
                        {fmt(orderEarnedElixir(order), 0)} ✦
                      </strong>
                    </div>

                    {/* Escrow panel (ETH or Elixir escrow orders) */}
                    {order.escrowStatus &&
                      order.escrowStatus !== "none" && (
                      <div style={t.escrowPanel}>
                        <div style={t.escrowHead}>
                          <span style={t.escrowTitle}>🛡 Escrow Protection</span>
                          <span
                            style={{
                              ...t.escrowStatus,
                              color: ESCROW_COLORS[order.escrowStatus] || "#94a3b8",
                              borderColor: `${ESCROW_COLORS[order.escrowStatus] || "#94a3b8"}55`,
                              background: `${ESCROW_COLORS[order.escrowStatus] || "#94a3b8"}14`,
                            }}
                          >
                            {ESCROW_LABELS[order.escrowStatus] || order.escrowStatus}
                          </span>
                        </div>

                        {order.escrowStatus === "funded" && (
                          <>
                            <p style={t.escrowText}>
                              Your payment is locked in the escrow contract. Once
                              you've received the item, confirm delivery to release
                              the funds to the seller — you'll earn your Elixir
                              rewards and an NFT receipt. If something's wrong,
                              raise a dispute instead.
                            </p>
                            {!isConnected ? (
                              <button style={t.escrowConnect} onClick={connectWallet}>
                                🦊 Connect MetaMask to manage escrow
                              </button>
                            ) : (
                              <div style={t.escrowActions}>
                                <button
                                  style={{
                                    ...t.confirmBtn,
                                    opacity: escrowBusy === order.id ? 0.6 : 1,
                                  }}
                                  onClick={() => handleConfirmDelivery(order)}
                                  disabled={escrowBusy === order.id}
                                >
                                  {escrowBusy === order.id
                                    ? "Processing…"
                                    : "✓ Confirm Delivery & Release"}
                                </button>
                                <button
                                  style={{
                                    ...t.disputeBtn,
                                    opacity: escrowBusy === order.id ? 0.6 : 1,
                                  }}
                                  onClick={() => handleDispute(order)}
                                  disabled={escrowBusy === order.id}
                                >
                                  ⚠ Raise Dispute
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {order.escrowStatus === "disputed" && (
                          <p style={t.escrowText}>
                            You've disputed this order. The platform admin will
                            review it and either refund you or release the funds.
                          </p>
                        )}
                        {order.escrowStatus === "released" && (
                          <p style={t.escrowText}>
                            Funds released to the seller. Thanks for confirming!
                          </p>
                        )}
                        {order.escrowStatus === "refunded" && (
                          <p style={t.escrowText}>
                            This order was refunded to your wallet.
                          </p>
                        )}
                      </div>
                    )}

                    {/* NFT purchase receipt */}
                    {order.receiptTokenId && (
                      <div style={t.receiptPanel}>
                        <span style={t.receiptIcon}>🧾</span>
                        <div style={{ flex: 1 }}>
                          <p style={t.receiptTitle}>NFT Purchase Receipt</p>
                          <p style={t.receiptSub}>
                            Token #{order.receiptTokenId} · verifiable proof of
                            purchase in your wallet
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Blockchain audit log */}
                    <div style={t.logPanel}>
                      <p style={css.txLabel}>Blockchain Audit Log</p>
                      {detailLoading && !log ? (
                        <div style={css.loadingInline}>
                          <div style={css.loadingSpinnerSm} />
                          <span>Loading log…</span>
                        </div>
                      ) : log ? (
                        <div style={css.logCard}>
                          <LogItem label="Event" value={log.eventType} />
                          <LogItem
                            label="Buyer"
                            value={log.buyerAddress || "–"}
                          />
                          <LogItem
                            label="Seller"
                            value={log.sellerAddress || "–"}
                          />
                          <LogItem
                            label="Block #"
                            value={log.blockNumber || "–"}
                          />
                        </div>
                      ) : (
                        <p style={css.muted}>
                          No on-chain log for this order (RM orders settle
                          off-chain).
                        </p>
                      )}
                    </div>
                  </div>
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
  tabBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  tabs: { display: "flex", gap: 8 },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.15)",
    background: "rgba(15,23,42,0.6)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  tabActive: {
    background:
      "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(129,140,248,0.2))",
    color: "#f8fafc",
    borderColor: "rgba(125,211,252,0.4)",
  },
  tabCount: {
    fontSize: 11,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.15)",
    color: "#cbd5e1",
  },
  refreshBtn: {
    padding: "9px 14px",
    borderRadius: 12,
    border: "1px solid rgba(125,211,252,0.25)",
    background: "rgba(56,189,248,0.1)",
    color: "#7dd3fc",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  rows: { display: "grid", gap: 10 },
  row: {
    borderRadius: 16,
    background: "rgba(8, 15, 28, 0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    overflow: "hidden",
  },
  rowHead: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  rowLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(129,140,248,0.25))",
    border: "1px solid rgba(125,211,252,0.2)",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 16,
    color: "#7dd3fc",
    flexShrink: 0,
  },
  rowInfo: { minWidth: 0 },
  rowName: { margin: 0, fontSize: 15, fontWeight: 800, color: "#f1f5f9" },
  rowMeta: { margin: "3px 0 0", fontSize: 12, color: "#64748b" },
  rowRight: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  stageBadge: {
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  chevron: { fontSize: 10, color: "#64748b" },
  rowBody: {
    padding: "4px 18px 18px",
    borderTop: "1px solid rgba(148,163,184,0.08)",
    display: "grid",
    gap: 14,
  },
  steps: {
    display: "flex",
    alignItems: "center",
    overflowX: "auto",
    paddingTop: 16,
    paddingBottom: 4,
  },
  stepItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 62,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 800,
    border: "2px solid",
  },
  stepLabel: { fontSize: 10, fontWeight: 600, textAlign: "center" },
  stepLine: {
    flex: 1,
    height: 2,
    minWidth: 16,
    margin: "0 2px",
    marginTop: -18,
  },
  logPanel: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(148,163,184,0.08)",
    display: "grid",
    gap: 8,
  },
  itemsBox: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(148,163,184,0.08)",
    display: "grid",
    gap: 8,
  },
  itemLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    color: "#e2e8f0",
  },
  banner: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  escrowPanel: {
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(236,72,153,0.06)",
    border: "1px solid rgba(236,72,153,0.2)",
    display: "grid",
    gap: 12,
  },
  escrowHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  escrowTitle: { fontSize: 14, fontWeight: 800, color: "#f9a8d4" },
  escrowStatus: {
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
  },
  escrowText: { margin: 0, fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6 },
  escrowActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  confirmBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#04140d",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  disputeBtn: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(248,113,113,0.1)",
    color: "#fca5a5",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  escrowConnect: {
    padding: "11px 18px",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.4)",
    background: "rgba(245,158,11,0.12)",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    justifySelf: "start",
  },
  receiptPanel: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 16px",
    borderRadius: 12,
    background: "linear-gradient(135deg, rgba(129,140,248,0.1), rgba(56,189,248,0.08))",
    border: "1px solid rgba(129,140,248,0.25)",
  },
  receiptIcon: { fontSize: 26 },
  receiptTitle: { margin: 0, fontSize: 14, fontWeight: 800, color: "#c7d2fe" },
  receiptSub: { margin: "3px 0 0", fontSize: 12, color: "#94a3b8" },
};
