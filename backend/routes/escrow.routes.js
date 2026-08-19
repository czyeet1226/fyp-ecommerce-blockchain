/**
 * backend/routes/escrow.routes.js
 *
 * Escrow-based delivery confirmation + NFT purchase receipts.
 *
 *   POST /api/escrow/confirm   — buyer confirms delivery (releases funds on-chain)
 *   POST /api/escrow/dispute   — buyer disputes before release
 *   GET  /api/escrow/receipts  — the logged-in user's NFT receipts (on-chain)
 *   GET  /api/escrow/receipt/:tokenId — a single receipt's on-chain record
 *
 * The actual on-chain call (confirmDelivery / raiseDispute) is signed by the
 * buyer's MetaMask on the frontend. These endpoints verify the resulting
 * transaction and mirror the outcome into the centralised order record.
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const express = require("express");
const { authenticate } = require("../middleware/auth");
const { Order, Product, User } = require("../models/mysql.models");
const { BlockchainLog } = require("../models/blockchainLog.model");
const blockchainService = require("../config/blockchain");

const router = express.Router();

// Both ETH and Elixir checkouts route through PurchaseEscrow, so dispute
// handling must treat either payment mode as a valid escrow order.
const ESCROW_MODES = ["ETH_ESCROW", "TOKEN_ESCROW"];

// ── POST /api/escrow/confirm ──────────────────────────────────────────────
//
// Buyer's MetaMask has already called PurchaseEscrow.confirmDelivery();
// verify the EscrowReleased event and mark the order delivered/released.
//
router.post("/confirm", authenticate, async (req, res) => {
  try {
    const { orderId, txHash } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.customerId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "Not your order" });
    }
    if (!ESCROW_MODES.includes(order.paymentMode) || !order.escrowId) {
      return res
        .status(400)
        .json({ success: false, message: "This order is not an escrow order" });
    }
    if (order.escrowStatus === "released") {
      return res.json({
        success: true,
        message: "Delivery already confirmed.",
        order,
      });
    }

    let release;
    try {
      release = await blockchainService.verifyEscrowReleased(txHash, {
        escrowId: order.escrowId,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Release could not be verified: ${verifyErr.message}`,
      });
    }

    const receiptTokenId =
      release.receiptTokenId && release.receiptTokenId !== "0"
        ? release.receiptTokenId
        : null;

    await order.update({
      escrowStatus: "released",
      deliveryConfirmed: true,
      deliveryConfirmedAt: new Date(),
      fulfillmentStage: 4, // Delivered
      tokensEarned: release.tokensEarned || order.tokensEarned,
      receiptTokenId,
      receiptTxHash: receiptTokenId ? release.txHash : order.receiptTxHash,
    });

    await BlockchainLog.create({
      eventType: "EscrowReleased",
      orderId: order.id,
      buyerAddress: release.buyer,
      sellerAddress: release.seller,
      sellerReceivesWei: release.sellerReceivesWei,
      platformFeeWei: release.platformFeeWei,
      tokensEarned: release.tokensEarned,
      txHash: release.txHash,
      blockNumber: release.blockNumber,
      paymentMode: order.paymentMode,
    });

    return res.json({
      success: true,
      message: "Delivery confirmed — payment released to the seller.",
      orderId: order.id,
      receiptTokenId,
      tokensEarned: release.tokensEarned,
    });
  } catch (err) {
    console.error("Escrow confirm error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/escrow/dispute ──────────────────────────────────────────────
//
// Buyer's MetaMask has already called PurchaseEscrow.raiseDispute();
// verify the EscrowDisputed event and flag the order for admin review.
//
router.post("/dispute", authenticate, async (req, res) => {
  try {
    const { orderId, txHash } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.customerId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "Not your order" });
    }
    if (!ESCROW_MODES.includes(order.paymentMode) || !order.escrowId) {
      return res
        .status(400)
        .json({ success: false, message: "This order is not an escrow order" });
    }
    if (order.escrowStatus !== "funded") {
      return res.status(400).json({
        success: false,
        message: "Only a funded escrow can be disputed",
      });
    }

    let dispute;
    try {
      dispute = await blockchainService.verifyEscrowDisputed(txHash, {
        escrowId: order.escrowId,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Dispute could not be verified: ${verifyErr.message}`,
      });
    }

    await order.update({ escrowStatus: "disputed" });

    await BlockchainLog.create({
      eventType: "EscrowDisputed",
      orderId: order.id,
      buyerAddress: dispute.buyer,
      sellerAddress: dispute.seller,
      txHash: dispute.txHash,
      paymentMode: order.paymentMode,
    });

    return res.json({
      success: true,
      message: "Dispute raised. The platform will review and resolve it.",
      orderId: order.id,
    });
  } catch (err) {
    console.error("Escrow dispute error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/escrow/receipts ──────────────────────────────────────────────
//
// The logged-in user's NFT purchase receipts, read on-chain from their
// linked MetaMask wallet.
//
router.get("/receipts", authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.metamaskAddress) {
      return res.json({ success: true, receipts: [] });
    }

    const tokenIds = await blockchainService.getReceiptsOf(user.metamaskAddress);
    const receipts = [];
    for (const id of tokenIds) {
      try {
        receipts.push(await blockchainService.getReceipt(id));
      } catch {
        /* skip unreadable token */
      }
    }

    return res.json({ success: true, receipts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/escrow/receipt/:tokenId ──────────────────────────────────────

router.get("/receipt/:tokenId", authenticate, async (req, res) => {
  try {
    const receipt = await blockchainService.getReceipt(req.params.tokenId);
    return res.json({ success: true, receipt });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
});

module.exports = router;
