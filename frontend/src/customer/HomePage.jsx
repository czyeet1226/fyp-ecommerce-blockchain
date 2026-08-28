/**
 * frontend/src/customer/HomePage.jsx
 *
 * Public landing page — the first screen a visitor sees at "/".
 * Routes onward to Sign Up or Login. No authentication required.
 */

import React from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "\u{1F6E1}",
    title: "Escrow-protected checkout",
    text: "Pay in ETH or Elixir and the funds stay locked in a smart contract until you confirm the item arrived.",
  },
  {
    icon: "\u{1F4C8}",
    title: "Stake and earn",
    text: "Lock Elixir for 30 to 365 days and earn compound interest, calculated monthly.",
  },
  {
    icon: "\u{1F9FE}",
    title: "NFT purchase receipts",
    text: "Every completed order mints an on-chain receipt to your wallet as verifiable proof of purchase.",
  },
  {
    icon: "\u{1F4B1}",
    title: "Three currencies, one wallet",
    text: "Swap freely between ETH, Elixir and RM, deposit funds, or transfer to another user.",
  },
];

const STEPS = [
  { n: "1", title: "Create an account", text: "Sign up as a customer or a seller in under a minute." },
  { n: "2", title: "Connect MetaMask", text: "Link your wallet to unlock ETH and Elixir payments." },
  { n: "3", title: "Shop with confidence", text: "Escrow holds your payment until delivery is confirmed." },
];

