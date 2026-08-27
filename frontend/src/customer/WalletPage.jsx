import React, { useState } from "react";
import {
  CURRENCIES,
  ELIXIR_TO_RM_RATE,
  ETH_USD_CHANGE_24H,
  LIVE_RM_PER_ETH,
  LIVE_USD_PER_ETH,
  LIVE_USD_PER_RM,
  RM_TO_ELIXIR_RATE,
  RM_USD_CHANGE_24H,
} from "../dashboard/dashboardData";
import { BalanceCard, css, Section } from "../dashboard/dashboardUi";

const WALLET_TABS = [
  { key: "swap", label: "Currency Swap", icon: "💱" },
  { key: "deposit", label: "Deposit", icon: "📥" },
  { key: "transfer", label: "Transfer", icon: "📤" },
];

const CURRENCY_META = {
  ETH: { label: "ETH", icon: "⟠", color: "#7c3aed" },
  ELIXIR: { label: "Elixir", icon: "✦", color: "#0ea5e9" },
  RM: { label: "RM", icon: "RM", color: "#10b981" },
};

export default function WalletPage({
  liveWallet,
  walletLedger,
  wallet,
  swapFrom,
  setSwapFrom,
  swapTo,
  setSwapTo,
  swapAmount,
  setSwapAmount,
  swapPreview,
  swapBusy,
  depositRm,
  setDepositRm,
  transferAddress,
  setTransferAddress,
  transferElixir,
  setTransferElixir,
  transferCurrency,
  setTransferCurrency,
  transferBusy,
  walletMessage,
  handleDeposit,
  handleTransfer,
  handleSwap,
  metamaskConnected,
  connectMetamask,
  fmt,
}) {
  const transferEthNeedsWallet = transferCurrency === "ETH" && !metamaskConnected;
  const ethNeedsWallet =
    (swapFrom === "ETH" || swapTo === "ETH") && !metamaskConnected;

  // Prevent selecting the same currency on both sides
  const handleFromChange = (value) => {
    setSwapFrom(value);
    if (value === swapTo) {
      const alt = CURRENCIES.find((c) => c.code !== value);
      if (alt) setSwapTo(alt.code);
    }
  };

  const handleToChange = (value) => {
    setSwapTo(value);
    if (value === swapFrom) {
      const alt = CURRENCIES.find((c) => c.code !== value);
      if (alt) setSwapFrom(alt.code);
    }
  };

  const handleFlip = () => {
    setSwapFrom(swapTo);
    setSwapTo(swapFrom);
    setSwapAmount("");
  };

  const [activeTab, setActiveTab] = useState("swap");

  return (
    <Section label="Wallet" title="Balances, Swap & Transfers">
      <div style={css.balanceGrid}>
        <BalanceCard
          icon="⟠"
          label="ETH Balance"
          value={fmt(liveWallet.ethBalance, 4)}
          sub={
            metamaskConnected
              ? `🦊 MetaMask · ≈ RM ${fmt(liveWallet.rmEquivalent, 2)}`
              : `≈ RM ${fmt(liveWallet.rmEquivalent, 2)}`
          }
          color="#7c3aed"
        />
        <BalanceCard
          icon="✦"
          label="Elixir Balance"
          value={`${fmt(walletLedger.elixirBalance, 0)} ✦`}
          sub={`≈ RM ${fmt(walletLedger.elixirBalance * ELIXIR_TO_RM_RATE, 2)}`}
          color="#0ea5e9"
        />
        <BalanceCard
          icon="RM"
          label="RM Balance"
          value={`RM ${fmt(wallet?.rmBalance, 2)}`}
          sub={`≈ ${fmt(
            Number(wallet?.rmBalance || 0) * RM_TO_ELIXIR_RATE,
            2,
          )} ✦ Elixir`}
          color="#10b981"
        />
      </div>

      {/* Clean nav bar: Currency Swap / Deposit / Transfer */}
      <div style={css.walletNavBar}>
        {WALLET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            style={{
              ...css.walletNavBtn,
              ...(activeTab === tab.key ? css.walletNavBtnActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "swap" && (
        <div style={css.swapLayout}>
          {/* Left: swap feature */}
          <div style={{ ...css.swapWidget, marginBottom: 0 }}>
            <div style={css.swapWidgetHeader}>
              <h4 style={css.swapTitle}>💱 Currency Swap</h4>
              <p style={css.swapRate}>
                1 ETH = RM {LIVE_RM_PER_ETH.toLocaleString()} &nbsp;|&nbsp; 1 ✦ = RM{" "}
                {ELIXIR_TO_RM_RATE}
              </p>
            </div>

            {/* From / To dropdowns */}
            <div style={s.swapRow}>
              <div style={s.swapField}>
                <label style={css.inputLabel}>From</label>
                <select
                  value={swapFrom}
                  onChange={(e) => handleFromChange(e.target.value)}
                  style={css.selectField}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                style={s.flipBtn}
                onClick={handleFlip}
                title="Swap direction"
                type="button"
              >
                ⇄
              </button>

              <div style={s.swapField}>
                <label style={css.inputLabel}>To</label>
                <select
                  value={swapTo}
                  onChange={(e) => handleToChange(e.target.value)}
                  style={css.selectField}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={css.swapInputRow}>
              <div style={css.swapInputGroup}>
                <label style={css.inputLabel}>
                  {CURRENCY_META[swapFrom]?.label} amount
                </label>
                <input
                  type="number"
                  min="0"
                  step={swapFrom === "ETH" ? "0.0001" : swapFrom === "RM" ? "0.01" : "1"}
                  placeholder="0.00"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  style={css.inputField}
                />
              </div>

              {swapPreview && (
                <div style={css.swapPreviewBox}>
                  <p style={css.swapPreviewLabel}>You receive</p>
                  <p style={css.swapPreviewValue}>{swapPreview.to}</p>
                </div>
              )}
            </div>

            {ethNeedsWallet && (
              <div style={s.metamaskHint}>
                <span>🦊</span>
                <span>Connect MetaMask to swap ETH.</span>
                <button style={s.connectInline} onClick={connectMetamask}>
                  Connect
                </button>
              </div>
            )}

            {swapFrom === "ETH" && metamaskConnected && (
              <p style={s.ethNote}>
                Swapping ETH will send it from your MetaMask wallet to the
                platform, reducing your MetaMask balance.
              </p>
            )}
            {swapTo === "ETH" && metamaskConnected && (
              <p style={s.ethNote}>
                ETH will be paid out to your connected MetaMask wallet.
              </p>
            )}

            <button
              style={{
                ...css.swapBtn,
                opacity: swapBusy || ethNeedsWallet ? 0.6 : 1,
                cursor: swapBusy || ethNeedsWallet ? "not-allowed" : "pointer",
              }}
              onClick={handleSwap}
              disabled={swapBusy || ethNeedsWallet}
            >
              {swapBusy
                ? "Processing…"
                : `⇄ Swap${swapPreview ? ` ${swapPreview.from} → ${swapPreview.to}` : ""}`}
            </button>
          </div>

          {/* Right: ETH/USD and RM/USD performance */}
          <div style={css.priceTickerPanel}>
            <p style={css.priceTickerTitle}>Market Performance</p>

            <div style={css.priceTickerRow}>
              <div style={css.priceTickerLeft}>
                <div
                  style={{
                    ...css.priceTickerIcon,
                    background: "#7c3aed20",
                    color: "#7c3aed",
                  }}
                >
                  ⟠
                </div>
                <div>
                  <p style={css.priceTickerPair}>ETH / USD</p>
                  <p style={css.priceTickerSub}>Ethereum</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={css.priceTickerValue}>
                  ${LIVE_USD_PER_ETH.toLocaleString()}
                </p>
                <p
                  style={{
                    ...css.priceTickerChange,
                    color: ETH_USD_CHANGE_24H >= 0 ? "#34d399" : "#f87171",
                  }}
                >
                  {ETH_USD_CHANGE_24H >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(ETH_USD_CHANGE_24H)}% 24h
                </p>
              </div>
            </div>

            <div style={css.priceTickerRow}>
              <div style={css.priceTickerLeft}>
                <div
                  style={{
                    ...css.priceTickerIcon,
                    background: "#10b98120",
                    color: "#10b981",
                  }}
                >
                  RM
                </div>
                <div>
                  <p style={css.priceTickerPair}>RM / USD</p>
                  <p style={css.priceTickerSub}>Malaysian Ringgit</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={css.priceTickerValue}>
                  ${LIVE_USD_PER_RM.toFixed(3)}
                </p>
                <p
                  style={{
                    ...css.priceTickerChange,
                    color: RM_USD_CHANGE_24H >= 0 ? "#34d399" : "#f87171",
                  }}
                >
                  {RM_USD_CHANGE_24H >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(RM_USD_CHANGE_24H)}% 24h
                </p>
              </div>
            </div>

            <p style={s.ethNote}>
              Reference rates for gauging currency performance. Not connected
              to a live price feed.
            </p>
          </div>
        </div>
      )}

      {activeTab === "deposit" && (
        <div style={css.walletActionCard}>
          <h4 style={css.walletActionTitle}>📥 Deposit RM</h4>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount (RM)"
            value={depositRm}
            onChange={(e) => setDepositRm(e.target.value)}
            style={css.inputField}
          />
          <button style={css.actionBtn} onClick={handleDeposit}>
            Deposit
          </button>
        </div>
      )}

      {activeTab === "transfer" && (
        <div style={css.walletActionCard}>
          <h4 style={css.walletActionTitle}>📤 Transfer Funds</h4>

          <select
            value={transferCurrency}
            onChange={(e) => setTransferCurrency(e.target.value)}
            style={css.selectField}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder={
              transferCurrency === "ETH"
                ? "Recipient MetaMask wallet address"
                : "Recipient wallet address"
            }
            value={transferAddress}
            onChange={(e) => setTransferAddress(e.target.value)}
            style={{ ...css.inputField, marginTop: 8 }}
          />
          <input
            type="number"
            min="0"
            step={transferCurrency === "ETH" ? "0.0001" : transferCurrency === "RM" ? "0.01" : "1"}
            placeholder={`${CURRENCY_META[transferCurrency]?.label} amount`}
            value={transferElixir}
            onChange={(e) => setTransferElixir(e.target.value)}
            style={{ ...css.inputField, marginTop: 8 }}
          />

          {transferEthNeedsWallet && (
            <div style={{ ...s.metamaskHint, marginTop: 8 }}>
              <span>🦊</span>
              <span>Connect MetaMask to transfer ETH.</span>
              <button style={s.connectInline} onClick={connectMetamask}>
                Connect
              </button>
            </div>
          )}

          {transferCurrency === "ETH" && metamaskConnected && (
            <p style={{ ...s.ethNote, marginTop: 8 }}>
              ETH is sent directly from your MetaMask wallet to the recipient
              address on-chain.
            </p>
          )}

          <button
            style={{
              ...css.actionBtn,
              marginTop: 8,
              background:
                CURRENCY_META[transferCurrency]?.color === "#10b981"
                  ? "linear-gradient(135deg, #10b981, #34d399)"
                  : CURRENCY_META[transferCurrency]?.color === "#7c3aed"
                  ? "linear-gradient(135deg, #7c3aed, #a78bfa)"
                  : "linear-gradient(135deg, #0ea5e9, #38bdf8)",
              opacity: transferBusy || transferEthNeedsWallet ? 0.6 : 1,
              cursor:
                transferBusy || transferEthNeedsWallet
                  ? "not-allowed"
                  : "pointer",
            }}
            onClick={handleTransfer}
            disabled={transferBusy || transferEthNeedsWallet}
          >
            {transferBusy
              ? "Processing…"
              : `Transfer ${CURRENCY_META[transferCurrency]?.icon || ""}`}
          </button>
        </div>
      )}

      {walletMessage.text && (
        <div
          style={{
            ...css.walletToast,
            background:
              walletMessage.type === "success"
                ? "rgba(16, 185, 129, 0.12)"
                : walletMessage.type === "error"
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(56, 189, 248, 0.12)",
            borderColor:
              walletMessage.type === "success"
                ? "rgba(52, 211, 153, 0.3)"
                : walletMessage.type === "error"
                ? "rgba(248, 113, 113, 0.3)"
                : "rgba(125, 211, 252, 0.3)",
            color:
              walletMessage.type === "success"
                ? "#34d399"
                : walletMessage.type === "error"
                ? "#fca5a5"
                : "#7dd3fc",
          }}
        >
          {walletMessage.type === "success"
            ? "✓"
            : walletMessage.type === "error"
            ? "⚠"
            : "ℹ"}{" "}
          {walletMessage.text}
        </div>
      )}
    </Section>
  );
}

const s = {
  swapRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 12,
    alignItems: "end",
  },
  swapField: {
    display: "grid",
    gap: 8,
  },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(125, 211, 252, 0.25)",
    background: "rgba(14,165,233,0.1)",
    color: "#38bdf8",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 800,
    alignSelf: "end",
  },
  metamaskHint: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.25)",
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: 600,
  },
  connectInline: {
    marginLeft: "auto",
    padding: "6px 14px",
    borderRadius: 10,
    border: "1px solid rgba(245,158,11,0.4)",
    background: "rgba(245,158,11,0.15)",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  ethNote: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
  },
};
