import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SECTIONS } from "../dashboard/dashboardData";
import { css, SnapRow } from "../dashboard/dashboardUi";
import { useWeb3 } from "../context/Web3Context";

const navBadge = {
  marginLeft: "auto",
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  background: "linear-gradient(135deg, #38bdf8, #818cf8)",
  color: "#04101f",
  fontSize: 11,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const metamaskStyles = {
  connectBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 14,
    border: "1px solid rgba(245, 158, 11, 0.35)",
    background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.08))",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  foxIcon: { fontSize: 16 },
  connectedChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    borderRadius: 14,
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
  },
  metamaskDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 6px rgba(16,185,129,0.5)",
    flexShrink: 0,
  },
  balanceText: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    color: "#34d399",
  },
  addressText: {
    margin: "2px 0 0",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
  },
  disconnectBtn: {
    padding: "4px 6px",
    borderRadius: 6,
    border: "none",
    background: "rgba(248,113,113,0.1)",
    color: "#f87171",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 11,
    lineHeight: 1,
  },
  errorText: {
    margin: 0,
    fontSize: 11,
    color: "#fca5a5",
    maxWidth: 180,
  },
};

export default function DashboardLayout({
  user,
  liveWallet,
  wallet,
  logout,
  cartCount = 0,
  children,
}) {
  const location = useLocation();
  const [hovered, setHovered] = useState(null);
  const { account, ethBalance, isConnected, connecting, error, connectWallet, disconnectWallet } = useWeb3();

  return (
    <div style={css.shell}>
      <aside style={css.sidebar}>
        <div style={css.brandBlock}>
          <div style={css.brandMark}>
            <span style={{ fontSize: 22 }}>✦</span>
          </div>
          <div>
            <p style={css.brandKicker}>Customer Portal</p>
            <h1 style={css.brandTitle}>Elixir Commerce</h1>
          </div>
        </div>

        <nav style={css.nav}>
          {SECTIONS.map((section) => {
            const active = location.pathname === section.path;
            return (
              <Link
                key={section.id}
                to={section.path}
                style={{
                  ...css.navItem,
                  ...(active ? css.navItemActive : {}),
                  ...(hovered === section.id && !active
                    ? css.navItemHover
                    : {}),
                }}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {section.label}
                {section.id === "cart" && cartCount > 0 && (
                  <span style={navBadge}>{cartCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={css.snapshotCard}>
          <p style={css.snapshotLabel}>Live Balances</p>
          <SnapRow
            icon="⟠"
            label="ETH"
            value={Number(liveWallet?.ethBalance || 0).toFixed(4)}
          />
          <SnapRow
            icon="✦"
            label="Elixir"
            value={`${Number(liveWallet?.elixirBalance || 0).toFixed(0)} ✦`}
          />
          <SnapRow
            icon="RM"
            label="RM"
            value={`RM ${Number(wallet?.rmBalance || 0).toFixed(2)}`}
          />
        </div>

        {account && (
          <a
            href={`https://sepolia.etherscan.io/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            style={css.etherscanBtn}
            title="View your transactions on Etherscan"
          >
            🔍 Explore Etherscan
          </a>
        )}

        <button style={css.logoutBtn} onClick={logout}>
          ⎋ Sign Out
        </button>
      </aside>

      <main style={css.main}>
        <header style={css.header}>
          <div>
            <p style={css.headerKicker}>Customer Dashboard</p>
            <h2 style={css.headerTitle}>
              Welcome back,{" "}
              <span style={css.headerName}>{user?.name || "Customer"}</span>
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* MetaMask Connect Button */}
            {isConnected ? (
              <div style={metamaskStyles.connectedChip}>
                <div style={metamaskStyles.metamaskDot} />
                <div>
                  <p style={metamaskStyles.balanceText}>
                    {Number(ethBalance).toFixed(4)} ETH
                  </p>
                  <p style={metamaskStyles.addressText}>
                    {account.slice(0, 6)}…{account.slice(-4)}
                  </p>
                </div>
                <button
                  style={metamaskStyles.disconnectBtn}
                  onClick={disconnectWallet}
                  title="Disconnect MetaMask"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                style={metamaskStyles.connectBtn}
                onClick={connectWallet}
                disabled={connecting}
              >
                <span style={metamaskStyles.foxIcon}>🦊</span>
                {connecting ? "Connecting…" : "Connect MetaMask"}
              </button>
            )}
            {error && (
              <p style={metamaskStyles.errorText}>{error}</p>
            )}
            <div style={css.profileChip}>
              <div style={css.profileAvatar}>
                {(user?.name || "C")[0].toUpperCase()}
              </div>
              <div>
                <p style={css.chipRole}>{user?.role || "customer"}</p>
                <p style={css.chipAddress}>
                  {user?.walletAddress
                    ? `${user.walletAddress.slice(
                        0,
                        8,
                      )}…${user.walletAddress.slice(-6)}`
                    : "Wallet pending"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
