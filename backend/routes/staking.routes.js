/**
 * backend/routes/staking.routes.js
 *
 * Elixir Staking Endpoints (database-backed):
 *   GET  /api/staking/positions — list the customer's stake positions
 *   POST /api/staking/stake     — stake Elixir into a tier
 *   POST /api/staking/unstake   — claim principal + compound interest
 *
 * All positions and reward payouts are persisted in MySQL. Interest is
 * calculated with monthly compounding: A = P(1 + r/n)^(nt).
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const express = require("express");
const { ethers } = require("ethers");
const { mysqlDB } = require("../config/database");
const { authenticate } = require("../middleware/auth");
const {
  User,
  CustomerWallet,
  StakePosition,
  WalletTransaction,
  StakingTier,
} = require("../models/mysql.models");
const blockchainService = require("../config/blockchain");

const router = express.Router();

/**
 * Read the on-chain Elixir (LYT) balance for an address as whole units.
 * Elixir is a real ERC-20 token, so the customer's MetaMask on-chain balance
 * is authoritative. Used to mirror the balance into the DB after staking ops.
 */
async function readOnChainElixir(address) {
  if (!address) return 0;
  try {
    const wei = await blockchainService.getLytBalanceWei(address);
    return Number(ethers.formatUnits(wei, 18));
  } catch {
    return 0;
  }
}

// ── Staking tiers (admin-editable, stored in the DB) ───────────────────────
const DEFAULT_TIERS = [
  { days: 30, apy: 8, label: "30 Days" },
  { days: 90, apy: 14, label: "90 Days" },
  { days: 180, apy: 22, label: "180 Days" },
  { days: 365, apy: 35, label: "365 Days" },
];

const COMPOUND_FREQUENCY = 12; // compounds monthly
const DAY_MS = 24 * 60 * 60 * 1000;

