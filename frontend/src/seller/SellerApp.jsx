/**
 * frontend/src/seller/SellerApp.jsx
 *
 * Seller (merchant) interface with three sections:
 *   1. Create Product     — upload / edit products, view own catalog
 *   2. Track Purchase Order — see buyer orders, update delivery progress
 *   3. Revenue            — revenue totals and per-product statistics
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ORDER_STEPS, LIVE_RM_PER_ETH } from "../dashboard/dashboardData";
import { useWeb3 } from "../context/Web3Context";

const CATEGORIES = ["hot selling", "clothes", "toys", "foods", "electronics"];

const NAV = [
  { id: "create", label: "Create Product", icon: "🧺" },
  { id: "orders", label: "Track Purchase Order", icon: "📦" },
  { id: "revenue", label: "Revenue", icon: "💰" },
  { id: "payments", label: "Payments", icon: "💳" },
];

const PLAN_COLOR = {
  starter: "#38bdf8",
  pro: "#a78bfa",
  enterprise: "#f59e0b",
};

const fmt = (v, d = 2) => {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: d })
    : "0";
};

const emptyForm = {
  id: null,
  name: "",
  category: "clothes",
  priceMyr: "",
  stock: "",
  description: "",
  imageUrl: "",
};

export default function SellerApp({ user, logout }) {
  const [view, setView] = useState("create");
  const [message, setMessage] = useState({ text: "", type: "" });

  const {
    account,
    ethBalance,
    isConnected,
    connecting,
    connectWallet,
    sendEth,
  } = useWeb3();

  // The address that customer payments settle to: the connected MetaMask
  // this session, or a wallet previously linked to this account.
  const payoutAddress = account || user?.metamaskAddress || null;

  // Products
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Revenue
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Subscription
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subBusy, setSubBusy] = useState(false);

  useEffect(() => {
    loadProducts();
    loadSubscription();
  }, []);

  useEffect(() => {
    if (view === "orders") loadOrders();
    if (view === "revenue") loadRevenue();
    if (view === "payments") loadSubscription();
  }, [view]);

  function showMsg(text, type = "info") {
    setMessage({ text, type });
    if (type !== "error") {
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
    }
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const res = await axios.get("/api/products/mine");
      setProducts(res.data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await axios.get("/api/orders/merchant");
      setOrders(res.data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadRevenue() {
    setStatsLoading(true);
    try {
      const res = await axios.get("/api/orders/merchant/revenue");
      setStats(res.data.stats);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadSubscription() {
    setSubLoading(true);
    try {
      const res = await axios.get("/api/subscription/me");
      setSubscription(res.data.subscription);
    } catch {
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  }

  // Queue a plan change — it takes effect at the next billing cycle.
  async function changePlan(planKey) {
    setSubBusy(true);
    try {
      const res = await axios.post("/api/subscription/change", { plan: planKey });
      setSubscription(res.data.subscription);
      showMsg(res.data.message || "Plan change queued.", "success");
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to change plan.",
        "error",
      );
    } finally {
      setSubBusy(false);
    }
  }

  // Pay the monthly subscription fee via MetaMask (ETH → platform), which also
  // applies any pending plan change and advances the billing cycle.
  async function paySubscription() {
    if (!subscription) return;
    if (!isConnected) {
      showMsg("Connect MetaMask to pay your subscription.", "error");
      return;
    }
    const platform = subscription.platformAddress;
    if (!platform) {
      showMsg("Platform address unavailable. Try again shortly.", "error");
      return;
    }
    // The plan being billed is the pending change if any, else the current plan.
    const effectiveKey = subscription.pendingPlan || subscription.plan;
    const effective = (subscription.plans || []).find((p) => p.key === effectiveKey);
    const price = effective ? effective.priceEth : subscription.priceEth;

    setSubBusy(true);
    try {
      showMsg("Confirm the subscription payment in MetaMask…", "info");
      const txHash = await sendEth(platform, price);
      const res = await axios.post("/api/subscription/pay", { txHash });
      setSubscription(res.data.subscription);
      showMsg(res.data.message || "Subscription paid.", "success");
      await loadProducts(); // limits may have changed
    } catch (err) {
      showMsg(
        err?.response?.data?.message ||
          err?.message ||
          "Subscription payment failed.",
        "error",
      );
    } finally {
      setSubBusy(false);
    }
  }

  // ── Product create / edit ───────────────────────────────────────────────

  const updateField = (field) => (e) =>
    setForm((cur) => ({ ...cur, [field]: e.target.value }));

  const derivedEth = useMemo(() => {
    const rm = Number(form.priceMyr || 0);
    return rm > 0 ? rm / LIVE_RM_PER_ETH : 0;
  }, [form.priceMyr]);

  function startEdit(p) {
    setForm({
      id: p.id,
      name: p.name || "",
      category: p.category || "clothes",
      priceMyr: p.priceMyr
        ? String(p.priceMyr)
        : String((Number(p.priceEth || 0) * LIVE_RM_PER_ETH).toFixed(2)),
      stock: String(p.stock ?? ""),
      description: p.description || "",
      imageUrl: p.imageUrl || "",
    });
    setView("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showMsg("Product name is required.", "error");
      return;
    }
    const rm = Number(form.priceMyr);
    if (!Number.isFinite(rm) || rm <= 0) {
      showMsg("Enter a valid RM price.", "error");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      priceMyr: Number(rm.toFixed(2)),
      priceEth: Number((rm / LIVE_RM_PER_ETH).toFixed(8)),
      stock: parseInt(form.stock || "0", 10) || 0,
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
    };

    setSaving(true);
    try {
      if (form.id) {
        await axios.put(`/api/products/${form.id}`, payload);
        showMsg("Product updated successfully.", "success");
      } else {
        await axios.post("/api/products", payload);
        showMsg("Product created successfully.", "success");
      }
      resetForm();
      await loadProducts();
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to save the product.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    try {
      if (p.isActive) {
        await axios.delete(`/api/products/${p.id}`);
        showMsg(`"${p.name}" has been deactivated.`, "success");
      } else {
        await axios.put(`/api/products/${p.id}`, { isActive: true });
        showMsg(`"${p.name}" is live again.`, "success");
      }
      await loadProducts();
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to update the product.",
        "error",
      );
    }
  }

  // ── Order fulfillment ─────────────────────────────────────────────────────

  async function setStage(order, stage) {
    setUpdatingId(order.id);
    try {
      await axios.put(`/api/orders/${order.id}/fulfillment`, { stage });
      setOrders((cur) =>
        cur.map((o) =>
          o.id === order.id ? { ...o, fulfillmentStage: stage } : o,
        ),
      );
      showMsg("Delivery progress updated.", "success");
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to update progress.",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brandBlock}>
          <div style={s.brandMark}>🏪</div>
          <div>
            <p style={s.brandKicker}>Seller Portal</p>
            <h1 style={s.brandTitle}>Elixir Commerce</h1>
          </div>
        </div>

        <nav style={s.nav}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => setView(n.id)}
              >
                <span style={s.navIcon}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </nav>

        <div style={s.storeCard}>
          <p style={s.storeLabel}>Your Store</p>
          <p style={s.storeName}>{user?.name || "Seller"}</p>
          <p style={s.storeMeta}>{products.length} product(s) listed</p>
        </div>

        {/* Payments wallet */}
        <div style={s.walletCard}>
          <p style={s.storeLabel}>Payments Wallet</p>
          {payoutAddress ? (
            <>
              <div style={s.walletRow}>
                <span style={s.walletDot} />
                <span style={s.walletAddr}>
                  {payoutAddress.slice(0, 6)}…{payoutAddress.slice(-4)}
                </span>
              </div>
              {isConnected ? (
                <p style={s.walletBalance}>
                  {Number(ethBalance || 0).toFixed(4)} ETH
                </p>
              ) : (
                <button
                  style={s.walletConnectBtn}
                  onClick={connectWallet}
                  disabled={connecting}
                >
                  {connecting ? "Connecting…" : "Connect to view balance"}
                </button>
              )}
            </>
          ) : (
            <button
              style={s.walletConnectBtn}
              onClick={connectWallet}
              disabled={connecting}
            >
              🦊 {connecting ? "Connecting…" : "Connect MetaMask"}
            </button>
          )}
        </div>

        <button style={s.logoutBtn} onClick={logout}>
          ⎋ Sign Out
        </button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <p style={s.headerKicker}>Seller Dashboard</p>
            <h2 style={s.headerTitle}>
              {NAV.find((n) => n.id === view)?.label}
            </h2>
          </div>
          <div style={s.profileChip}>
            <div style={s.profileAvatar}>
              {(user?.name || "S")[0].toUpperCase()}
            </div>
            <div>
              <p style={s.chipRole}>merchant</p>
              <p style={s.chipAddress}>{user?.userCode || "—"}</p>
            </div>
          </div>
        </header>

        {message.text && (
          <div
            style={{
              ...s.toast,
              background:
                message.type === "success"
                  ? "rgba(16,185,129,0.12)"
                  : message.type === "error"
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(56,189,248,0.12)",
              borderColor:
                message.type === "success"
                  ? "rgba(52,211,153,0.3)"
                  : message.type === "error"
                  ? "rgba(248,113,113,0.3)"
                  : "rgba(125,211,252,0.3)",
              color:
                message.type === "success"
                  ? "#34d399"
                  : message.type === "error"
                  ? "#fca5a5"
                  : "#7dd3fc",
            }}
          >
            {message.type === "success" ? "✓" : message.type === "error" ? "⚠" : "ℹ"}{" "}
            {message.text}
          </div>
        )}

        {!payoutAddress && (
          <div style={s.walletBanner}>
            <span style={{ fontSize: 18 }}>🦊</span>
            <div style={{ flex: 1 }}>
              <p style={s.walletBannerTitle}>
                Connect MetaMask to receive payments
              </p>
              <p style={s.walletBannerText}>
                Customer payments (ETH) settle directly to your connected
                MetaMask wallet. Connect one so your sales reach you.
              </p>
            </div>
            <button
              style={s.walletBannerBtn}
              onClick={connectWallet}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}

        {view === "create" && (
          <CreateProductView
            form={form}
            updateField={updateField}
            derivedEth={derivedEth}
            saving={saving}
            handleSubmit={handleSubmit}
            resetForm={resetForm}
            products={products}
            productsLoading={productsLoading}
            startEdit={startEdit}
            toggleActive={toggleActive}
          />
        )}

        {view === "orders" && (
          <OrdersView
            orders={orders}
            ordersLoading={ordersLoading}
            setStage={setStage}
            updatingId={updatingId}
            shortAddr={shortAddr}
          />
        )}

        {view === "revenue" && (
          <RevenueView stats={stats} statsLoading={statsLoading} />
        )}

        {view === "payments" && (
          <PaymentsView
            subscription={subscription}
            subLoading={subLoading}
            subBusy={subBusy}
            changePlan={changePlan}
            paySubscription={paySubscription}
            isConnected={isConnected}
            connectWallet={connectWallet}
          />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// View 1 — Create Product
// ═══════════════════════════════════════════════════════════════════════════

function CreateProductView({
  form,
  updateField,
  derivedEth,
  saving,
  handleSubmit,
  resetForm,
  products,
  productsLoading,
  startEdit,
  toggleActive,
}) {
  return (
    <>
      <section style={s.card}>
        <h3 style={s.cardTitle}>
          {form.id ? "✎ Edit Product" : "＋ New Product"}
        </h3>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={s.label}>Product Name</label>
              <input
                style={s.input}
                value={form.name}
                onChange={updateField("name")}
                placeholder="e.g. Aurora Hoodie"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Category</label>
              <select
                style={s.input}
                value={form.category}
                onChange={updateField("category")}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Price (RM)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                style={s.input}
                value={form.priceMyr}
                onChange={updateField("priceMyr")}
                placeholder="0.00"
              />
              <span style={s.hint}>≈ {derivedEth.toFixed(6)} ETH</span>
            </div>
            <div style={s.field}>
              <label style={s.label}>Stock</label>
              <input
                type="number"
                min="0"
                step="1"
                style={s.input}
                value={form.stock}
                onChange={updateField("stock")}
                placeholder="0"
              />
            </div>
            <div style={{ ...s.field, gridColumn: "1 / -1" }}>
              <label style={s.label}>Image URL (optional)</label>
              <input
                style={s.input}
                value={form.imageUrl}
                onChange={updateField("imageUrl")}
                placeholder="https://…"
              />
            </div>
            <div style={{ ...s.field, gridColumn: "1 / -1" }}>
              <label style={s.label}>Description</label>
              <textarea
                style={{ ...s.input, minHeight: 80, resize: "vertical" }}
                value={form.description}
                onChange={updateField("description")}
                placeholder="Describe your product…"
              />
            </div>
          </div>

          <div style={s.formActions}>
            <button
              type="submit"
              style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : form.id
                ? "💾 Update Product"
                : "＋ Create Product"}
            </button>
            {form.id && (
              <button type="button" style={s.ghostBtn} onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={s.card}>
        <h3 style={s.cardTitle}>Your Products ({products.length})</h3>
        {productsLoading ? (
          <Loading label="Loading products…" />
        ) : products.length === 0 ? (
          <p style={s.muted}>
            No products yet. Create your first product above.
          </p>
        ) : (
          <div style={s.productGrid}>
            {products.map((p) => {
              const rm =
                p.priceMyr ||
                (Number(p.priceEth || 0) * LIVE_RM_PER_ETH).toFixed(2);
              return (
                <div
                  key={p.id}
                  style={{
                    ...s.productCard,
                    opacity: p.isActive ? 1 : 0.55,
                  }}
                >
                  <div style={s.productTop}>
                    <span style={s.categoryPill}>{p.category}</span>
                    <span
                      style={{
                        ...s.statusPill,
                        color: p.isActive ? "#34d399" : "#f87171",
                        borderColor: p.isActive
                          ? "rgba(52,211,153,0.3)"
                          : "rgba(248,113,113,0.3)",
                        background: p.isActive
                          ? "rgba(16,185,129,0.1)"
                          : "rgba(239,68,68,0.1)",
                      }}
                    >
                      {p.isActive ? "Live" : "Hidden"}
                    </span>
                  </div>
                  <h4 style={s.productName}>{p.name}</h4>
                  <p style={s.productDesc}>
                    {p.description || "No description."}
                  </p>
                  <div style={s.priceRow}>
                    <span style={s.priceRm}>RM {rm}</span>
                    <span style={s.priceEth}>
                      {Number(p.priceEth || 0).toFixed(4)} ETH
                    </span>
                  </div>
                  <div style={s.stockRow}>
                    <span style={s.muted}>
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <div style={s.cardActions}>
                    <button style={s.editBtn} onClick={() => startEdit(p)}>
                      ✎ Edit
                    </button>
                    <button
                      style={p.isActive ? s.deactivateBtn : s.reactivateBtn}
                      onClick={() => toggleActive(p)}
                    >
                      {p.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// View 2 — Track Purchase Order
// ═══════════════════════════════════════════════════════════════════════════

function OrdersView({ orders, ordersLoading, setStage, updatingId, shortAddr }) {
  if (ordersLoading) return <Loading label="Loading purchase orders…" />;

  if (orders.length === 0) {
    return (
      <section style={s.card}>
        <div style={s.emptyState}>
          <span style={{ fontSize: 42 }}>📭</span>
          <p style={s.emptyTitle}>No purchase orders yet</p>
          <p style={s.muted}>Orders from customers will appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {orders.map((o) => {
        const stage = Number(o.fulfillmentStage || 0);
        const busy = updatingId === o.id;
        return (
          <section key={o.id} style={s.card}>
            <div style={s.orderTop}>
              <div>
                <h4 style={s.orderProduct}>
                  {o.items && o.items.length > 0
                    ? o.items.length === 1
                      ? o.items[0].productName || o.items[0].product?.name
                      : `${o.items.length} products`
                    : o.product?.name || "Product"}
                  <span style={s.orderQty}> · {o.quantity || 1} item(s)</span>
                </h4>
                {o.items && o.items.length > 1 && (
                  <p style={s.orderMeta}>
                    {o.items
                      .map(
                        (it) =>
                          `${it.productName || it.product?.name || "Item"} ×${it.quantity}`,
                      )
                      .join(", ")}
                  </p>
                )}
                <p style={s.orderMeta}>
                  Buyer: {o.customer?.name || "—"}
                  {o.customer?.walletAddress
                    ? ` · ${shortAddr(o.customer.walletAddress)}`
                    : ""}
                </p>
                <p style={s.orderMeta}>
                  {o.paymentMode || "—"} ·{" "}
                  {Number(o.totalPriceEth || 0).toFixed(4)} ETH ·{" "}
                  {new Date(o.createdAt).toLocaleDateString()}
                </p>
                {o.deliveryAddress && (
                  <p style={s.orderMeta}>📍 {o.deliveryAddress}</p>
                )}
              </div>
              <span
                style={{
                  ...s.stageBadge,
                  color: stage === 4 ? "#34d399" : "#fbbf24",
                  borderColor:
                    stage === 4
                      ? "rgba(52,211,153,0.3)"
                      : "rgba(251,191,36,0.3)",
                  background:
                    stage === 4
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(251,191,36,0.1)",
                }}
              >
                {ORDER_STEPS[stage]}
              </span>
            </div>

            {/* Progress timeline */}
            <div style={s.stepsRow}>
              {ORDER_STEPS.map((step, idx) => {
                const done = idx <= stage;
                return (
                  <React.Fragment key={step}>
                    <div style={s.stepItem}>
                      <div
                        style={{
                          ...s.stepDot,
                          background: done
                            ? "linear-gradient(135deg, #10b981, #34d399)"
                            : "rgba(100,116,139,0.3)",
                          borderColor: done ? "transparent" : "rgba(100,116,139,0.4)",
                        }}
                      >
                        {done ? "✓" : idx + 1}
                      </div>
                      <span
                        style={{
                          ...s.stepLabel,
                          color: done ? "#e2e8f0" : "#64748b",
                        }}
                      >
                        {step}
                      </span>
                    </div>
                    {idx < ORDER_STEPS.length - 1 && (
                      <div
                        style={{
                          ...s.stepLine,
                          background: idx < stage
                            ? "rgba(52,211,153,0.5)"
                            : "rgba(100,116,139,0.2)",
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Controls */}
            <div style={s.orderControls}>
              <button
                style={{
                  ...s.advanceBtn,
                  opacity: busy || stage >= 4 ? 0.5 : 1,
                  cursor: busy || stage >= 4 ? "not-allowed" : "pointer",
                }}
                onClick={() => setStage(o, stage + 1)}
                disabled={busy || stage >= 4}
              >
                {stage >= 4 ? "✓ Delivered" : `Advance → ${ORDER_STEPS[stage + 1]}`}
              </button>
              <select
                style={s.stageSelect}
                value={stage}
                onChange={(e) => setStage(o, Number(e.target.value))}
                disabled={busy}
              >
                {ORDER_STEPS.map((step, idx) => (
                  <option key={step} value={idx}>
                    {idx}. {step}
                  </option>
                ))}
              </select>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// View 3 — Revenue
// ═══════════════════════════════════════════════════════════════════════════

function RevenueView({ stats, statsLoading }) {
  if (statsLoading) return <Loading label="Crunching revenue…" />;
  if (!stats) {
    return (
      <section style={s.card}>
        <p style={s.muted}>No revenue data available yet.</p>
      </section>
    );
  }

  return (
    <>
      <div style={s.statGrid}>
        <StatTile
          icon="💰"
          label="Total Revenue"
          value={`${fmt(stats.totalRevenueEth, 4)} ETH`}
          sub={`≈ RM ${fmt(stats.totalRevenueRm, 2)}`}
          color="#10b981"
        />
        <StatTile
          icon="🧾"
          label="Total Orders"
          value={fmt(stats.totalOrders, 0)}
          sub={`${fmt(stats.totalItemsSold, 0)} items sold`}
          color="#0ea5e9"
        />
        <StatTile
          icon="🚚"
          label="In Progress"
          value={fmt(stats.activeOrders, 0)}
          sub={`${fmt(stats.deliveredOrders, 0)} delivered`}
          color="#f59e0b"
        />
      </div>

      <section style={s.card}>
        <h3 style={s.cardTitle}>Product Performance</h3>
        {stats.productStats.length === 0 ? (
          <p style={s.muted}>No sales recorded yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Product</th>
                  <th style={s.th}>Category</th>
                  <th style={s.thRight}>Orders</th>
                  <th style={s.thRight}>Units Sold</th>
                  <th style={s.thRight}>Revenue (ETH)</th>
                  <th style={s.thRight}>Revenue (RM)</th>
                </tr>
              </thead>
              <tbody>
                {stats.productStats.map((p) => (
                  <tr key={p.productId} style={s.tr}>
                    <td style={s.td}>{p.name}</td>
                    <td style={s.tdMuted}>{p.category}</td>
                    <td style={s.tdRight}>{p.orders}</td>
                    <td style={s.tdRight}>{p.unitsSold}</td>
                    <td style={s.tdRight}>{fmt(p.revenueEth, 4)}</td>
                    <td style={s.tdRight}>RM {fmt(p.revenueRm, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={s.card}>
        <h3 style={s.cardTitle}>Delivery Pipeline</h3>
        <div style={s.pipelineRow}>
          {ORDER_STEPS.map((step, idx) => (
            <div key={step} style={s.pipelineItem}>
              <div style={s.pipelineCount}>{stats.stageCounts[idx] || 0}</div>
              <span style={s.pipelineLabel}>{step}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// View 4 — Payments (subscription plan)
// ────────────────────────────────────────────────────────────────────────────

function PaymentsView({
  subscription,
  subLoading,
  subBusy,
  changePlan,
  paySubscription,
  isConnected,
  connectWallet,
}) {
  if (subLoading && !subscription) return <Loading label="Loading your plan…" />;

  if (!subscription) {
    return (
      <section style={s.card}>
        <div style={s.emptyState}>
          <span style={{ fontSize: 42 }}>💳</span>
          <p style={s.emptyTitle}>Subscription unavailable</p>
          <p style={s.muted}>We couldn't load your plan. Try again shortly.</p>
        </div>
      </section>
    );
  }

  const {
    plan,
    planLabel,
    priceEth,
    productLimit,
    productCount,
    pendingPlan,
    pendingPlanLabel,
    planRenewsAt,
    dueNow,
    plans = [],
  } = subscription;

  const currentColor = PLAN_COLOR[plan] || "#38bdf8";
  const limitLabel = productLimit == null ? "Unlimited" : productLimit;
  const usagePct =
    productLimit == null
      ? 0
      : Math.min(100, Math.round((productCount / productLimit) * 100));
  const renewDate = planRenewsAt
    ? new Date(planRenewsAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  // The plan that the next payment will bill for.
  const effectiveKey = pendingPlan || plan;
  const effective = plans.find((p) => p.key === effectiveKey);
  const dueEth = effective ? effective.priceEth : priceEth;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Current plan summary */}
      <section style={{ ...s.card, borderColor: `${currentColor}44` }}>
        <div style={s.planHead}>
          <div>
            <p style={s.planKicker}>Current Plan</p>
            <h3 style={{ ...s.planName, color: currentColor }}>{planLabel}</h3>
            <p style={s.muted}>
              {fmt(priceEth, 4)} ETH billed monthly · renews {renewDate}
            </p>
          </div>
          <div style={{ ...s.planBadge, color: currentColor, borderColor: `${currentColor}55`, background: `${currentColor}14` }}>
            {plan}
          </div>
        </div>

        {/* Product usage */}
        <div style={s.usageBlock}>
          <div style={s.usageTop}>
            <span style={s.usageLabel}>Product listings</span>
            <span style={s.usageValue}>
              {productCount} / {limitLabel}
            </span>
          </div>
          {productLimit != null && (
            <div style={s.usageBarTrack}>
              <div
                style={{
                  ...s.usageBarFill,
                  width: `${usagePct}%`,
                  background: usagePct >= 100 ? "#f87171" : currentColor,
                }}
              />
            </div>
          )}
          {productLimit != null && productCount >= productLimit && (
            <p style={s.usageWarn}>
              You've reached your plan limit. Upgrade to list more products.
            </p>
          )}
        </div>

        {pendingPlan && (
          <div style={s.pendingNotice}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span>
              Scheduled change to <strong>{pendingPlanLabel}</strong> — applies
              on your next billing cycle ({renewDate}) once payment is made.
            </span>
          </div>
        )}
      </section>

      {/* Plan options */}
      <section style={s.card}>
        <h3 style={s.cardTitle}>Available Plans</h3>
        <p style={s.muted}>
          Switching plans takes effect on your next billing cycle — your current
          plan stays active until then.
        </p>
        <div style={s.planGrid}>
          {plans.map((p) => {
            const color = PLAN_COLOR[p.key] || "#38bdf8";
            const isCurrent = p.key === plan;
            const isPending = p.key === pendingPlan;
            return (
              <div
                key={p.key}
                style={{
                  ...s.planCard,
                  borderColor: isCurrent ? `${color}66` : "rgba(148,163,184,0.12)",
                  boxShadow: isCurrent ? `0 8px 30px ${color}22` : "none",
                }}
              >
                <div style={s.planCardTop}>
                  <span style={{ ...s.planDot, background: color }} />
                  <span style={s.planCardName}>{p.label}</span>
                </div>
                <p style={{ ...s.planPrice, color }}>
                  {fmt(p.priceEth, 4)} <span style={s.planPriceUnit}>ETH/mo</span>
                </p>
                <p style={s.planLimit}>
                  {p.productLimit == null
                    ? "Unlimited products"
                    : `Up to ${p.productLimit} products`}
                </p>
                {p.blurb && <p style={s.planBlurb}>{p.blurb}</p>}

                {isCurrent ? (
                  <div style={{ ...s.planTag, color, borderColor: `${color}55` }}>
                    ✓ Current plan
                  </div>
                ) : isPending ? (
                  <div style={{ ...s.planTag, color: "#fbbf24", borderColor: "rgba(251,191,36,0.4)" }}>
                    ⏳ Scheduled
                  </div>
                ) : (
                  <button
                    style={{ ...s.switchBtn, opacity: subBusy ? 0.6 : 1 }}
                    onClick={() => changePlan(p.key)}
                    disabled={subBusy}
                  >
                    Switch to {p.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Pay / renew */}
      <section style={s.card}>
        <h3 style={s.cardTitle}>Billing</h3>
        <div style={s.billRow}>
          <div>
            <p style={s.muted}>
              {pendingPlan ? "Next charge (new plan)" : "Next monthly charge"}
            </p>
            <p style={s.billAmount}>{fmt(dueEth, 4)} ETH</p>
            <p style={s.muted}>
              {dueNow
                ? "Payment is due now."
                : `Renews ${renewDate}. You can pay early to renew.`}
            </p>
          </div>
          {isConnected ? (
            <button
              style={{ ...s.payBtn, opacity: subBusy ? 0.6 : 1 }}
              onClick={paySubscription}
              disabled={subBusy}
            >
              {subBusy ? "Processing…" : pendingPlan ? "Pay & Apply Plan" : "Pay / Renew"}
            </button>
          ) : (
            <button style={s.payBtn} onClick={connectWallet}>
              🦊 Connect MetaMask to Pay
            </button>
          )}
        </div>
        <p style={s.billNote}>
          Payments settle in ETH from your connected MetaMask wallet to the
          platform. MetaMask cannot auto-debit, so each monthly renewal is
          confirmed by you here.
        </p>
      </section>
    </div>
  );
}

function StatTile({ icon, label, value, sub, color }) {
  return (
    <div
      style={{
        ...s.tile,
        borderColor: `${color}33`,
        boxShadow: `0 4px 24px ${color}18`,
      }}
    >
      <div style={{ ...s.tileIcon, background: `${color}20`, color }}>{icon}</div>
      <p style={s.tileLabel}>{label}</p>
      <p style={{ ...s.tileValue, color }}>{value}</p>
      <p style={s.tileSub}>{sub}</p>
    </div>
  );
}

function Loading({ label }) {
  return (
    <div style={s.loadingRow}>
      <div style={s.spinner} />
      <span>{label}</span>
    </div>
  );
}

// ── Styles (emerald seller theme) ───────────────────────────────────────────

const s = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "270px minmax(0, 1fr)",
    background: "linear-gradient(135deg, #06130d 0%, #0c1f18 50%, #0f2620 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  sidebar: {
    padding: 24,
    borderRight: "1px solid rgba(148,163,184,0.1)",
    background: "rgba(6,19,13,0.85)",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(148,163,184,0.08)",
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #10b981, #059669)",
    fontSize: 22,
    flexShrink: 0,
  },
  brandKicker: {
    margin: 0,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#475569",
  },
  brandTitle: {
    margin: "4px 0 0",
    fontSize: 20,
    fontWeight: 800,
    background: "linear-gradient(135deg, #34d399, #10b981)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  nav: { display: "grid", gap: 6 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid transparent",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left",
    width: "100%",
  },
  navItemActive: {
    background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.2))",
    color: "#f0fdf4",
    border: "1px solid rgba(52,211,153,0.25)",
    fontWeight: 700,
  },
  navIcon: { fontSize: 16, flexShrink: 0 },
  storeCard: {
    marginTop: "auto",
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(15,31,24,0.7)",
    border: "1px solid rgba(148,163,184,0.1)",
  },
  storeLabel: {
    margin: "0 0 6px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#475569",
  },
  storeName: { margin: 0, fontSize: 15, fontWeight: 800, color: "#f1f5f9" },
  storeMeta: { margin: "4px 0 0", fontSize: 12, color: "#64748b" },
  walletCard: {
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(15,31,24,0.7)",
    border: "1px solid rgba(148,163,184,0.1)",
    display: "grid",
    gap: 8,
  },
  walletRow: { display: "flex", alignItems: "center", gap: 8 },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 8px rgba(52,211,153,0.6)",
    flexShrink: 0,
  },
  walletAddr: {
    fontSize: 13,
    fontWeight: 700,
    color: "#e2e8f0",
    fontFamily: "monospace",
  },
  walletBalance: { margin: 0, fontSize: 14, fontWeight: 800, color: "#34d399" },
  walletConnectBtn: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(52,211,153,0.3)",
    background: "rgba(16,185,129,0.1)",
    color: "#34d399",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  walletBanner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.3)",
    marginBottom: 20,
  },
  walletBannerTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: "#fbbf24",
  },
  walletBannerText: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  walletBannerBtn: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    color: "#1a1206",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  logoutBtn: {
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(248,113,113,0.06)",
    color: "#f87171",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  main: { padding: "28px 32px", overflowY: "auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  headerKicker: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: "#475569",
  },
  headerTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
    fontWeight: 800,
    color: "#f8fafc",
  },
  profileChip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 16,
    background: "rgba(15,31,24,0.7)",
    border: "1px solid rgba(148,163,184,0.12)",
    flexShrink: 0,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #10b981, #059669)",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 16,
    color: "#04140d",
    flexShrink: 0,
  },
  chipRole: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#475569",
  },
  chipAddress: { margin: "3px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  toast: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 18,
  },
  card: {
    padding: 24,
    borderRadius: 22,
    background: "rgba(12,31,24,0.7)",
    border: "1px solid rgba(148,163,184,0.1)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    marginBottom: 20,
    backdropFilter: "blur(12px)",
  },
  cardTitle: { margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#f1f5f9" },
  form: { display: "grid", gap: 18 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 14,
  },
  field: { display: "grid", gap: 6 },
  label: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.15)",
    background: "rgba(6,19,13,0.8)",
    color: "#e2e8f0",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  },
  hint: { fontSize: 11, color: "#34d399", fontWeight: 600 },
  formActions: { display: "flex", gap: 12, alignItems: "center" },
  primaryBtn: {
    padding: "12px 24px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #34d399)",
    color: "#04140d",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  ghostBtn: {
    padding: "12px 20px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.15)",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 14,
  },
  productCard: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(6,19,13,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    display: "grid",
    gap: 8,
  },
  productTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryPill: {
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "capitalize",
    background: "rgba(52,211,153,0.12)",
    color: "#34d399",
  },
  statusPill: {
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
  },
  productName: { margin: 0, fontSize: 16, fontWeight: 800, color: "#f1f5f9" },
  productDesc: { margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5, minHeight: 34 },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTop: "1px solid rgba(148,163,184,0.08)",
  },
  priceRm: { fontSize: 15, fontWeight: 800, color: "#34d399" },
  priceEth: { fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  stockRow: { display: "flex", justifyContent: "space-between" },
  cardActions: { display: "flex", gap: 8, marginTop: 4 },
  editBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(56,189,248,0.1)",
    color: "#38bdf8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  deactivateBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.25)",
    background: "rgba(248,113,113,0.08)",
    color: "#f87171",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  reactivateBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(52,211,153,0.25)",
    background: "rgba(16,185,129,0.08)",
    color: "#34d399",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  orderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  orderProduct: { margin: 0, fontSize: 16, fontWeight: 800, color: "#f1f5f9" },
  orderQty: { color: "#64748b", fontWeight: 600, fontSize: 14 },
  orderMeta: { margin: "4px 0 0", fontSize: 12, color: "#64748b" },
  stageBadge: {
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  stepsRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: 18,
    overflowX: "auto",
    paddingBottom: 4,
  },
  stepItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 64,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#04140d",
    border: "2px solid",
  },
  stepLabel: { fontSize: 10, fontWeight: 600, textAlign: "center" },
  stepLine: { flex: 1, height: 2, minWidth: 20, margin: "0 2px", marginTop: -18 },
  orderControls: { display: "flex", gap: 10, flexWrap: "wrap" },
  advanceBtn: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #34d399)",
    color: "#04140d",
    fontWeight: 800,
    fontSize: 13,
  },
  stageSelect: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.15)",
    background: "rgba(6,19,13,0.9)",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  tile: {
    padding: "18px 20px",
    borderRadius: 20,
    background: "rgba(6,19,13,0.6)",
    border: "1px solid",
    display: "grid",
    gap: 6,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    fontSize: 15,
    justifySelf: "start",
  },
  tileLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#475569",
  },
  tileValue: { margin: 0, fontSize: 24, fontWeight: 800 },
  tileSub: { margin: 0, fontSize: 12, color: "#475569" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#475569",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  thRight: {
    textAlign: "right",
    padding: "10px 12px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#475569",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  tr: { borderBottom: "1px solid rgba(148,163,184,0.06)" },
  td: { padding: "12px", color: "#e2e8f0", fontWeight: 600 },
  tdMuted: { padding: "12px", color: "#94a3b8", textTransform: "capitalize" },
  tdRight: { padding: "12px", textAlign: "right", color: "#cbd5e1", fontWeight: 600 },
  pipelineRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
  },
  pipelineItem: {
    padding: "16px 10px",
    borderRadius: 14,
    background: "rgba(6,19,13,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    textAlign: "center",
    display: "grid",
    gap: 6,
  },
  pipelineCount: {
    fontSize: 24,
    fontWeight: 800,
    color: "#34d399",
  },
  pipelineLabel: { fontSize: 11, color: "#64748b", fontWeight: 600 },
  loadingRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    color: "#64748b",
    padding: "24px 0",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid rgba(52,211,153,0.2)",
    borderTopColor: "#34d399",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 24px",
    display: "grid",
    placeItems: "center",
    gap: 8,
  },
  emptyTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: "#f1f5f9" },
  muted: { color: "#64748b", fontSize: 14, margin: 0 },

  // ── Payments / subscription ────────────────────────────────────────────
  planHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  planKicker: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#475569",
  },
  planName: { margin: "6px 0 4px", fontSize: 26, fontWeight: 800 },
  planBadge: {
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
    border: "1px solid",
  },
  usageBlock: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    background: "rgba(15,31,24,0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
    display: "grid",
    gap: 10,
  },
  usageTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  usageLabel: { fontSize: 13, color: "#94a3b8", fontWeight: 600 },
  usageValue: { fontSize: 15, color: "#f1f5f9", fontWeight: 800 },
  usageBarTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(148,163,184,0.15)",
    overflow: "hidden",
  },
  usageBarFill: { height: "100%", borderRadius: 999, transition: "width 0.3s ease" },
  usageWarn: { margin: 0, fontSize: 12, color: "#fca5a5", fontWeight: 600 },
  pendingNotice: {
    marginTop: 16,
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(251,191,36,0.08)",
    border: "1px solid rgba(251,191,36,0.25)",
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 10,
    lineHeight: 1.5,
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 16,
  },
  planCard: {
    padding: 20,
    borderRadius: 18,
    background: "rgba(15,31,24,0.5)",
    border: "1px solid",
    display: "grid",
    gap: 8,
  },
  planCardTop: { display: "flex", alignItems: "center", gap: 8 },
  planDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  planCardName: { fontSize: 16, fontWeight: 800, color: "#f1f5f9" },
  planPrice: { margin: "4px 0 0", fontSize: 24, fontWeight: 800 },
  planPriceUnit: { fontSize: 12, fontWeight: 600, color: "#64748b" },
  planLimit: { margin: 0, fontSize: 13, color: "#cbd5e1", fontWeight: 600 },
  planBlurb: { margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5, minHeight: 32 },
  planTag: {
    marginTop: 6,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 700,
  },
  switchBtn: {
    marginTop: 6,
    padding: "9px 12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#04140d",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 12,
  },
  billAmount: { margin: "4px 0", fontSize: 28, fontWeight: 800, color: "#34d399" },
  payBtn: {
    padding: "14px 24px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#04140d",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
  },
  billNote: {
    margin: "16px 0 0",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
    borderTop: "1px solid rgba(148,163,184,0.08)",
    paddingTop: 14,
  },
};