export default function HomePage() {
  return (
    <div style={s.page}>
      {/* ── Top navigation ─────────────────────────────────────────────── */}
      <header style={s.nav}>
        <div style={s.brand}>
          <span style={s.brandMark}>&#10022;</span>
          <span style={s.brandName}>Elixir Commerce</span>
        </div>
        <nav style={s.navActions}>
          <Link to="/login" style={s.navLogin}>
            Login
          </Link>
          <Link to="/register" style={s.navSignup}>
            Sign Up
          </Link>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.badge}>Blockchain marketplace</div>
        <h1 style={s.heroTitle}>
          Shop on-chain,
          <br />
          <span style={s.heroAccent}>paid only on delivery</span>
        </h1>
        <p style={s.heroText}>
          A marketplace where payments are held in escrow by a smart contract,
          loyalty rewards are real tokens you can stake, and every purchase
          leaves a verifiable on-chain record.
        </p>

        <div style={s.ctaRow}>
          <Link to="/register" style={s.ctaPrimary}>
            Get started &mdash; it&apos;s free
          </Link>
          <Link to="/login" style={s.ctaGhost}>
            I already have an account
          </Link>
        </div>

        <div style={s.statRow}>
          <Stat value="0%" label="Paid upfront on escrow orders" />
          <Stat value="35%" label="Max staking APY" />
          <Stat value="3" label="Currencies supported" />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Why buy here</h2>
        <div style={s.featureGrid}>
          {FEATURES.map((f) => (
            <article key={f.title} style={s.featureCard}>
              <span style={s.featureIcon}>{f.icon}</span>
              <h3 style={s.featureTitle}>{f.title}</h3>
              <p style={s.featureText}>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>How it works</h2>
        <div style={s.stepRow}>
          {STEPS.map((step) => (
            <div key={step.n} style={s.step}>
              <div style={s.stepNum}>{step.n}</div>
              <h3 style={s.stepTitle}>{step.title}</h3>
              <p style={s.featureText}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Seller call to action ──────────────────────────────────────── */}
      <section style={s.sellerBand}>
        <div>
          <h2 style={{ ...s.sectionTitle, margin: "0 0 8px" }}>
            Selling instead?
          </h2>
          <p style={{ ...s.featureText, maxWidth: 460, margin: "0 auto" }}>
            List products, track fulfillment, and get paid in ETH
            straight to your own MetaMask wallet. Plans start at 0.01
            ETH per month.
          </p>
        </div>
        <Link to="/register" style={s.ctaPrimary}>
          Open a seller account
        </Link>
      </section>

      <footer style={s.foot}>
        <span>&#10022; Elixir Commerce</span>
        <span style={s.footNote}>
          Final Year Project &middot; Sepolia / Hardhat test network
        </span>
      </footer>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={s.stat}>
      <p style={s.statValue}>{value}</p>
      <p style={s.statLabel}>{label}</p>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 20% -10%, rgba(56,189,248,0.18), transparent 42%), radial-gradient(circle at 85% 8%, rgba(129,140,248,0.14), transparent 40%), linear-gradient(160deg, #050b17 0%, #0a1322 45%, #0f1a2e 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },

  nav: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandMark: {
    display: "grid",
    placeItems: "center",
    width: 34,
    height: 34,
    borderRadius: 11,
    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
    color: "#04101f",
    fontWeight: 900,
    fontSize: 17,
  },
  brandName: { fontWeight: 800, fontSize: 17, color: "#f8fafc" },
  navActions: { display: "flex", alignItems: "center", gap: 10 },
  navLogin: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    color: "#e2e8f0",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  },
  navSignup: {
    padding: "10px 18px",
    borderRadius: 12,
    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
    color: "#04101f",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },

  hero: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "64px 24px 20px",
    textAlign: "center",
  },
  badge: {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(14,165,233,0.12)",
    border: "1px solid rgba(56,189,248,0.22)",
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: "22px 0 18px",
    fontSize: 54,
    lineHeight: 1.06,
    letterSpacing: -1.4,
    color: "#f8fafc",
  },
  heroAccent: {
    background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroText: {
    margin: "0 auto",
    maxWidth: 620,
    fontSize: 17,
    lineHeight: 1.7,
    color: "#94a3b8",
  },
  ctaRow: {
    margin: "32px 0 0",
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    padding: "15px 26px",
    borderRadius: 14,
    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
    color: "#04101f",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: "nowrap",
  },
  ctaGhost: {
    padding: "15px 26px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#e2e8f0",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 15,
    whiteSpace: "nowrap",
  },

  statRow: {
    marginTop: 52,
    display: "flex",
    justifyContent: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  stat: {
    minWidth: 170,
    padding: "18px 22px",
    borderRadius: 16,
    background: "rgba(12,21,36,0.7)",
    border: "1px solid rgba(148,163,184,0.12)",
  },
  statValue: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    color: "#f8fafc",
  },
  statLabel: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
  },

  section: { maxWidth: 1120, margin: "0 auto", padding: "56px 24px 0" },
  sectionTitle: {
    margin: "0 0 26px",
    fontSize: 28,
    color: "#f1f5f9",
    textAlign: "center",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  featureCard: {
    padding: "22px 22px 24px",
    borderRadius: 18,
    background: "rgba(12,21,36,0.72)",
    border: "1px solid rgba(148,163,184,0.12)",
  },
  featureIcon: { fontSize: 24 },
  featureTitle: {
    margin: "12px 0 8px",
    fontSize: 16,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  featureText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#94a3b8",
  },

  stepRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  step: {
    padding: "22px 22px 24px",
    borderRadius: 18,
    background: "rgba(12,21,36,0.5)",
    border: "1px dashed rgba(148,163,184,0.2)",
  },
  stepNum: {
    display: "grid",
    placeItems: "center",
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    border: "1px solid rgba(56,189,248,0.3)",
    color: "#7dd3fc",
    fontWeight: 900,
    fontSize: 13,
  },
  stepTitle: {
    margin: "12px 0 8px",
    fontSize: 16,
    fontWeight: 800,
    color: "#f1f5f9",
  },

  sellerBand: {
    maxWidth: 1120,
    width: "calc(100% - 48px)",
    margin: "60px auto 0",
    padding: "28px 26px",
    borderRadius: 20,
    background:
      "linear-gradient(120deg, rgba(56,189,248,0.10), rgba(129,140,248,0.08))",
    border: "1px solid rgba(148,163,184,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    textAlign: "center",
    gap: 20,
    flexWrap: "wrap",
  },

  foot: {
    maxWidth: 1120,
    margin: "56px auto 0",
    padding: "22px 24px 34px",
    borderTop: "1px solid rgba(148,163,184,0.1)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 13,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  footNote: { fontWeight: 400, color: "#475569" },
};
