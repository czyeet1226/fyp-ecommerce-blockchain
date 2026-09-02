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
  { id: "logs", label: "Log Activities" },
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

        <a
          href={`https://sepolia.etherscan.io/address/${balance.address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={s.etherscanBtn}
          title="View your transactions on Etherscan"
        >
          🔍 Explore Etherscan
        </a>

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
        {view === "logs" && <LogsView />}
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
  const [copiedAddr, setCopiedAddr] = useState(null);

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

  function copyToClipboard(address) {
    navigator.clipboard.writeText(address);
    setCopiedAddr(address);
    setTimeout(() => setCopiedAddr(null), 2000);
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
                    <td style={s.td}>
                      {u.metamaskAddress ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={s.tdMono}>{shortAddr(u.metamaskAddress)}</span>
                          <button
                            onClick={() => copyToClipboard(u.metamaskAddress)}
                            style={s.iconBtn}
                            title="Copy address"
                          >
                            {copiedAddr === u.metamaskAddress ? "✓" : "📋"}
                          </button>
                          <a
                            href={`https://sepolia.etherscan.io/address/${u.metamaskAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={s.iconBtn}
                            title="View on Etherscan"
                          >
                            🔍
                          </a>
                        </div>
                      ) : (
                        <span style={s.tdMuted}>Not linked</span>
                      )}
                    </td>
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
  const [copiedWallet, setCopiedWallet] = useState(null);

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

  function copyWalletToClipboard(address) {
    navigator.clipboard.writeText(address);
    setCopiedWallet(address);
    setTimeout(() => setCopiedWallet(null), 2000);
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
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={s.tdMono}>{shortAddr(p.walletAddress)}</span>
                        <button
                          onClick={() => copyWalletToClipboard(p.walletAddress)}
                          style={s.iconBtn}
                          title="Copy address"
                        >
                          {copiedWallet === p.walletAddress ? "✓" : "📋"}
                        </button>
                        <a
                          href={`https://sepolia.etherscan.io/address/${p.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={s.iconBtn}
                          title="View on Etherscan"
                        >
                          🔍
                        </a>
                      </div>
                    </td>
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
          <>
            <div style={s.tableScrollContainer}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.thFixed}>User</th>
                    <th style={s.thFixedWide}>Type</th>
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
                      <td style={s.tdFixedWide}>
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
                        <span style={{ color: "#7dd3fc", fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12 }}>
                          {tx.fromCurrency || "—"}
                        </span>
                      </td>
                      <td style={s.tdFlex}>
                        {tx.fromAmount != null ? fmt(tx.fromAmount, 4) : "—"}
                      </td>
                      <td style={s.tdFixed}>
                        <span style={{ color: "#7dd3fc", fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12 }}>
                          {tx.toCurrency || "—"}
                        </span>
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
          </>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Log Activities view — Railway server logs
// ═══════════════════════════════════════════════════════════════════════════

function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(100);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [limit, severityFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, limit, severityFilter]);

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (severityFilter && severityFilter !== "ALL") {
        params.append("severity", severityFilter);
      }
      const res = await axios.get(`/api/admin/logs?${params}`);
      if (res.data.success) {
        setLogs(res.data.logs || []);
      } else {
        setError(res.data.message || "Failed to load logs");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to fetch logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  function getSeverityInfo(severity) {
    const s = severity?.toLowerCase();
    switch (s) {
      case "error":
        return { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", icon: "❌", label: "ERROR" };
      case "warn":
      case "warning":
        return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", icon: "⚠️", label: "WARN" };
      case "info":
        return { color: "#38bdf8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.3)", icon: "ℹ️", label: "INFO" };
      case "debug":
        return { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", icon: "🔍", label: "DEBUG" };
      default:
        return { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", icon: "📋", label: "LOG" };
    }
  }

  function getMethodColor(method) {
    switch (method) {
      case "GET": return "#10b981";
      case "POST": return "#3b82f6";
      case "PUT": return "#f59e0b";
      case "DELETE": return "#ef4444";
      case "PATCH": return "#8b5cf6";
      default: return "#6b7280";
    }
  }

  function getStatusColor(code) {
    if (code >= 200 && code < 300) return "#10b981";
    if (code >= 300 && code < 400) return "#3b82f6";
    if (code >= 400 && code < 500) return "#f59e0b";
    if (code >= 500) return "#ef4444";
    return "#6b7280";
  }

  const summary = {
    total: logs.length,
    errors: logs.filter(l => l.severity?.toLowerCase() === "error").length,
    warnings: logs.filter(l => l.severity?.toLowerCase() === "warn" || l.severity?.toLowerCase() === "warning").length,
    info: logs.filter(l => l.severity?.toLowerCase() === "info").length,
  };

  return (
    <>
      {/* Summary Cards */}
      <div style={s.cardGrid}>
        <Tile
          icon="📊"
          label="Total Logs"
          value={fmt(summary.total, 0)}
          sub={`Last ${limit} entries`}
          color="#38bdf8"
        />
        <Tile
          icon="❌"
          label="Errors"
          value={fmt(summary.errors, 0)}
          sub={summary.errors > 0 ? "Needs attention" : "All clear"}
          color="#f87171"
        />
        <Tile
          icon="⚠️"
          label="Warnings"
          value={fmt(summary.warnings, 0)}
          sub={summary.warnings > 0 ? "Review recommended" : "No issues"}
          color="#fbbf24"
        />
        <Tile
          icon="ℹ️"
          label="Info Logs"
          value={fmt(summary.info, 0)}
          sub="Normal activity"
          color="#10b981"
        />
      </div>

      {/* Railway Link Banner */}
      <div style={logStyles.railwayBanner}>
        <div style={logStyles.railwayContent}>
          <div style={logStyles.railwayIcon}>🚂</div>
          <div style={logStyles.railwayText}>
            <h4 style={logStyles.railwayTitle}>View Full Railway Logs</h4>
            <p style={logStyles.railwayDesc}>
              See deployment logs, build output, and detailed system information
            </p>
          </div>
        </div>
        <a
          href="https://railway.app/project/068a348f-064a-4190-9d3a-17cd513270ab"
          target="_blank"
          rel="noopener noreferrer"
          style={logStyles.railwayBtn}
        >
          Open Railway Dashboard →
        </a>
      </div>

      {/* Logs Section */}
      <section style={s.sectionCard}>
        <div style={s.sectionHead}>
          <div>
            <p style={s.sectionLabel}>Activity Monitor</p>
            <h3 style={s.sectionTitle}>User Activity Logs</h3>
            <p style={logStyles.subtitle}>
              Real-time HTTP requests, user actions, and system events from Railway server
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={logStyles.autoRefreshLabel}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>Auto-refresh (10s)</span>
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={s.filterSelect}
            >
              <option value="ALL">All Severity</option>
              <option value="INFO">ℹ️ Info Only</option>
              <option value="WARN">⚠️ Warnings</option>
              <option value="ERROR">❌ Errors Only</option>
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={s.filterSelect}
            >
              <option value="50">50 logs</option>
              <option value="100">100 logs</option>
              <option value="200">200 logs</option>
              <option value="500">500 logs</option>
            </select>
            <button onClick={loadLogs} style={s.btn} disabled={loading}>
              {loading ? "⏳ Loading..." : "🔄 Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div style={logStyles.errorAlert}>
            <span style={logStyles.alertIcon}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && !logs.length ? (
          <Loading label="Fetching activity logs from Railway..." />
        ) : logs.length === 0 ? (
          <div style={logStyles.emptyState}>
            <div style={logStyles.emptyIcon}>📜</div>
            <h4 style={logStyles.emptyTitle}>No Logs Available</h4>
            <p style={logStyles.emptyText}>
              User activity logs will appear here once your application starts receiving requests.
            </p>
          </div>
        ) : (
          <>
            <div style={logStyles.logsGrid}>
              {logs.map((log, idx) => {
                const sevInfo = getSeverityInfo(log.severity);
                const methodColor = getMethodColor(log.method);
                const statusColor = getStatusColor(log.statusCode);
                
                return (
                  <div key={idx} style={logStyles.logCard}>
                    {/* Header */}
                    <div style={logStyles.logCardHeader}>
                      <div style={logStyles.logCardLeft}>
                        <span
                          style={{
                            ...logStyles.severityBadge,
                            background: sevInfo.bg,
                            borderColor: sevInfo.border,
                            color: sevInfo.color,
                          }}
                        >
                          {sevInfo.icon} {sevInfo.label}
                        </span>
                        {log.method && (
                          <span
                            style={{
                              ...logStyles.methodBadge,
                              background: `${methodColor}18`,
                              borderColor: `${methodColor}40`,
                              color: methodColor,
                            }}
                          >
                            {log.method}
                          </span>
                        )}
                        {log.statusCode && (
                          <span
                            style={{
                              ...logStyles.statusBadge,
                              background: `${statusColor}18`,
                              borderColor: `${statusColor}40`,
                              color: statusColor,
                            }}
                          >
                            {log.statusCode}
                          </span>
                        )}
                      </div>
                      <div style={logStyles.logCardRight}>
                        <span style={logStyles.timestamp}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Path */}
                    {log.path && (
                      <div style={logStyles.pathRow}>
                        <span style={logStyles.pathIcon}>🔗</span>
                        <code style={logStyles.pathCode}>{log.path}</code>
                      </div>
                    )}

                    {/* Message */}
                    <div style={logStyles.messageRow}>
                      {log.message}
                    </div>

                    {/* Footer Metadata */}
                    <div style={logStyles.logCardFooter}>
                      {log.userCode && (
                        <span style={logStyles.metaChip}>
                          👤 {log.userCode}
                        </span>
                      )}
                      {log.userRole && (
                        <span style={logStyles.metaChip}>
                          🎭 {log.userRole}
                        </span>
                      )}
                      {log.responseTime && (
                        <span style={logStyles.metaChip}>
                          ⏱️ {log.responseTime}ms
                        </span>
                      )}
                      {log.ipAddress && (
                        <span style={logStyles.metaChip}>
                          🌐 {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={logStyles.footer}>
              <span style={logStyles.footerText}>
                Showing {logs.length} log entr{logs.length === 1 ? "y" : "ies"}
                {autoRefresh && " • Auto-refreshing every 10 seconds"}
              </span>
            </div>
          </>
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
  etherscanBtn: {
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.1)",
    color: "#38bdf8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "none",
    display: "block",
    textAlign: "center",
    marginBottom: 10,
    transition: "all 0.2s",
  },
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
    verticalAlign: "middle",
  },
  thFixedWide: { 
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
    width: "140px",
    minWidth: "140px",
    maxWidth: "140px",
    verticalAlign: "middle",
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
    verticalAlign: "middle",
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
    verticalAlign: "middle",
  },
  tdFixedWide: { 
    padding: "12px", 
    color: "#e2e8f0",
    width: "140px",
    minWidth: "140px",
    maxWidth: "140px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "middle",
  },
  tdFlex: { 
    padding: "12px", 
    color: "#e2e8f0",
    textAlign: "right",
    minWidth: "100px",
    wordBreak: "break-word",
    verticalAlign: "middle",
  },
  tdMuted: { padding: "12px", color: "#94a3b8" },
  tdMono: { padding: "12px", color: "#7dd3fc", fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12 },
  tdRight: { padding: "12px", textAlign: "right", color: "#cbd5e1", fontWeight: 600 },
  subCode: { color: "#475569", fontSize: 11, fontWeight: 600 },
  code: { padding: "3px 8px", borderRadius: 8, background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontWeight: 700, fontSize: 12 },
  badge: { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize", border: "1px solid" },
  iconBtn: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.1)",
    color: "#38bdf8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tableFoot: { margin: "14px 2px 0", fontSize: 12, color: "#475569" },
  logsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxHeight: "600px",
    overflowY: "auto",
    padding: "12px",
    background: "rgba(15,23,42,0.4)",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.08)",
  },
  logEntry: {
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(148,163,184,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
  },
  logIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  logSeverity: {
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  logTimestamp: {
    color: "#64748b",
    fontSize: 11,
    marginLeft: "auto",
  },
  logMessage: {
    margin: 0,
    padding: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#cbd5e1",
    fontFamily: "'Fira Code', 'Consolas', monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  alert: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid",
    fontSize: 13,
    marginBottom: 16,
  },
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

// ── Log Activity Styles (Modern Card Layout) ────────────────────────────────
const logStyles = {
  // Railway Banner
  railwayBanner: {
    padding: "20px 24px",
    borderRadius: 18,
    background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.12))",
    border: "1px solid rgba(139,92,246,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
  },
  railwayContent: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  railwayIcon: {
    fontSize: 32,
    width: 60,
    height: 60,
    borderRadius: 14,
    background: "rgba(139,92,246,0.2)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  railwayText: {
    flex: 1,
  },
  railwayTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  railwayDesc: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.4,
  },
  railwayBtn: {
    padding: "12px 24px",
    borderRadius: 12,
    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
  },
  
  // Subtitle
  subtitle: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  
  // Auto-refresh label
  autoRefreshLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#cbd5e1",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
  },
  
  // Error alert
  errorAlert: {
    padding: "14px 18px",
    borderRadius: 12,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.3)",
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  
  // Empty state
  emptyState: {
    padding: "60px 20px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 18,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: "#64748b",
    maxWidth: 400,
    marginLeft: "auto",
    marginRight: "auto",
  },
  
  // Logs grid
  logsGrid: {
    display: "grid",
    gap: 14,
    marginTop: 8,
  },
  
  // Log card
  logCard: {
    padding: "16px 18px",
    borderRadius: 14,
    background: "rgba(8,15,28,0.6)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "grid",
    gap: 12,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  
  logCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  
  logCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  
  logCardRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  
  severityBadge: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  
  methodBadge: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  
  statusBadge: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 800,
  },
  
  timestamp: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    fontFamily: "'Courier New', monospace",
  },
  
  pathRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(148,163,184,0.08)",
  },
  
  pathIcon: {
    fontSize: 14,
    flexShrink: 0,
    opacity: 0.7,
  },
  
  pathCode: {
    flex: 1,
    fontSize: 13,
    fontFamily: "'Courier New', monospace",
    color: "#38bdf8",
    fontWeight: 600,
    overflowX: "auto",
    whiteSpace: "nowrap",
  },
  
  messageRow: {
    fontSize: 14,
    color: "#e2e8f0",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  
  logCardFooter: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 8,
    borderTop: "1px solid rgba(148,163,184,0.08)",
  },
  
  metaChip: {
    padding: "4px 10px",
    borderRadius: 6,
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  
  // Footer
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid rgba(148,163,184,0.1)",
    textAlign: "center",
  },
  
  footerText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },
};
