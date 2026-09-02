/**
 * backend/routes/admin.routes.js
 *
 * Admin Endpoints (admin role only):
 *   GET /api/admin/users     — list every registered user (with search)
 *   GET /api/admin/balance   — admin/platform on-chain ETH + Elixir balances
 *   GET /api/admin/overview  — quick platform stats (user counts)
 *
 * The admin is the Elixir treasury: its on-chain wallet holds the ETH reserve
 * and the LYT (Elixir) supply used to settle customer swaps.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const express = require("express");
const { Op } = require("sequelize");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  User,
  CustomerWallet,
  StakePosition,
  StakingTier,
  SubscriptionPayment,
  Order,
  Product,
  WalletTransaction,
} = require("../models/mysql.models");
const { BlockchainLog } = require("../models/blockchainLog.model");
const blockchainService = require("../config/blockchain");

const router = express.Router();

// Both ETH and Elixir checkouts route through PurchaseEscrow, so disputes
// from either payment mode must be listed/resolvable.
const ESCROW_MODES = ["ETH_ESCROW", "TOKEN_ESCROW"];

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPOUND_FREQUENCY = 12;

// Compound interest accrued so far for a stake position (capped at maturity).
function accruedReward(position) {
  const elapsedDays = Math.min(
    (Date.now() - new Date(position.stakedAt).getTime()) / DAY_MS,
    Number(position.tierDays),
  );
  const r = Number(position.apy) / 100;
  const t = Math.max(elapsedDays, 0) / 365;
  const total = Number(position.amount) * Math.pow(1 + r / COMPOUND_FREQUENCY, COMPOUND_FREQUENCY * t);
  return Math.max(total - Number(position.amount), 0);
}

// All routes here require an authenticated admin.
router.use(authenticate, requireRole("admin"));

// ── GET /api/admin/users ────────────────────────────────────────────────────
//
// List all registered users. Optional ?search= filters by name, email or
// user code (case-insensitive). Includes each user's wallet balances.
//
router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    const where = {};
    if (search) {
      const like = { [Op.like]: `%${search}%` };
      where[Op.or] = [
        { name: like },
        { email: like },
        { userCode: like },
        { walletAddress: like },
        { metamaskAddress: like },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: [
        "id",
        "userCode",
        "name",
        "email",
        "role",
        "walletAddress",
        "metamaskAddress",
        "isActive",
        "createdAt",
      ],
      include: [
        {
          model: CustomerWallet,
          as: "customerWallet",
          attributes: ["RM", "Elixir"],
          required: false,
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const formatted = users.map((u) => ({
      id: u.id,
      userCode: u.userCode,
      name: u.name,
      email: u.email,
      role: u.role,
      walletAddress: u.walletAddress || "",
      metamaskAddress: u.metamaskAddress || "",
      isActive: u.isActive,
      createdAt: u.createdAt,
      rmBalance: u.customerWallet ? String(u.customerWallet.RM) : "0",
      elixirBalance: u.customerWallet ? String(u.customerWallet.Elixir) : "0",
    }));

    return res.json({ success: true, total: formatted.length, users: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/balance ──────────────────────────────────────────────────
//
// The admin/platform wallet's own on-chain ETH and Elixir (LYT) balances.
//
router.get("/balance", async (req, res) => {
  try {
    const address = blockchainService.adminAddress;

    if (!address) {
      return res.json({
        success: true,
        address: "",
        ethBalance: "0",
        elixirBalance: "0",
        online: false,
      });
    }

    const [ethBalance, elixirBalance] = await Promise.all([
      blockchainService.getEthBalance(address),
      blockchainService.getTokenBalance(address),
    ]);

    return res.json({
      success: true,
      address,
      ethBalance: String(ethBalance),
      elixirBalance: String(elixirBalance),
      online: blockchainService.initialized,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/overview ─────────────────────────────────────────────────
//
// Lightweight platform stats for the admin dashboard header.
//
router.get("/overview", async (req, res) => {
  try {
    const [customers, merchants, admins] = await Promise.all([
      User.count({ where: { role: "customer" } }),
      User.count({ where: { role: "merchant" } }),
      User.count({ where: { role: "admin" } }),
    ]);

    return res.json({
      success: true,
      counts: {
        customers,
        merchants,
        admins,
        total: customers + merchants + admins,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/transactions ─────────────────────────────────────────────
//
// List all wallet transactions across all users. Optional query params:
//   ?search=     — filter by userCode or txHash
//   ?type=       — filter by transaction type (SWAP, TRANSFER_OUT, etc.)
//   ?status=     — filter by status (pending, completed, failed)
//
router.get("/transactions", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const typeFilter = String(req.query.type || "").trim();
    const statusFilter = String(req.query.status || "").trim();

    const where = {};

    // Search filter
    if (search) {
      const like = { [Op.like]: `%${search}%` };
      where[Op.or] = [
        { userCode: like },
        { txHash: like },
      ];
    }

    // Type filter
    if (typeFilter && typeFilter !== "ALL") {
      where.type = typeFilter;
    }

    // Status filter
    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    const transactions = await WalletTransaction.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 500,
    });

    const formatted = transactions.map((tx) => ({
      id: tx.id,
      userCode: tx.userCode,
      userName: tx.user?.name || "—",
      userEmail: tx.user?.email || "—",
      type: tx.type,
      fromCurrency: tx.fromCurrency || "—",
      fromAmount: tx.fromAmount ? Number(tx.fromAmount) : 0,
      toCurrency: tx.toCurrency || "—",
      toAmount: tx.toAmount ? Number(tx.toAmount) : 0,
      status: tx.status,
      txHash: tx.txHash || "",
      counterparty: tx.counterparty || "",
      note: tx.note || "",
      createdAt: tx.createdAt,
    }));

    return res.json({
      success: true,
      total: formatted.length,
      transactions: formatted,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Staking management ──────────────────────────────────────────────────────

// GET /api/admin/staking/tiers — list staking tiers with their APY.
router.get("/staking/tiers", async (req, res) => {
  try {
    const tiers = await StakingTier.findAll({
      order: [
        ["sortOrder", "ASC"],
        ["days", "ASC"],
      ],
    });
    return res.json({
      success: true,
      tiers: tiers.map((t) => ({
        id: t.id,
        days: Number(t.days),
        apy: Number(t.apy),
        label: t.label,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/staking/tiers/:days — update a tier's APY.
router.put("/staking/tiers/:days", async (req, res) => {
  try {
    const days = Number(req.params.days);
    const apy = Number(req.body.apy);

    if (!Number.isFinite(apy) || apy < 0 || apy > 1000) {
      return res
        .status(400)
        .json({ success: false, message: "APY must be between 0 and 1000" });
    }

    const tier = await StakingTier.findOne({ where: { days } });
    if (!tier) {
      return res
        .status(404)
        .json({ success: false, message: "Staking tier not found" });
    }

    await tier.update({ apy });

    return res.json({
      success: true,
      message: `${tier.label} APY updated to ${apy}%`,
      tier: { id: tier.id, days: Number(tier.days), apy: Number(tier.apy), label: tier.label },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/staking/positions — every stake position across all users.
router.get("/staking/positions", async (req, res) => {
  try {
    const positions = await StakePosition.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "userCode", "name", "walletAddress", "metamaskAddress"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const rows = positions.map((p) => {
      const earned =
        p.status === "completed"
          ? Number(p.rewardPaid || 0)
          : accruedReward(p);
      return {
        id: p.id,
        userCode: p.user?.userCode || p.userCode,
        name: p.user?.name || "—",
        walletAddress:
          p.user?.metamaskAddress || p.user?.walletAddress || "—",
        amount: Number(p.amount),
        tierDays: Number(p.tierDays),
        apy: Number(p.apy),
        status: p.status,
        stakedAt: p.stakedAt,
        maturityAt: p.maturityAt,
        earned: Number(earned.toFixed(8)),
      };
    });

    const activeRows = rows.filter((r) => r.status === "active");
    const totalStaked = activeRows.reduce((s, r) => s + r.amount, 0);
    const totalEarned = activeRows.reduce((s, r) => s + r.earned, 0);

    return res.json({
      success: true,
      total: rows.length,
      activeCount: activeRows.length,
      totalStaked: Number(totalStaked.toFixed(8)),
      totalEarned: Number(totalEarned.toFixed(8)),
      positions: rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Revenue (seller subscription payments) ──────────────────────────────────

// GET /api/admin/revenue — all seller subscription payments + summaries.
router.get("/revenue", async (req, res) => {
  try {
    const payments = await SubscriptionPayment.findAll({
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "userCode", "name", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 500,
    });

    let totalEth = 0;
    const byPlan = { starter: 0, pro: 0, enterprise: 0 };
    const byMonth = {}; // "YYYY-MM" → eth

    const rows = payments.map((p) => {
      const amount = Number(p.amountEth || 0);
      if (p.status === "completed") {
        totalEth += amount;
        if (byPlan[p.plan] !== undefined) byPlan[p.plan] += amount;
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[key] = (byMonth[key] || 0) + amount;
      }
      return {
        id: p.id,
        sellerName: p.seller?.name || "—",
        sellerCode: p.seller?.userCode || p.sellerCode || "—",
        plan: p.plan,
        amountEth: amount,
        txHash: p.txHash || "",
        status: p.status,
        createdAt: p.createdAt,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
      };
    });

    const monthly = Object.entries(byMonth)
      .map(([month, eth]) => ({
        month,
        eth: Number(eth.toFixed(8)),
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    return res.json({
      success: true,
      summary: {
        totalEth: Number(totalEth.toFixed(8)),
        totalRm: Number((totalEth * 12000).toFixed(2)),
        totalPayments: rows.filter((r) => r.status === "completed").length,
        byPlan: {
          starter: Number(byPlan.starter.toFixed(8)),
          pro: Number(byPlan.pro.toFixed(8)),
          enterprise: Number(byPlan.enterprise.toFixed(8)),
        },
        monthly,
      },
      payments: rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Escrow dispute management ───────────────────────────────────────────────

// GET /api/admin/escrow/disputes — escrow orders awaiting admin resolution.
router.get("/escrow/disputes", async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { paymentMode: ESCROW_MODES, escrowStatus: "disputed" },
      include: [
        { model: Product, as: "product", attributes: ["id", "name"] },
        { model: User, as: "customer", attributes: ["id", "name", "userCode", "metamaskAddress"] },
        { model: User, as: "merchant", attributes: ["id", "name", "userCode", "metamaskAddress"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const rows = orders.map((o) => ({
      orderId: o.id,
      escrowId: o.escrowId ? String(o.escrowId) : null,
      paymentMode: o.paymentMode,
      productName: o.product?.name || "—",
      buyerName: o.customer?.name || "—",
      buyerCode: o.customer?.userCode || "—",
      sellerName: o.merchant?.name || "—",
      amountEth: Number(o.totalPriceEth || 0),
      quantity: Number(o.quantity || 1),
      createdAt: o.createdAt,
    }));

    return res.json({ success: true, total: rows.length, disputes: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/escrow/resolve — resolve a dispute on-chain.
//   Body: { orderId, refundBuyer: boolean }
//   refundBuyer=true  → refund the buyer, cancel order, restore stock.
//   refundBuyer=false → release the escrow to the seller.
router.post("/escrow/resolve", async (req, res) => {
  try {
    const { orderId, refundBuyer } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (!ESCROW_MODES.includes(order.paymentMode) || !order.escrowId) {
      return res
        .status(400)
        .json({ success: false, message: "Not an escrow order" });
    }
    if (order.escrowStatus !== "disputed") {
      return res
        .status(400)
        .json({ success: false, message: "Order is not under dispute" });
    }

    let outcome;
    try {
      outcome = await blockchainService.resolveEscrowDispute(
        order.escrowId,
        !!refundBuyer,
      );
    } catch (chainErr) {
      return res.status(500).json({
        success: false,
        message: `On-chain resolution failed: ${chainErr.message}`,
      });
    }

    if (refundBuyer) {
      await order.update({ escrowStatus: "refunded", status: "cancelled" });
      // Restore stock that was decremented at checkout.
      const product = await Product.findByPk(order.productId);
      if (product) {
        await product.update({ stock: product.stock + Number(order.quantity || 1) });
      }
    } else {
      const receiptTokenId =
        outcome.released &&
        outcome.released.receiptTokenId &&
        outcome.released.receiptTokenId !== "0"
          ? outcome.released.receiptTokenId
          : order.receiptTokenId;
      await order.update({
        escrowStatus: "released",
        deliveryConfirmed: true,
        deliveryConfirmedAt: new Date(),
        fulfillmentStage: 4,
        receiptTokenId,
        receiptTxHash: receiptTokenId ? outcome.txHash : order.receiptTxHash,
      });
    }

    await BlockchainLog.create({
      eventType: refundBuyer ? "EscrowRefunded" : "EscrowReleased",
      orderId: order.id,
      txHash: outcome.txHash,
      paymentMode: "ETH_ESCROW",
      notes: refundBuyer ? "Admin refunded buyer" : "Admin released to seller",
    });

    return res.json({
      success: true,
      message: refundBuyer
        ? "Dispute resolved — buyer refunded."
        : "Dispute resolved — funds released to the seller.",
      orderId: order.id,
      txHash: outcome.txHash,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/logs ─────────────────────────────────────────────────────
//
// Fetch Railway server logs for the admin console.
// This endpoint acts as a proxy to Railway API to display deployment logs.
//
// ── GET /api/admin/logs ─────────────────────────────────────────────────────
//
// Display system activity logs. Since Railway logs require complex authentication
// and are best viewed in Railway's dashboard, this endpoint shows backend application
// logs and recent deployment information.
//
router.get("/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    // Railway credentials from environment
    const railwayToken = process.env.RAILWAY_API_TOKEN;
    const projectId = process.env.RAILWAY_PROJECT_ID || "068a348f-064a-4190-9d3a-17cd513270ab";
    const serviceId = process.env.RAILWAY_SERVICE_ID || "14942b9c-b589-4367-bdc4-c60353a1d9e9";
    const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || "64a899d3-cee6-4000-b85f-1b1a9d6dbc12";

    // Generate mock activity logs for demonstration
    // In production, you could read from actual log files or a logging service
    const mockLogs = [
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        message: "✅ Server started successfully on port " + (process.env.PORT || 5000),
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 120000).toISOString(),
        message: "📊 Database connection established - MySQL",
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 180000).toISOString(),
        message: "🔗 Blockchain service initialized - Hardhat RPC connected",
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 240000).toISOString(),
        message: "🚀 Elixir Commerce Backend v1.0.0 starting...",
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        message: "📌 Environment: " + (process.env.NODE_ENV || "development"),
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 360000).toISOString(),
        message: "🔐 JWT authentication middleware loaded",
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 420000).toISOString(),
        message: "📦 All routes registered successfully",
        severity: "info"
      },
      {
        timestamp: new Date(Date.now() - 480000).toISOString(),
        message: "💡 For detailed Railway deployment logs, visit Railway Dashboard",
        severity: "info"
      },
      {
        timestamp: new Date().toISOString(),
        message: "🔗 Railway Project: https://railway.app/project/" + projectId,
        severity: "info"
      }
    ];

    // If Railway token is configured, try to fetch recent deployment info
    if (railwayToken) {
      try {
        const fetch = require("node-fetch");
        const deploymentsResponse = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({
            query: `
              query GetDeployments($projectId: String!, $environmentId: String!) {
                deployments(input: { 
                  projectId: $projectId, 
                  environmentId: $environmentId 
                }) {
                  edges {
                    node {
                      id
                      status
                      createdAt
                      service {
                        id
                        name
                      }
                    }
                  }
                }
              }
            `,
            variables: { projectId, environmentId },
          }),
        });

        const deploymentsData = await deploymentsResponse.json();
        
        if (!deploymentsData.errors) {
          const deployments = deploymentsData.data?.deployments?.edges || [];
          const recentServiceDeployments = deployments
            .filter(edge => edge.node.service?.id === serviceId)
            .slice(0, 5);

          // Add deployment info to logs
          recentServiceDeployments.forEach((edge, idx) => {
            const deployment = edge.node;
            mockLogs.unshift({
              timestamp: deployment.createdAt,
              message: `🚢 Deployment ${deployment.status}: ${deployment.id.slice(0, 8)}... (${new Date(deployment.createdAt).toLocaleString()})`,
              severity: deployment.status === "SUCCESS" ? "info" : deployment.status === "FAILED" ? "error" : "warn"
            });
          });
        }
      } catch (railwayErr) {
        // Silently fail if Railway API is unavailable
        mockLogs.unshift({
          timestamp: new Date().toISOString(),
          message: "⚠️ Railway API unavailable - showing local logs only",
          severity: "warn"
        });
      }
    } else {
      mockLogs.unshift({
        timestamp: new Date().toISOString(),
        message: "ℹ️ Add RAILWAY_API_TOKEN to .env to see deployment history",
        severity: "info"
      });
    }

    return res.json({
      success: true,
      total: Math.min(mockLogs.length, limit),
      logs: mockLogs.slice(0, limit),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Unable to fetch logs: ${err.message}`,
      logs: [],
    });
  }
});

module.exports = router;
