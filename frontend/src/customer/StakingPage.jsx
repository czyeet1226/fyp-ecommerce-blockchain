/**
 * frontend/src/pages/StakingPage.jsx
 *
 * Elixir Staking page — database-backed. Users stake Elixir tokens to earn
 * compound interest. Positions, rewards and history are persisted on the
 * backend (/api/staking). Displays staking performance, APY, compound
 * interest projections, and stake/unstake controls.
 */

import React, { useState, useMemo } from "react";
import { Section, BalanceCard, css } from "../dashboard/dashboardUi";
import { ELIXIR_TO_RM_RATE, fmt as fmtDefault } from "../dashboard/dashboardData";

const TIER_DESC = {
  30: "Flexible short-term",
  90: "Balanced returns",
  180: "High yield",
  365: "Maximum rewards",
};

function compoundAmount(principal, apy, days, frequency = 12) {
  const r = Number(apy) / 100;
  const t = Number(days) / 365;
  const n = frequency;
  return Number(principal) * Math.pow(1 + r / n, n * t);
}

export default function StakingPage({
  walletLedger,
  stakeData,
  stakeLoading,
  handleStake,
  handleUnstake,
  fmt: fmtProp,
}) {
  const format = fmtProp || fmtDefault;
  const elixirBalance = Number(walletLedger?.elixirBalance || 0);

  const tiers = stakeData?.tiers?.length
    ? stakeData.tiers
    : [
        { days: 30, apy: 8, label: "30 Days" },
        { days: 90, apy: 14, label: "90 Days" },
        { days: 180, apy: 22, label: "180 Days" },
        { days: 365, apy: 35, label: "365 Days" },
      ];
  const compoundFrequency = Number(stakeData?.compoundFrequency || 12);
  const positions = stakeData?.positions || [];
  const activePositions = positions.filter((p) => p.status === "active");

  const [selectedTierIdx, setSelectedTierIdx] = useState(1);
  const [stakeAmount, setStakeAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const tier = tiers[selectedTierIdx] || tiers[0];

  const totalStaked = Number(stakeData?.totalStaked || 0);
  const totalEarned = Number(stakeData?.totalEarned || 0);

  const projectedReward = useMemo(() => {
    const amount = Number(stakeAmount) || 0;
    if (amount <= 0 || !tier) return 0;
    return compoundAmount(amount, tier.apy, tier.days, compoundFrequency) - amount;
  }, [stakeAmount, tier, compoundFrequency]);

  const projectedTotal = useMemo(() => {
    const amount = Number(stakeAmount) || 0;
    if (amount <= 0 || !tier) return 0;
    return compoundAmount(amount, tier.apy, tier.days, compoundFrequency);
  }, [stakeAmount, tier, compoundFrequency]);

  async function onStake() {
    if (!tier) return;
    setBusy(true);
    const ok = await handleStake(Number(stakeAmount), tier.days);
    if (ok) setStakeAmount("");
    setBusy(false);
  }

  async function onUnstake(positionId) {
    setBusy(true);
    await handleUnstake(positionId);
    setBusy(false);
  }

  return (
    <Section label="Staking" title="Stake Elixir & Earn Compound Rewards">
      {/* Performance Overview */}
      <div style={css.balanceGrid}>
        <BalanceCard
          icon="✦"
          label="Available Elixir"
          value={`${format(elixirBalance, 0)} ✦`}
          sub={`≈ RM ${format(elixirBalance * ELIXIR_TO_RM_RATE, 2)}`}
          color="#0ea5e9"
        />
        <BalanceCard
          icon="🔒"
          label="Total Staked"
          value={`${format(totalStaked, 0)} ✦`}
          sub={`≈ RM ${format(totalStaked * ELIXIR_TO_RM_RATE, 2)}`}
          color="#8b5cf6"
        />
        <BalanceCard
          icon="📈"
          label="Total Earned"
          value={`+${format(totalEarned, 2)} ✦`}
          sub="Compound interest"
          color="#10b981"
        />
      </div>

      {/* Staking Tier Selection */}
      <div style={st.tierSection}>
        <h4 style={st.sectionTitle}>Select Staking Period</h4>
        <div style={st.tierGrid}>
          {tiers.map((t, idx) => {
            const active = idx === selectedTierIdx;
            return (
              <button
                key={t.days}
                style={{
                  ...st.tierCard,
                  ...(active ? st.tierCardActive : {}),
                }}
                onClick={() => setSelectedTierIdx(idx)}
              >
                <p style={st.tierApy}>{t.apy}%</p>
                <p style={st.tierApyLabel}>APY</p>
                <p style={st.tierLabel}>{t.label}</p>
                <p style={st.tierDesc}>{TIER_DESC[t.days] || ""}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compound Interest Calculator */}
      <div style={st.calcWidget}>
        <div style={st.calcHeader}>
          <h4 style={st.sectionTitle}>Stake Elixir</h4>
          <div style={st.compoundBadge}>
            <span style={st.compoundIcon}>🔄</span>
            Compounds Monthly ({compoundFrequency}x/year)
          </div>
        </div>

        <div style={st.calcBody}>
          <div style={st.inputSection}>
            <label style={css.inputLabel}>Amount to Stake (✦ Elixir)</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Enter Elixir amount"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              style={css.inputField}
            />
            <button
              style={st.maxBtn}
              onClick={() => setStakeAmount(String(Math.floor(elixirBalance)))}
            >
              MAX
            </button>
          </div>

          {Number(stakeAmount) > 0 && tier && (
            <div style={st.projectionCard}>
              <p style={st.projLabel}>Projected Returns ({tier.label})</p>
              <div style={st.projGrid}>
                <div style={st.projItem}>
                  <span style={st.projItemLabel}>Staked</span>
                  <strong style={st.projItemValue}>
                    {format(Number(stakeAmount), 0)} ✦
                  </strong>
                </div>
                <div style={st.projItem}>
                  <span style={st.projItemLabel}>Interest Earned</span>
                  <strong style={{ ...st.projItemValue, color: "#10b981" }}>
                    +{format(projectedReward, 2)} ✦
                  </strong>
                </div>
                <div style={st.projItem}>
                  <span style={st.projItemLabel}>Total After {tier.label}</span>
                  <strong style={{ ...st.projItemValue, color: "#38bdf8" }}>
                    {format(projectedTotal, 2)} ✦
                  </strong>
                </div>
                <div style={st.projItem}>
                  <span style={st.projItemLabel}>Effective Rate</span>
                  <strong style={{ ...st.projItemValue, color: "#fbbf24" }}>
                    {format(
                      (projectedTotal / Number(stakeAmount) - 1) * 100,
                      2,
                    )}
                    %
                  </strong>
                </div>
              </div>
            </div>
          )}

          <button
            style={{
              ...st.stakeBtn,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            onClick={onStake}
            disabled={busy}
          >
            {busy
              ? "Processing…"
              : `🔒 Stake ${stakeAmount || "0"} ✦ for ${tier?.label || ""} at ${
                  tier?.apy || 0
                }% APY`}
          </button>
        </div>
      </div>

      {/* Active Positions */}
      <div style={st.positionsSection}>
        <h4 style={st.sectionTitle}>Active Staking Positions</h4>
        {stakeLoading ? (
          <div style={css.loadingInline}>
            <div style={css.loadingSpinnerSm} />
            <span>Loading positions…</span>
          </div>
        ) : activePositions.length === 0 ? (
          <p style={st.emptyText}>
            No active staking positions. Stake Elixir above to start earning!
          </p>
        ) : (
          <div style={st.positionsList}>
            {activePositions.map((position) => {
              const progress = Math.min(
                (Number(position.elapsedDays) / Number(position.tierDays)) * 100,
                100,
              );
              const remaining = Math.max(
                Number(position.tierDays) - Number(position.elapsedDays),
                0,
              );
              return (
                <div key={position.id} style={st.positionCard}>
                  <div style={st.positionTop}>
                    <div>
                      <p style={st.positionAmount}>
                        {format(position.amount, 0)} ✦ Elixir
                      </p>
                      <p style={st.positionMeta}>
                        {position.tierDays} Days | {position.apy}% APY | Started{" "}
                        {new Date(position.stakedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={st.positionRight}>
                      <p style={st.earnedLabel}>Earned</p>
                      <p style={st.earnedValue}>+{format(position.earned, 2)} ✦</p>
                    </div>
                  </div>

                  <div style={st.progressTrack}>
                    <div style={{ ...st.progressFill, width: `${progress}%` }} />
                  </div>
                  <div style={st.progressLabels}>
                    <span>{format(position.elapsedDays, 0)} days elapsed</span>
                    <span>
                      {position.matured
                        ? "Mature!"
                        : `${format(remaining, 0)} days remaining`}
                    </span>
                  </div>

                  {position.matured && (
                    <button
                      style={{
                        ...st.unstakeBtn,
                        opacity: busy ? 0.6 : 1,
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                      onClick={() => onUnstake(position.id)}
                      disabled={busy}
                    >
                      Claim & Unstake (
                      {format(Number(position.amount) + Number(position.earned), 2)} ✦)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compound Interest Info */}
      <div style={st.infoCard}>
        <h4 style={st.infoTitle}>How Compound Interest Works</h4>
        <p style={st.infoText}>
          Your staked Elixir earns interest that compounds monthly. This means
          your rewards are added to your principal each month, so you earn
          interest on your interest.
        </p>
        <div style={st.formulaBox}>
          <p style={st.formulaLabel}>Formula: A = P(1 + r/n)^(nt)</p>
          <p style={st.formulaDesc}>
            P = Principal | r = Annual rate | n = Compounds per year (
            {compoundFrequency}) | t = Time in years
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = {
  tierSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 18,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  tierGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  tierCard: {
    padding: "18px 14px",
    borderRadius: 18,
    border: "1px solid rgba(148, 163, 184, 0.12)",
    background: "rgba(8, 15, 28, 0.6)",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s",
    display: "grid",
    gap: 4,
  },
  tierCardActive: {
    borderColor: "rgba(139, 92, 246, 0.5)",
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(14,165,233,0.08))",
    boxShadow: "0 0 20px rgba(139,92,246,0.15)",
  },
  tierApy: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    background: "linear-gradient(135deg, #8b5cf6, #38bdf8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  tierApyLabel: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#64748b",
  },
  tierLabel: {
    margin: "8px 0 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  tierDesc: {
    margin: "2px 0 0",
    fontSize: 11,
    color: "#64748b",
  },
  calcWidget: {
    padding: "22px 24px",
    borderRadius: 20,
    background: "rgba(8, 15, 28, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: 20,
  },
  calcHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  compoundBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(139, 92, 246, 0.1)",
    border: "1px solid rgba(139, 92, 246, 0.25)",
    color: "#a78bfa",
    fontSize: 12,
    fontWeight: 600,
  },
  compoundIcon: { fontSize: 13 },
  calcBody: {
    display: "grid",
    gap: 16,
  },
  inputSection: {
    position: "relative",
    display: "grid",
    gap: 8,
  },
  maxBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    padding: "5px 10px",
    borderRadius: 8,
    border: "1px solid rgba(14,165,233,0.3)",
    background: "rgba(14,165,233,0.1)",
    color: "#38bdf8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 11,
  },
  projectionCard: {
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(139, 92, 246, 0.15)",
  },
  projLabel: {
    margin: "0 0 12px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
  },
  projGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  projItem: {
    display: "grid",
    gap: 4,
  },
  projItemLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
  },
  projItemValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "#e2e8f0",
  },
  stakeBtn: {
    padding: "14px 18px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    transition: "all 0.15s",
  },
  positionsSection: {
    marginBottom: 20,
  },
  positionsList: {
    display: "grid",
    gap: 12,
  },
  positionCard: {
    padding: "18px 20px",
    borderRadius: 18,
    background: "rgba(8, 15, 28, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    display: "grid",
    gap: 12,
  },
  positionTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  positionAmount: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    color: "#f1f5f9",
  },
  positionMeta: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#64748b",
  },
  positionRight: {
    textAlign: "right",
  },
  earnedLabel: {
    margin: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#475569",
  },
  earnedValue: {
    margin: "2px 0 0",
    fontSize: 16,
    fontWeight: 800,
    color: "#10b981",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #8b5cf6, #38bdf8)",
    transition: "width 0.3s",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#64748b",
  },
  unstakeBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(16, 185, 129, 0.3)",
    background: "rgba(16, 185, 129, 0.1)",
    color: "#34d399",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    padding: "24px 0",
  },
  infoCard: {
    padding: "18px 20px",
    borderRadius: 18,
    background: "rgba(8, 15, 28, 0.4)",
    border: "1px solid rgba(148, 163, 184, 0.08)",
  },
  infoTitle: {
    margin: "0 0 8px",
    fontSize: 15,
    fontWeight: 800,
    color: "#e2e8f0",
  },
  infoText: {
    margin: "0 0 12px",
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  formulaBox: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(139, 92, 246, 0.15)",
  },
  formulaLabel: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#a78bfa",
    fontFamily: "'Fira Code', 'Consolas', monospace",
  },
  formulaDesc: {
    margin: "6px 0 0",
    fontSize: 11,
    color: "#64748b",
  },
};
