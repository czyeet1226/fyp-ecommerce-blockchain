/**
 * backend/models/blockchainLog.model.js
 *
 * DECENTRALISED DATABASE (MongoDB via Mongoose)
 * ─────────────────────────────────────────────
 * Collection: blockchainlogs
 *
 * Purpose:
 *   Stores an off-chain, append-only mirror of all on-chain events emitted
 *   by the smart contracts. This acts as the "decentralised audit trail" that:
 *     - Can be queried faster than reading directly from the blockchain
 *     - Provides a human-readable history for the admin dashboard
 *     - Mirrors the immutability concept of blockchain (never updated, only appended)
 *     - Serves as the decentralised DB component in the hybrid architecture
 *
 * Event Types stored:
 *   - PaymentCompleted   (from EcommercePayment)
 *   - TokensIssued       (from LoyaltyToken)
 *   - TokensRedeemed     (from LoyaltyToken)
 *   - OrderCreated       (from EcommercePayment)
 */

const mongoose = require("mongoose");

const blockchainLogSchema = new mongoose.Schema(
  {
    eventType: {
      type:     String,
      required: true,
      enum: [
        "PaymentCompleted",
        "TokensIssued",
        "TokensRedeemed",
        "OrderCreated",
        "EscrowCreated",
        "EscrowReleased",
        "EscrowDisputed",
        "EscrowRefunded",
        "ReceiptMinted",
      ],
      index:    true,
    },

    // Shared fields
    orderId: {
      type:  String,
      index: true,
    },
    buyerAddress: {
      type:  String,
      index: true,
    },
    sellerAddress: {
      type:  String,
      index: true,
    },
    txHash: {
      type:   String,
      unique: true,
      sparse: true,   // allows multiple null txHash (for manual inserts)
    },
    blockNumber: {
      type: Number,
    },

    // PaymentCompleted specific
    sellerReceivesWei: String,
    platformFeeWei:    String,
    tokensEarned:      String,
    paymentMode:       String,   // ETH_ONLY | TOKEN_ONLY | HYBRID

    // TokensIssued specific
    customerAddress: String,
    tokensIssuedWei: String,
    issueReason:     String,

    // TokensRedeemed specific
    tokensRedeemedWei: String,

    // Extra metadata
    productRef: String,
    notes:      String,
  },
  {
    timestamps: true,               // createdAt, updatedAt
    collection: "blockchainlogs",
  }
);

// Index for dashboard queries
blockchainLogSchema.index({ eventType: 1, createdAt: -1 });
blockchainLogSchema.index({ buyerAddress: 1, createdAt: -1 });
blockchainLogSchema.index({ sellerAddress: 1, createdAt: -1 });

const BlockchainLog = mongoose.model("BlockchainLog", blockchainLogSchema);

module.exports = { BlockchainLog };
