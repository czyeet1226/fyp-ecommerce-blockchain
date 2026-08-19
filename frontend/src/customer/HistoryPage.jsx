/**
 * frontend/src/pages/HistoryPage.jsx
 *
 * Unified transaction history: orders (purchases), swaps, transfers,
 * deposits and staking activity — all sourced from the database.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { css, Section, SummaryItem } from "../dashboard/dashboardUi";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "order", label: "Orders" },
  { key: "swap", label: "Swaps" },
  { key: "stake", label: "Staking" },
  { key: "transfer", label: "Transfers" },
];

// Map a raw record (order or wallet transaction) into a common display shape.
function buildFeed(orders, transactions, orderEarnedElixir, fmt) {
  const items = [];

  (orders || []).forEach((order) => {
    items.push({
      id: `order-${order.id}`,
      group: "order",
      icon: (order.product?.name || "O")[0].toUpperCase(),
      iconColor: "#38bdf8",
      title: order.product?.name || "Order",
      subtitle: `${order.paymentMode || "–"} · qty ${order.quantity || 1}`,
      date: order.createdAt,
      status: order.status || "pending",
      details: [
        { label: "Qty", value: `×${order.quantity || 1}` },
        {
          label: "Tx Hash",
          value: order.txHash ? `${order.txHash.slice(0, 14)}…` : "Pending",
        },
        {
          label: "Elixir Earned",
          value: `${fmt(orderEarnedElixir(order), 0)} ✦`,
        },
        { label: "Status", value: order.status || "pending" },
      ],
      onView: order.id,
    });
  });

  (transactions || []).forEach((tx) => {
    const type = tx.type;
    let group = "swap";
    let icon = "⇄";
    let iconColor = "#818cf8";
    let title = "Transaction";
    let subtitle = tx.note || "";

    if (type === "SWAP") {
      group = "swap";
      icon = "⇄";
      iconColor = "#818cf8";
      title = `Swap ${tx.fromCurrency} → ${tx.toCurrency}`;
      subtitle = `${fmt(tx.fromAmount, 4)} ${tx.fromCurrency} → ${fmt(
        tx.toAmount,
        4,
      )} ${tx.toCurrency}`;
    } else if (type === "TRANSFER_OUT") {
      group = "transfer";
      icon = "↗";
      iconColor = "#fb923c";
      title = "Elixir Sent";
      subtitle = `${fmt(tx.fromAmount, 2)} ✦ to ${
        tx.counterparty
          ? `${String(tx.counterparty).slice(0, 10)}…`
          : "recipient"
      }`;
    } else if (type === "TRANSFER_IN") {
      group = "transfer";
      icon = "↙";
      iconColor = "#34d399";
      title = "Elixir Received";
      subtitle = `${fmt(tx.toAmount, 2)} ✦ received`;
    } else if (type === "DEPOSIT") {
      group = "swap";
      icon = "＄";
      iconColor = "#10b981";
      title = "RM Deposit";
      subtitle = `+RM ${fmt(tx.toAmount, 2)}`;
    } else if (type === "STAKE") {
      group = "stake";
      icon = "🔒";
      iconColor = "#a78bfa";
      title = "Staked Elixir";
      subtitle = `${fmt(tx.fromAmount, 2)} ✦ · ${tx.note || ""}`;
    } else if (type === "UNSTAKE") {
      group = "stake";
      icon = "🔓";
      iconColor = "#34d399";
      title = "Unstaked Elixir";
      subtitle = `+${fmt(tx.toAmount, 2)} ✦ · ${tx.note || ""}`;
    }

    const details = [];
    if (tx.fromCurrency)
      details.push({
        label: "From",
        value: `${fmt(tx.fromAmount, 4)} ${tx.fromCurrency}`,
      });
    if (tx.toCurrency)
      details.push({
        label: "To",
        value: `${fmt(tx.toAmount, 4)} ${tx.toCurrency}`,
      });
    if (tx.txHash)
      details.push({ label: "Tx Hash", value: `${tx.txHash.slice(0, 14)}…` });
    if (tx.counterparty)
      details.push({
        label: "Counterparty",
        value:
          String(tx.counterparty).length > 16
            ? `${String(tx.counterparty).slice(0, 12)}…`
            : tx.counterparty,
      });

    items.push({
      id: `tx-${tx.id}`,
      group,
      icon,
      iconColor,
      title,
      subtitle,
      date: tx.createdAt,
      status: tx.status || "completed",
      details,
      onView: null,
    });
  });

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

export default function HistoryPage({
  orders,
  ordersLoading,
  transactions,
  transactionsLoading,
  fmt,
  orderEarnedElixir,
  setSelectedOrderId,
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const feed = useMemo(
    () => buildFeed(orders, transactions, orderEarnedElixir, fmt),
    [orders, transactions, orderEarnedElixir, fmt],
  );

  const visible = feed.filter((item) =>
    filter === "all" ? true : item.group === filter,
  );

  const loading = ordersLoading || transactionsLoading;

  return (
    <Section label="History" title="Purchases, Swaps, Staking & Transfers">
      {/* Filter tabs */}
      <div style={css.catRow}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            style={{
              ...css.catBtn,
              ...(filter === f.key ? css.catBtnActive : {}),
            }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={css.loadingInline}>
          <div style={css.loadingSpinnerSm} />
          <span>Loading history…</span>
        </div>
      ) : visible.length > 0 ? (
        <div style={css.historyList}>
          {visible.map((item) => (
            <article key={item.id} style={css.historyItem}>
              <div style={css.historyTop}>
                <div style={css.historyLeft}>
                  <div
                    style={{
                      ...css.historyIcon,
                      background: `${item.iconColor}22`,
                      color: item.iconColor,
                      borderColor: `${item.iconColor}33`,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h4 style={css.historyName}>{item.title}</h4>
                    <p style={css.historyMeta}>
                      {item.subtitle}
                      {item.date
                        ? ` · ${new Date(item.date).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div style={css.historyRight}>
                  <span
                    style={{
                      ...css.statusBadge,
                      background:
                        item.status === "completed"
                          ? "rgba(52,211,153,0.12)"
                          : item.status === "failed"
                          ? "rgba(248,113,113,0.12)"
                          : "rgba(251,191,36,0.12)",
                      color:
                        item.status === "completed"
                          ? "#34d399"
                          : item.status === "failed"
                          ? "#fca5a5"
                          : "#fbbf24",
                      borderColor:
                        item.status === "completed"
                          ? "rgba(52,211,153,0.3)"
                          : item.status === "failed"
                          ? "rgba(248,113,113,0.3)"
                          : "rgba(251,191,36,0.3)",
                    }}
                  >
                    {item.status}
                  </span>
                  {item.onView && (
                    <button
                      style={css.viewBtn}
                      onClick={() => {
                        setSelectedOrderId(item.onView);
                        navigate("/track-order");
                      }}
                    >
                      View →
                    </button>
                  )}
                </div>
              </div>

              {item.details.length > 0 && (
                <div style={css.summaryGrid}>
                  {item.details.map((d, i) => (
                    <SummaryItem key={i} label={d.label} value={d.value} />
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div style={css.emptyState}>
          <span style={css.emptyIcon}>🧾</span>
          <p style={css.emptyTitle}>No activity yet</p>
          <p style={css.muted}>
            Purchases, swaps, staking and transfers will appear here.
          </p>
          <button style={css.shopNowBtn} onClick={() => navigate("/shop")}>
            Shop Now →
          </button>
        </div>
      )}
    </Section>
  );
}
