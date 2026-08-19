/**
 * backend/routes/subscription.routes.js
 *
 * Seller subscription plans:
 *   GET  /api/subscription/me     — current plan, pending change, usage, prices
 *   POST /api/subscription/change — queue a plan change (applies next cycle)
 *   POST /api/subscription/pay    — pay the monthly fee via MetaMask (ETH → admin)
 *
 * Plans cap how many products a seller may list. A plan change is queued as
 * `pendingPlan` and only takes effect when the next monthly payment is made.
 *
 * NOTE: true unattended auto-debit is not possible with MetaMask (there is no
 * direct-debit primitive for ETH). The monthly charge is therefore approved by
 * the seller (or an operator/cron) via a MetaMask transaction. The renewal flow
 * below records that payment and advances the billing cycle.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { User, Product, SubscriptionPayment } = require("../models/mysql.models");
const {
  PLANS,
  BILLING_PERIOD_MS,
  getPlan,
  isValidPlan,
} = require("../config/plans");
const blockchainService = require("../config/blockchain");

const router = express.Router();

async function loadSellerState(userId) {
  const seller = await User.findByPk(userId);
  if (!seller || seller.role !== "merchant") {
    const err = new Error("Only sellers have a subscription");
    err.status = 403;
    throw err;
  }

  // Lazily initialise a renewal date for sellers created before billing existed.
  if (!seller.plan) seller.plan = "starter";
  if (!seller.planRenewsAt) {
    seller.planRenewsAt = new Date(Date.now() + BILLING_PERIOD_MS);
    await seller.update({ plan: seller.plan, planRenewsAt: seller.planRenewsAt });
  }

  const productCount = await Product.count({
    where: { merchantId: seller.id, isActive: true },
  });

  return { seller, productCount };
}

function serializeSubscription(seller, productCount) {
  const plan = getPlan(seller.plan);
  const pending = seller.pendingPlan ? getPlan(seller.pendingPlan) : null;
  return {
    plan: seller.plan,
    planLabel: plan.label,
    priceEth: plan.priceEth,
    productLimit: plan.productLimit, // null = unlimited
    productCount,
    pendingPlan: seller.pendingPlan || null,
    pendingPlanLabel: pending ? pending.label : null,
    planRenewsAt: seller.planRenewsAt,
    dueNow: seller.planRenewsAt
      ? Date.now() >= new Date(seller.planRenewsAt).getTime()
      : true,
    plans: Object.values(PLANS).map((p) => ({
      key: p.key,
      label: p.label,
      priceEth: p.priceEth,
      productLimit: p.productLimit,
      blurb: p.blurb,
    })),
    platformAddress: blockchainService.adminAddress || "",
  };
}

// ── GET /api/subscription/me ────────────────────────────────────────────────

router.get("/me", authenticate, requireRole("merchant"), async (req, res) => {
  try {
    const { seller, productCount } = await loadSellerState(req.user.id);
    return res.json({
      success: true,
      subscription: serializeSubscription(seller, productCount),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

// ── POST /api/subscription/change ───────────────────────────────────────────
//
// Queue a plan change. It takes effect at the next billing cycle (renewal),
// not immediately.
//
router.post("/change", authenticate, requireRole("merchant"), async (req, res) => {
  try {
    const nextPlan = String(req.body.plan || "").toLowerCase();
    if (!isValidPlan(nextPlan)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan selected" });
    }

    const { seller, productCount } = await loadSellerState(req.user.id);

    if (nextPlan === seller.plan) {
      // Selecting the current plan cancels any pending change.
      await seller.update({ pendingPlan: null });
      const fresh = await User.findByPk(seller.id);
      return res.json({
        success: true,
        message: "You're already on this plan. Any pending change was cancelled.",
        subscription: serializeSubscription(fresh, productCount),
      });
    }

    await seller.update({ pendingPlan: nextPlan });
    const fresh = await User.findByPk(seller.id);

    return res.json({
      success: true,
      message: `Your plan will switch to ${getPlan(nextPlan).label} on your next billing date.`,
      subscription: serializeSubscription(fresh, productCount),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

// ── POST /api/subscription/pay ──────────────────────────────────────────────
//
// Pay the monthly subscription fee. The seller's MetaMask has already sent the
// plan price in ETH to the platform admin wallet; we verify it, then advance
// the billing cycle and apply any pending plan change.
//
router.post("/pay", authenticate, requireRole("merchant"), async (req, res) => {
  try {
    const { txHash } = req.body;
    const { seller, productCount } = await loadSellerState(req.user.id);

    // The plan being billed = the pending change if any, else the current plan.
    const effectivePlanKey = seller.pendingPlan || seller.plan;
    const effectivePlan = getPlan(effectivePlanKey);
    const price = effectivePlan.priceEth;

    // Verify the ETH payment to the platform on-chain.
    try {
      await blockchainService.verifyIncomingEth(txHash, price);
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Subscription payment could not be verified: ${verifyErr.message}`,
      });
    }

    // Advance the billing cycle from the later of now / current renewal date.
    const base = seller.planRenewsAt
      ? Math.max(Date.now(), new Date(seller.planRenewsAt).getTime())
      : Date.now();
    const periodStart = new Date();
    const periodEnd = new Date(base + BILLING_PERIOD_MS);

    await seller.update({
      plan: effectivePlanKey,
      pendingPlan: null,
      planRenewsAt: periodEnd,
    });

    await SubscriptionPayment.create({
      sellerId: seller.id,
      sellerCode: seller.userCode,
      plan: effectivePlanKey,
      amountEth: price,
      txHash: txHash || null,
      periodStart,
      periodEnd,
      status: "completed",
    });

    const fresh = await User.findByPk(seller.id);

    return res.json({
      success: true,
      message: `Subscription paid — you're on the ${effectivePlan.label} plan until ${periodEnd.toLocaleDateString()}.`,
      subscription: serializeSubscription(fresh, productCount),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
});

module.exports = router;
