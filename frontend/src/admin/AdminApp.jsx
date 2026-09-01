/**
 * frontend/src/admin/AdminApp.jsx
 *
 * Admin interface — platform administration console.
 *  - Users      : view every registered user (search) + platform balances
 *  - Staking    : edit tier APY, view every staker (amount, wallet)
 *  - Revenue    : seller subscription payments (monthly plan revenue)
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const NAV = [
  { id: "users", label: "Users" },
  { id: "staking", label: "Staking" },
  { id: "revenue", label: "Revenue" },
  { id: "disputes", label: "Disputes" },
  { id: "transactions", label: "Transactions" },
];

const fmt = (v, d = 2) => {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: d })
    : "0";
};

const shortAddr = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "—");

const roleColor = (role) =>
  role === "admin" ? "#f59e0b" : role === "merchant" ? "#a78bfa" : "#38bdf8";

const planColor = (plan) =>
  plan === "enterprise" ? "#f59e0b" : plan === "pro" ? "#a78bfa" : "#38bdf8";

export default function AdminApp({ user, logout }) {
  const [view, setView] = useState("users");
  const [balance, setBalance] = useState({
    address: "",
    ethBalance: "0",
    elixirBalance: "0",
    online: false,
  });
  const [overview, setOverview] = useState({
    customers: 0,
    merchants: 0,
    admins: 0,
    total: 0,
  });
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    loadBalance();
    loadOverview();
    const interval = setInterval(loadBalance, 15000);
    return () => clearInterval(interval);
  }, []);

  function showMsg(text, type = "info") {
    setMessage({ text, type });
    if (type !== "error") setTimeout(() => setMessage({ text: "", type: "" }), 4000);
  }

  async function loadBalance() {
    try {
      const res = await axios.get("/api/admin/balance");
      setBalance(res.data);
    } catch {
      /* keep last known */
    }
  }

  async function loadOverview() {
    try {
      const res = await axios.get("/api/admin/overview");
      setOverview(res.data.counts);
    } catch {
      /* non-critical */
    }
  }

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brandBlock}>
          <div>
            <p style={s.brandKicker}>Admin Console</p>
            <h1 style={s.brandTitle}>Elixir Commerce</h1>
          </div>
        </div>

        <nav style={s.nav}>
          {NAV.map((n) => (
            <button
              key={n.id}
              style={{ ...s.navItem, ...(view === n.id ? s.navItemActive : {}) }}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div style={s.treasuryCard}>
          <p style={s.treasuryLabel}>Platform Treasury</p>
          <div style={s.treasuryRow}>
            <span>ETH</span>
            <strong>{fmt(balance.ethBalance, 4)}</strong>
          </div>
          <div style={s.treasuryRow}>
            <span>Elixir</span>
            <strong>{fmt(balance.elixirBalance, 0)}</strong>
          </div>
          <div style={s.treasuryStatus}>
            <span
              style={{
                ...s.statusDot,
                background: balance.online ? "#10b981" : "#f87171",
              }}
            />
            {balance.online ? "Chain connected" : "Chain offline"}
          </div>
        </div>

        <button style={s.logoutBtn} onClick={logout}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <p style={s.headerKicker}>Administration</p>
            <h2 style={s.headerTitle}>{NAV.find((n) => n.id === view)?.label}</h2>
          </div>
          <div style={s.profileChip}>
            <div style={s.profileAvatar}>
              {(user?.name || "A")[0].toUpperCase()}
            </div>
            <div>
              <p style={s.chipRole}>admin</p>
              <p style={s.chipAddress}>{shortAddr(balance.address)}</p>
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

        {view === "users" && <UsersView balance={balance} overview={overview} />}
        {view === "staking" && <StakingView showMsg={showMsg} />}
        {view === "revenue" && <RevenueView />}
        {view === "disputes" && <DisputesView showMsg={showMsg} />}
        {view === "transactions" && <TransactionsView />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Users view
// ═══════════════════════════════════════════════════════════════════════════

function UsersView({ balance, overview }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadUsers(debounced);
  }, [debounced]);

  async function loadUsers(term) {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/users", {
        params: term ? { search: term } : {},
      });
      setUsers(res.data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={s.cardGrid}>
        <Tile icon="⟠" label="Admin ETH Balance" value={fmt(balance.ethBalance, 4)} sub="On-chain reserve" color="#7c3aed" />
        <Tile icon="✦" label="Admin Elixir Balance" value={fmt(balance.elixirBalance, 0)} sub="LYT treasury supply" color="#0ea5e9" />
        <Tile icon="👥" label="Registered Users" value={fmt(overview.total, 0)} sub={`${overview.customers} customers · ${overview.merchants} sellers`} color="#10b981" />
      </div>

      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>User Management</p>
            <h3 style={s.sectionTitle}>All Registered Users</h3>
          </div>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input
              style={s.searchInput}
              placeholder="Search name, email, code or wallet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <Loading label="Loading users…" />
        ) : users.length === 0 ? (
          <Empty icon="🗂" title="No users found" text={debounced ? `No results for “${debounced}”.` : "No users registered yet."} />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>MetaMask</th>
                  <th style={s.thRight}>RM</th>
                  <th style={s.thRight}>Elixir</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={s.tr}>
                    <td style={s.td}><span style={s.code}>{u.userCode || "—"}</span></td>
                    <td style={s.td}>{u.name}</td>
                    <td style={s.tdMuted}>{u.email}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: roleColor(u.role), borderColor: `${roleColor(u.role)}44`, background: `${roleColor(u.role)}14` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={s.tdMono}>{u.metamaskAddress ? shortAddr(u.metamaskAddress) : "Not linked"}</td>
                    <td style={s.tdRight}>{u.role === "customer" ? fmt(u.rmBalance, 2) : "—"}</td>
                    <td style={s.tdRight}>{u.role === "customer" ? `${fmt(u.elixirBalance, 0)} ✦` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={s.tableFoot}>{users.length} user(s) shown</p>
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Staking management view
// ═══════════════════════════════════════════════════════════════════════════

function StakingView({ showMsg }) {
  const [tiers, setTiers] = useState([]);
  const [drafts, setDrafts] = useState({}); // days -> apy string
  const [savingDays, setSavingDays] = useState(null);
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState({ totalStaked: 0, totalEarned: 0, activeCount: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTiers();
    loadPositions();
  }, []);

  async function loadTiers() {
    try {
      const res = await axios.get("/api/admin/staking/tiers");
      const list = res.data.tiers || [];
      setTiers(list);
      const d = {};
      list.forEach((t) => (d[t.days] = String(t.apy)));
      setDrafts(d);
    } catch {
      setTiers([]);
    }
  }

  async function loadPositions() {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/staking/positions");
      setPositions(res.data.positions || []);
      setSummary({
        totalStaked: res.data.totalStaked || 0,
        totalEarned: res.data.totalEarned || 0,
        activeCount: res.data.activeCount || 0,
      });
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveTier(days) {
    const apy = Number(drafts[days]);
    if (!Number.isFinite(apy) || apy < 0) {
      showMsg("Enter a valid APY.", "error");
      return;
    }
    setSavingDays(days);
    try {
      const res = await axios.put(`/api/admin/staking/tiers/${days}`, { apy });
      showMsg(res.data.message || "APY updated.", "success");
      await loadTiers();
    } catch (err) {
      showMsg(err?.response?.data?.message || "Unable to update APY.", "error");
    } finally {
      setSavingDays(null);
    }
  }

  return (
    <>
      <div style={s.cardGrid}>
        <Tile icon="🔒" label="Total Staked" value={`${fmt(summary.totalStaked, 0)} ✦`} sub={`${summary.activeCount} active position(s)`} color="#8b5cf6" />
        <Tile icon="📈" label="Interest Accrued" value={`${fmt(summary.totalEarned, 2)} ✦`} sub="Across active stakes" color="#10b981" />
        <Tile icon="🎚" label="Tiers" value={fmt(tiers.length, 0)} sub="Editable APY below" color="#0ea5e9" />
      </div>

      {/* Tier APY editor */}
      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Configuration</p>
            <h3 style={s.sectionTitle}>Staking APY by Tier</h3>
          </div>
        </div>
        <div style={s.tierGrid}>
          {tiers.map((t) => (
            <div key={t.days} style={s.tierCard}>
              <p style={s.tierLabel}>{t.label}</p>
              <div style={s.tierInputRow}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  style={s.tierInput}
                  value={drafts[t.days] ?? ""}
                  onChange={(e) =>
                    setDrafts((cur) => ({ ...cur, [t.days]: e.target.value }))
                  }
                />
                <span style={s.tierPct}>% APY</span>
              </div>
              <button
                style={{ ...s.saveBtn, opacity: savingDays === t.days ? 0.6 : 1 }}
                onClick={() => saveTier(t.days)}
                disabled={savingDays === t.days}
              >
                {savingDays === t.days ? "Saving…" : "Save"}
              </button>
            </div>
          ))}
        </div>
        <p style={s.note}>
          Changing a tier's APY affects new stakes only — existing positions keep
          the rate they were opened at.
        </p>
      </section>

      {/* Stakers table */}
      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Positions</p>
            <h3 style={s.sectionTitle}>All Stakers</h3>
          </div>
          <button style={s.refreshBtn} onClick={loadPositions}>↻ Refresh</button>
        </div>

        {loading ? (
          <Loading label="Loading positions…" />
        ) : positions.length === 0 ? (
          <Empty icon="🪙" title="No stakes yet" text="Customer staking positions will appear here." />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>User</th>
                  <th style={s.th}>Wallet</th>
                  <th style={s.thRight}>Amount</th>
                  <th style={s.thRight}>Tier</th>
                  <th style={s.thRight}>APY</th>
                  <th style={s.thRight}>Earned</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>
                      {p.name}
                      <span style={s.subCode}> {p.userCode}</span>
                    </td>
                    <td style={s.tdMono}>{shortAddr(p.walletAddress)}</td>
                    <td style={s.tdRight}>{fmt(p.amount, 2)} ✦</td>
                    <td style={s.tdRight}>{p.tierDays}d</td>
                    <td style={s.tdRight}>{fmt(p.apy, 2)}%</td>
                    <td style={s.tdRight}>+{fmt(p.earned, 2)} ✦</td>
                    <td style={s.td}>
                      <span
                        style={{
                          ...s.badge,
                          color: p.status === "active" ? "#34d399" : "#94a3b8",
                          borderColor: p.status === "active" ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.3)",
                          background: p.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.08)",
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={s.tableFoot}>{positions.length} position(s)</p>
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Revenue view
// ═══════════════════════════════════════════════════════════════════════════

function RevenueView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/revenue");
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading label="Loading revenue…" />;
  if (!data) return <Empty icon="💸" title="No revenue data" text="Seller subscription payments will appear here." />;

  const { summary, payments } = data;

  return (
    <>
      <div style={s.cardGrid}>
        <Tile icon="💰" label="Total Subscription Revenue" value={`${fmt(summary.totalEth, 4)} ETH`} sub={`≈ RM ${fmt(summary.totalRm, 2)}`} color="#10b981" />
        <Tile icon="🧾" label="Payments Received" value={fmt(summary.totalPayments, 0)} sub="Completed charges" color="#0ea5e9" />
        <Tile icon="📦" label="By Plan (ETH)" value={`${fmt(summary.byPlan.pro + summary.byPlan.enterprise + summary.byPlan.starter, 4)}`} sub={`S ${fmt(summary.byPlan.starter, 2)} · P ${fmt(summary.byPlan.pro, 2)} · E ${fmt(summary.byPlan.enterprise, 2)}`} color="#f59e0b" />
      </div>

      {summary.monthly && summary.monthly.length > 0 && (
        <section style={s.sectionCard}>
          <div style={s.sectionHead}>
            <div>
              <p style={s.sectionLabel}>Trend</p>
              <h3 style={s.sectionTitle}>Monthly Revenue</h3>
            </div>
          </div>
          <div style={s.monthRow}>
            {summary.monthly.map((m) => (
              <div key={m.month} style={s.monthCard}>
                <p style={s.monthEth}>{fmt(m.eth, 3)} ETH</p>
                <span style={s.monthLabel}>{m.month}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Ledger</p>
            <h3 style={s.sectionTitle}>Subscription Payments</h3>
          </div>
          <button style={s.refreshBtn} onClick={load}>↻ Refresh</button>
        </div>

        {payments.length === 0 ? (
          <Empty icon="🧾" title="No payments yet" text="Seller monthly plan payments will show here." />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Seller</th>
                  <th style={s.th}>Plan</th>
                  <th style={s.thRight}>Amount</th>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Tx</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>
                      {p.sellerName}
                      <span style={s.subCode}> {p.sellerCode}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: planColor(p.plan), borderColor: `${planColor(p.plan)}44`, background: `${planColor(p.plan)}14` }}>
                        {p.plan}
                      </span>
                    </td>
                    <td style={s.tdRight}>{fmt(p.amountEth, 4)} ETH</td>
                    <td style={s.tdMuted}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td style={s.tdMono}>{p.txHash ? shortAddr(p.txHash) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={s.tableFoot}>{payments.length} payment(s)</p>
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Disputes view — admin resolves escrow disputes raised by buyers
// ═══════════════════════════════════════════════════════════════════════════

function DisputesView({ showMsg }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null); // `${orderId}:${action}`

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/escrow/disputes");
      setDisputes(res.data.disputes || []);
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }

  async function resolve(orderId, refundBuyer) {
    const action = refundBuyer ? "refund" : "release";
    const who = refundBuyer ? "refund the buyer" : "release funds to the seller";
    if (!window.confirm(`Are you sure you want to ${who}? This runs an on-chain transaction and cannot be undone.`)) {
      return;
    }
    setBusy(`${orderId}:${action}`);
    try {
      const res = await axios.post("/api/admin/escrow/resolve", {
        orderId,
        refundBuyer,
      });
      showMsg(res.data.message || "Dispute resolved.", "success");
      await load();
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to resolve the dispute.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div style={s.cardGrid}>
        <Tile
          icon="⚖"
          label="Open Disputes"
          value={fmt(disputes.length, 0)}
          sub="Awaiting your decision"
          color="#f87171"
        />
        <Tile
          icon="🛡"
          label="How it works"
          value="Buyer → Admin"
          sub="Buyers raise, you resolve"
          color="#38bdf8"
        />
        <Tile
          icon="🔗"
          label="Resolution"
          value="On-chain"
          sub="Refund or release via contract"
          color="#a78bfa"
        />
      </div>

      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Escrow</p>
            <h3 style={s.sectionTitle}>Disputes to Resolve</h3>
          </div>
          <button style={s.refreshBtn} onClick={load}>
            ↻ Refresh
          </button>
        </div>

        <p style={s.note}>
          When a buyer raises a dispute, the escrowed funds are frozen in the
          smart contract until you decide. Choose <strong>Refund Buyer</strong>{" "}
          to return the escrowed asset to the buyer (order cancelled, stock
          restored), or <strong>Release to Seller</strong> to pay the seller as
          normal.
        </p>

        {loading ? (
          <Loading label="Loading disputes…" />
        ) : disputes.length === 0 ? (
          <Empty
            icon="✅"
            title="No open disputes"
            text="Escrow disputes raised by buyers will appear here for you to resolve."
          />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Product</th>
                  <th style={s.th}>Buyer</th>
                  <th style={s.th}>Seller</th>
                  <th style={s.th}>Asset</th>
                  <th style={s.thRight}>Value</th>
                  <th style={s.th}>Raised</th>
                  <th style={s.thRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => {
                  const isToken = d.paymentMode === "TOKEN_ESCROW";
                  return (
                    <tr key={d.orderId} style={s.tr}>
                      <td style={s.td}>
                        {d.productName}
                        <span style={s.subCode}> ×{d.quantity}</span>
                      </td>
                      <td style={s.td}>
                        {d.buyerName}
                        <span style={s.subCode}> {d.buyerCode}</span>
                      </td>
                      <td style={s.td}>{d.sellerName}</td>
                      <td style={s.td}>
                        <span
                          style={{
                            ...s.badge,
                            color: isToken ? "#0ea5e9" : "#a78bfa",
                            borderColor: isToken
                              ? "rgba(14,165,233,0.4)"
                              : "rgba(167,139,250,0.4)",
                            background: isToken
                              ? "rgba(14,165,233,0.12)"
                              : "rgba(167,139,250,0.12)",
                          }}
                        >
                          {isToken ? "Elixir" : "ETH"}
                        </span>
                      </td>
                      <td style={s.tdRight}>
                        {isToken
                          ? `${fmt(d.amountEth * 1000, 0)} ✦`
                          : `${fmt(d.amountEth, 4)} ETH`}
                      </td>
                      <td style={s.tdMuted}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td style={s.tdRight}>
                        <div style={s.disputeActions}>
                          <button
                            style={{
                              ...s.releaseBtn,
                              opacity: busy === `${d.orderId}:release` ? 0.6 : 1,
                            }}
                            onClick={() => resolve(d.orderId, false)}
                            disabled={busy != null}
                          >
                            {busy === `${d.orderId}:release`
                              ? "…"
                              : "Release to Seller"}
                          </button>
                          <button
                            style={{
                              ...s.refundBtn,
                              opacity: busy === `${d.orderId}:refund` ? 0.6 : 1,
                            }}
                            onClick={() => resolve(d.orderId, true)}
                            disabled={busy != null}
                          >
                            {busy === `${d.orderId}:refund`
                              ? "…"
                              : "Refund Buyer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={s.tableFoot}>{disputes.length} open dispute(s)</p>
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Transactions view — all wallet transactions across the platform
// ═══════════════════════════════════════════════════════════════════════════

function TransactionsView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const TRANSACTION_TYPES = ["ALL", "SWAP", "TRANSFER_OUT", "TRANSFER_IN", "DEPOSIT", "STAKE", "UNSTAKE"];
  const STATUS_TYPES = ["ALL", "pending", "completed", "failed"];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadTransactions();
  }, [debounced, typeFilter, statusFilter]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const params = {};
      if (debounced) params.search = debounced;
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;

      const res = await axios.get("/api/admin/transactions", { params });
      setTransactions(res.data.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  const typeColor = (type) => {
    if (type === "SWAP") return "#0ea5e9";
    if (type === "STAKE" || type === "UNSTAKE") return "#8b5cf6";
    if (type === "DEPOSIT") return "#10b981";
    return "#f59e0b";
  };

  const statusColor = (status) => {
    if (status === "completed") return "#10b981";
    if (status === "failed") return "#f87171";
    return "#f59e0b";
  };

  return (
    <>
      <div style={s.cardGrid}>
        <Tile
          icon="💸"
          label="Total Transactions"
          value={fmt(transactions.length, 0)}
          sub="All platform activity"
          color="#0ea5e9"
        />
        <Tile
          icon="✅"
          label="Completed"
          value={fmt(transactions.filter(t => t.status === "completed").length, 0)}
          sub="Successful txns"
          color="#10b981"
        />
        <Tile
          icon="⏳"
          label="Pending"
          value={fmt(transactions.filter(t => t.status === "pending").length, 0)}
          sub="In progress"
          color="#f59e0b"
        />
      </div>

      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Platform Activity</p>
            <h3 style={s.sectionTitle}>All Wallet Transactions</h3>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={s.searchWrap}>
              <span style={s.searchIcon}>🔍</span>
              <input
                style={s.searchInput}
                placeholder="Search user code, wallet, or tx hash…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button style={s.refreshBtn} onClick={loadTransactions}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...s.muted, fontSize: 12, display: "block", marginBottom: 6 }}>
              Transaction Type
            </label>
            <select
              style={s.filterSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All Types" : type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...s.muted, fontSize: 12, display: "block", marginBottom: 6 }}>
              Status
            </label>
            <select
              style={s.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_TYPES.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <Loading label="Loading transactions…" />
        ) : transactions.length === 0 ? (
          <Empty
            icon="📭"
            title="No transactions found"
            text={
              debounced || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "Try adjusting your search or filters."
                : "No wallet transactions recorded yet."
            }
          />
        ) : (
          <div style={s.tableScrollContainer}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.thFixed}>User</th>
                  <th style={s.thFixed}>Type</th>
                  <th style={s.thFixed}>From</th>
                  <th style={s.thFlex}>Amount</th>
                  <th style={s.thFixed}>To</th>
                  <th style={s.thFlex}>Amount</th>
                  <th style={s.thFixed}>Status</th>
                  <th style={s.thFixed}>Date</th>
                  <th style={s.thFixed}>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={s.tr}>
                    <td style={s.tdFixed}>
                      <span style={s.code}>{tx.userCode || "—"}</span>
                    </td>
                    <td style={s.tdFixed}>
                      <span
                        style={{
                          ...s.badge,
                          color: typeColor(tx.type),
                          borderColor: `${typeColor(tx.type)}44`,
                          background: `${typeColor(tx.type)}14`,
                        }}
                      >
                        {tx.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={s.tdFixed}>
                      {tx.fromCurrency ? (
                        <span style={s.tdMono}>{tx.fromCurrency}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={s.tdFlex}>
                      {tx.fromAmount != null ? fmt(tx.fromAmount, 4) : "—"}
                    </td>
                    <td style={s.tdFixed}>
                      {tx.toCurrency ? (
                        <span style={s.tdMono}>{tx.toCurrency}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={s.tdFlex}>
                      {tx.toAmount != null ? fmt(tx.toAmount, 4) : "—"}
                    </td>
                    <td style={s.tdFixed}>
                      <span
                        style={{
                          ...s.badge,
                          color: statusColor(tx.status),
                          borderColor: `${statusColor(tx.status)}44`,
                          background: `${statusColor(tx.status)}14`,
                        }}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td style={s.tdFixed}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td style={s.tdFixed}>
                      {tx.txHash ? shortAddr(tx.txHash) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={s.tableFoot}>
            {transactions.length} transaction(s) shown
          </p>
        )}
      </section>
    </>
  );
}

// ── Shared small components ─────────────────────────────────────────────────

function Tile({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...s.tile, borderColor: `${color}33`, boxShadow: `0 4px 24px ${color}18` }}>
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

function Empty({ icon, title, text }) {
  return (
    <div style={s.emptyState}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <p style={s.emptyTitle}>{title}</p>
      <p style={s.muted}>{text}</p>
    </div>
  );
}

const s = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "270px minmax(0, 1fr)",
    background: "linear-gradient(135deg, #060d1a 0%, #0c1524 50%, #0f1e35 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  sidebar: {
    padding: 24,
    borderRight: "1px solid rgba(148, 163, 184, 0.1)",
    background: "rgba(6, 13, 26, 0.85)",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  brandBlock: { display: "flex", alignItems: "center", gap: 14, paddingBottom: 8, borderBottom: "1px solid rgba(148,163,184,0.08)" },
  brandMark: { width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#060d1a", fontWeight: 800, fontSize: 22, flexShrink: 0 },
  brandKicker: { margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#475569" },
  brandTitle: { margin: "4px 0 0", fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg, #fbbf24, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  nav: { display: "grid", gap: 6 },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid transparent", background: "transparent", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%" },
  navItemActive: { background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.2))", color: "#f8fafc", border: "1px solid rgba(251, 191, 36, 0.25)", fontWeight: 700 },
  navIcon: { fontSize: 16, flexShrink: 0 },
  treasuryCard: { marginTop: "auto", padding: "14px 16px", borderRadius: 16, background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(148, 163, 184, 0.1)", display: "grid", gap: 8 },
  treasuryLabel: { margin: "0 0 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.4, color: "#475569" },
  treasuryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#cbd5e1" },
  treasuryStatus: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  logoutBtn: { padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(248, 113, 113, 0.18)", background: "rgba(248, 113, 113, 0.06)", color: "#f87171", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  main: { padding: "28px 32px", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24, flexWrap: "wrap" },
  headerKicker: { margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.6, color: "#475569" },
  headerTitle: { margin: "8px 0 0", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, lineHeight: 1.1, color: "#f8fafc" },
  profileChip: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(148, 163, 184, 0.12)", flexShrink: 0 },
  profileAvatar: { width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #f97316)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, color: "#060d1a", flexShrink: 0 },
  chipRole: { margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#475569" },
  chipAddress: { margin: "3px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  toast: { padding: "12px 16px", borderRadius: 14, border: "1px solid", fontSize: 14, fontWeight: 600, marginBottom: 18 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 },
  tile: { padding: "18px 20px", borderRadius: 20, background: "rgba(8, 15, 28, 0.6)", border: "1px solid", display: "grid", gap: 6 },
  tileIcon: { width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800, justifySelf: "start" },
  tileLabel: { margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#475569" },
  tileValue: { margin: 0, fontSize: 24, fontWeight: 800 },
  tileSub: { margin: 0, fontSize: 12, color: "#475569" },
  sectionCard: { padding: 24, borderRadius: 22, background: "rgba(12, 21, 36, 0.7)", border: "1px solid rgba(148, 163, 184, 0.1)", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)", backdropFilter: "blur(12px)", marginBottom: 20 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  sectionLabel: { margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.6, color: "#475569" },
  sectionTitle: { margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: "#f8fafc" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.15)", background: "rgba(15,23,42,0.8)", minWidth: 280 },
  searchIcon: { fontSize: 14, color: "#64748b" },
  searchInput: { flex: 1, border: "none", background: "transparent", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit" },
  filterSelect: { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.15)", background: "rgba(15,23,42,0.8)", color: "#e2e8f0", fontSize: 14, cursor: "pointer", fontFamily: "inherit", outline: "none", width: "100%" },
  refreshBtn: { padding: "9px 14px", borderRadius: 12, border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.1)", color: "#fbbf24", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "600px",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: 12,
    marginBottom: 12,
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: "1200px" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", borderBottom: "1px solid rgba(148,163,184,0.12)", position: "sticky", top: 0, background: "#0a1628", zIndex: 10 },
  thFixed: { 
    textAlign: "left", 
    padding: "10px 12px", 
    fontSize: 10, 
    fontWeight: 700, 
    textTransform: "uppercase", 
    letterSpacing: 0.8, 
    color: "#475569", 
    borderBottom: "1px solid rgba(148,163,184,0.12)", 
    position: "sticky", 
    top: 0, 
    background: "#0a1628", 
    zIndex: 10,
    width: "120px",
    minWidth: "120px",
    maxWidth: "120px",
  },
  thFlex: { 
    textAlign: "right", 
    padding: "10px 12px", 
    fontSize: 10, 
    fontWeight: 700, 
    textTransform: "uppercase", 
    letterSpacing: 0.8, 
    color: "#475569", 
    borderBottom: "1px solid rgba(148,163,184,0.12)", 
    position: "sticky", 
    top: 0, 
    background: "#0a1628", 
    zIndex: 10,
    minWidth: "100px",
  },
  thRight: { textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", borderBottom: "1px solid rgba(148,163,184,0.12)" },
  tr: { borderBottom: "1px solid rgba(148,163,184,0.06)" },
  td: { padding: "12px", color: "#e2e8f0" },
  tdFixed: { 
    padding: "12px", 
    color: "#e2e8f0",
    width: "120px",
    minWidth: "120px",
    maxWidth: "120px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tdFlex: { 
    padding: "12px", 
    color: "#e2e8f0",
    textAlign: "right",
    minWidth: "100px",
    wordBreak: "break-word",
  },
  tdMuted: { padding: "12px", color: "#94a3b8" },
  tdMono: { padding: "12px", color: "#7dd3fc", fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12 },
  tdRight: { padding: "12px", textAlign: "right", color: "#cbd5e1", fontWeight: 600 },
  subCode: { color: "#475569", fontSize: 11, fontWeight: 600 },
  code: { padding: "3px 8px", borderRadius: 8, background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontWeight: 700, fontSize: 12 },
  badge: { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize", border: "1px solid" },
  tableFoot: { margin: "14px 2px 0", fontSize: 12, color: "#475569" },
  loadingRow: { display: "flex", gap: 12, alignItems: "center", color: "#64748b", padding: "24px 0" },
  spinner: { width: 18, height: 18, border: "2px solid rgba(251,191,36,0.2)", borderTopColor: "#fbbf24", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 },
  emptyState: { textAlign: "center", padding: "40px 24px", display: "grid", placeItems: "center", gap: 8 },
  emptyTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: "#f1f5f9" },
  muted: { color: "#475569", fontSize: 13, margin: 0 },
  // Staking tier editor
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  tierCard: { padding: "16px 18px", borderRadius: 16, background: "rgba(8,15,28,0.6)", border: "1px solid rgba(139,92,246,0.15)", display: "grid", gap: 10 },
  tierLabel: { margin: 0, fontSize: 14, fontWeight: 800, color: "#f1f5f9" },
  tierInputRow: { display: "flex", alignItems: "center", gap: 8 },
  tierInput: { width: 90, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.8)", color: "#e2e8f0", fontSize: 16, fontWeight: 700, outline: "none" },
  tierPct: { fontSize: 12, color: "#a78bfa", fontWeight: 700 },
  saveBtn: { padding: "9px 12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 13 },
  note: { margin: "16px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 },
  monthRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 },
  monthCard: { padding: "16px", borderRadius: 14, background: "rgba(8,15,28,0.6)", border: "1px solid rgba(148,163,184,0.1)", textAlign: "center", display: "grid", gap: 6 },
  monthEth: { margin: 0, fontSize: 18, fontWeight: 800, color: "#34d399" },
  monthLabel: { fontSize: 11, color: "#64748b", fontWeight: 600 },
  // Dispute resolution
  disputeActions: { display: "inline-flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  releaseBtn: { padding: "8px 12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#04140d", cursor: "pointer", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" },
  refundBtn: { padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.12)", color: "#fca5a5", cursor: "pointer", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" },
};