// Read the current tiers from the DB (falls back to defaults if the table is
// empty / unavailable). The admin can edit each tier's APY.
async function getTiers() {
  try {
    const rows = await StakingTier.findAll({
      order: [
        ["sortOrder", "ASC"],
        ["days", "ASC"],
      ],
    });
    if (rows.length > 0) {
      return rows.map((t) => ({
        days: Number(t.days),
        apy: Number(t.apy),
        label: t.label,
      }));
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_TIERS;
}

async function findTier(days) {
  const tiers = await getTiers();
  return tiers.find((t) => Number(t.days) === Number(days));
}

/**
 * Compound interest amount: A = P(1 + r/n)^(nt)
 */
function compoundAmount(principal, apy, days, frequency = COMPOUND_FREQUENCY) {
  const r = Number(apy) / 100;
  const t = Number(days) / 365;
  const n = frequency;
  return Number(principal) * Math.pow(1 + r / n, n * t);
}

/**
 * Reward accrued so far for a position (capped at maturity).
 */
function accruedReward(position) {
  const elapsedDays = Math.min(
    (Date.now() - new Date(position.stakedAt).getTime()) / DAY_MS,
    Number(position.tierDays),
  );
  const total = compoundAmount(
    Number(position.amount),
    Number(position.apy),
    Math.max(elapsedDays, 0),
    Number(position.compoundFrequency) || COMPOUND_FREQUENCY,
  );
  return Math.max(total - Number(position.amount), 0);
}

function serializePosition(position) {
  const stakedAt = new Date(position.stakedAt).getTime();
  const maturityAt = new Date(position.maturityAt).getTime();
  const elapsedDays = (Date.now() - stakedAt) / DAY_MS;
  const matured = Date.now() >= maturityAt;
  const earned =
    position.status === "completed"
      ? Number(position.rewardPaid || 0)
      : accruedReward(position);

  return {
    id: position.id,
    amount: Number(position.amount),
    tierDays: Number(position.tierDays),
    apy: Number(position.apy),
    compoundFrequency: Number(position.compoundFrequency),
    stakedAt: position.stakedAt,
    maturityAt: position.maturityAt,
    status: position.status,
    rewardPaid: position.rewardPaid != null ? Number(position.rewardPaid) : null,
    earned: Number(earned.toFixed(8)),
    elapsedDays: Math.max(Number(elapsedDays.toFixed(2)), 0),
    matured,
    projectedTotal: Number(
      compoundAmount(
        Number(position.amount),
        Number(position.apy),
        Number(position.tierDays),
      ).toFixed(8),
    ),
  };
}

async function getCustomerAndWallet(userId) {
  const customer = await User.findByPk(userId);
  if (!customer || customer.role !== "customer") {
    const err = new Error("Only customers can stake");
    err.status = 403;
    throw err;
  }
  const wallet = await CustomerWallet.findOne({
    where: { userCode: customer.userCode },
  });
  if (!wallet) {
    const err = new Error("Customer wallet not found");
    err.status = 404;
    throw err;
  }
  return { customer, wallet };
}

// ── GET /api/staking/positions ─────────────────────────────────────────────

router.get("/positions", authenticate, async (req, res) => {
  try {
    const customer = await User.findByPk(req.user.id);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const positions = await StakePosition.findAll({
      where: { userCode: customer.userCode },
      order: [["createdAt", "DESC"]],
    });

    const serialized = positions.map(serializePosition);

    const totalStaked = serialized
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalEarned = serialized
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + p.earned, 0);

    const tiers = await getTiers();

    return res.json({
      success: true,
      tiers,
      compoundFrequency: COMPOUND_FREQUENCY,
      positions: serialized,
      totalStaked: Number(totalStaked.toFixed(8)),
      totalEarned: Number(totalEarned.toFixed(8)),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/staking/stake ─────────────────────────────────────────────────

router.post("/stake", authenticate, async (req, res) => {
  const transaction = await mysqlDB.transaction();

  try {
    const { amount, tierDays, txHash } = req.body;
    const stakeAmount = Number(amount);

    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Valid Elixir amount is required" });
    }

    const tier = await findTier(tierDays);
    if (!tier) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid staking tier" });
    }

    const { customer, wallet } = await getCustomerAndWallet(req.user.id);

    if (!customer.metamaskAddress) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to stake Elixir",
      });
    }

    // The customer must have already sent the staked LYT to the admin
    // (staking pool) via MetaMask. Verify that on-chain deposit.
    try {
      await blockchainService.verifyLytTransfer(
        txHash,
        blockchainService.adminAddress,
        stakeAmount,
      );
    } catch (verifyErr) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Elixir stake deposit could not be verified: ${verifyErr.message}`,
      });
    }

    const stakedAt = new Date();
    const maturityAt = new Date(stakedAt.getTime() + tier.days * DAY_MS);

    const position = await StakePosition.create(
      {
        userCode: customer.userCode,
        amount: stakeAmount,
        tierDays: tier.days,
        apy: tier.apy,
        compoundFrequency: COMPOUND_FREQUENCY,
        stakedAt,
        maturityAt,
        status: "active",
      },
      { transaction },
    );

    await WalletTransaction.create(
      {
        userCode: customer.userCode,
        type: "STAKE",
        fromCurrency: "ELIXIR",
        fromAmount: stakeAmount,
        counterparty: "staking-pool",
        txHash: txHash || null,
        note: `Staked for ${tier.label} at ${tier.apy}% APY`,
        status: "completed",
      },
      { transaction },
    );

    // Mirror the customer's resulting on-chain Elixir balance into the DB.
    const nextElixir = Number(
      (await readOnChainElixir(customer.metamaskAddress)).toFixed(8),
    );
    await wallet.update({ Elixir: nextElixir }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: `Staked ${stakeAmount} Elixir for ${tier.label} at ${tier.apy}% APY`,
      position: serializePosition(position),
      lytBalance: String(nextElixir),
    });
  } catch (err) {
    await transaction.rollback();
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

// ── POST /api/staking/unstake ────────────────────────────────────────────────

router.post("/unstake", authenticate, async (req, res) => {
  const transaction = await mysqlDB.transaction();

  try {
    const { positionId } = req.body;
    if (!positionId) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Position id is required" });
    }

    const { customer, wallet } = await getCustomerAndWallet(req.user.id);

    const position = await StakePosition.findOne({
      where: { id: positionId, userCode: customer.userCode },
    });
    if (!position) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Stake position not found" });
    }
    if (position.status !== "active") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Position already unstaked" });
    }
    if (Date.now() < new Date(position.maturityAt).getTime()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Position has not matured yet",
      });
    }

    if (!customer.metamaskAddress) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to receive your Elixir",
      });
    }

    const reward = Number(accruedReward(position).toFixed(8));
    const principal = Number(position.amount);
    const payout = Number((principal + reward).toFixed(8));

    // The admin (staking pool / treasury) returns principal + interest as
    // real LYT tokens to the customer's MetaMask wallet.
    let payoutTx;
    try {
      payoutTx = await blockchainService.sendLytFromAdmin(
        customer.metamaskAddress,
        payout,
      );
    } catch (payErr) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: `Elixir payout failed: ${payErr.message}`,
      });
    }

    await position.update(
      { status: "completed", rewardPaid: reward },
      { transaction },
    );

    await WalletTransaction.create(
      {
        userCode: customer.userCode,
        type: "UNSTAKE",
        toCurrency: "ELIXIR",
        toAmount: payout,
        counterparty: "staking-pool",
        txHash: payoutTx || null,
        note: `Unstaked ${principal} Elixir + ${reward} reward`,
        status: "completed",
      },
      { transaction },
    );

    // Mirror the customer's resulting on-chain Elixir balance into the DB.
    const nextElixir = Number(
      (await readOnChainElixir(customer.metamaskAddress)).toFixed(8),
    );
    await wallet.update({ Elixir: nextElixir }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: `Claimed ${payout} Elixir (${principal} principal + ${reward} reward)`,
      principal,
      reward,
      payout,
      txHash: payoutTx || null,
      lytBalance: String(nextElixir),
    });
  } catch (err) {
    await transaction.rollback();
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

module.exports = router;
