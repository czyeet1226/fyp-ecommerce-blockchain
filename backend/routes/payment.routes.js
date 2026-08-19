/**
 * backend/routes/payment.routes.js
 *
 * Payment Endpoints:
 *   POST /api/payment/escrow        — pay with ETH via escrow (held until delivery)
 *   POST /api/payment/escrow-token  — pay with Elixir via escrow (held until delivery)
 *   POST /api/payment/rm            — pay with the off-chain RM ledger
 *   GET  /api/payment/wallet        — token + ETH balance for the logged-in user
 */

const express = require("express");
const { ethers } = require("ethers");
const { Op } = require("sequelize");
const { authenticate } = require("../middleware/auth");
const { mysqlDB } = require("../config/database");
const {
  User,
  Product,
  Order,
  OrderItem,
  Cart,
  CustomerWallet,
  WalletTransaction,
} = require("../models/mysql.models");
const { BlockchainLog } = require("../models/blockchainLog.model");
const blockchainService = require("../config/blockchain");

// ── Currency rates (single source of truth) ───────────────────────────────
const ELIXIR_TO_RM_RATE = 12; // 1 Elixir  = RM 12
const RM_TO_ELIXIR_RATE = 1 / ELIXIR_TO_RM_RATE;
const ETH_TO_RM_RATE = 12000; // 1 ETH     = RM 12000

// Value of 1 unit of each currency expressed in RM (the common base)
const RM_VALUE = {
  RM: 1,
  ELIXIR: ELIXIR_TO_RM_RATE,
  ETH: ETH_TO_RM_RATE,
};

const CURRENCIES = ["ETH", "ELIXIR", "RM"];

/**
 * Convert an amount from one currency to another via the RM base value.
 */
function convertCurrency(amount, fromCurrency, toCurrency) {
  const rmValue = Number(amount) * RM_VALUE[fromCurrency];
  return rmValue / RM_VALUE[toCurrency];
}

/**
 * Read the on-chain Elixir (LYT) balance for an address as whole units.
 * Elixir is a real ERC-20 token, so a linked MetaMask wallet's on-chain
 * balance is the source of truth. Falls back to 0 when unavailable.
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

const router = express.Router();

// ── Helper: load user + product + merchant ───────────────────────────────

async function loadEntities(customerId, productId) {
  const customer = await User.findByPk(customerId);
  const product = await Product.findByPk(productId, {
    include: [{ model: User, as: "merchant" }],
  });

  if (!customer) throw new Error("Customer not found");
  if (!product) throw new Error("Product not found");
  if (!product.isActive || product.stock < 1)
    throw new Error("Product unavailable");
  if (!customer.walletPrivateKey)
    throw new Error("Customer wallet not configured");

  const merchant = product.merchant;
  if (!merchant) throw new Error("Merchant not found");

  return { customer, product, merchant };
}

function calculateTokensEarned(priceEth) {
  return BigInt(Math.round(Number(priceEth) * 1000));
}

/**
 * Best-effort NFT purchase receipt for a non-escrow order. Minted from the
 * admin (owner) wallet to the buyer's MetaMask. Never throws — a receipt
 * failure must not fail the payment. (Escrow orders mint their own receipt
 * on-chain at delivery confirmation.)
 */
async function mintOrderReceipt({ order, customer, merchant, product, priceEth }) {
  try {
    if (!customer.metamaskAddress) return;
    const seller = merchant.metamaskAddress || merchant.walletAddress || "";
    const pricePaidWei = ethers.parseEther(String(priceEth || 0));
    const minted = await blockchainService.mintReceiptFromAdmin({
      to: customer.metamaskAddress,
      orderRef: order.id,
      productRef: product.id,
      seller,
      pricePaidWei,
    });
    if (minted && minted.tokenId) {
      await order.update({
        receiptTokenId: minted.tokenId,
        receiptTxHash: minted.txHash,
      });
      await BlockchainLog.create({
        eventType: "ReceiptMinted",
        orderId: order.id,
        buyerAddress: customer.metamaskAddress,
        sellerAddress: seller,
        txHash: minted.txHash,
        paymentMode: order.paymentMode,
        productRef: product.id,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("Receipt mint skipped:", err.message);
  }
}

// ── Basket (multi-item) checkout helpers ───────────────────────────────────

// Accept either a basket (items:[{productId,quantity}]) or a single product
// (productId + quantity) for backward compatibility.
function normalizeItems(body) {
  if (Array.isArray(body.items) && body.items.length > 0) return body.items;
  if (body.productId) {
    return [{ productId: body.productId, quantity: body.quantity || 1 }];
  }
  return [];
}

/**
 * Validate a basket and load its products. Enforces that every item belongs
 * to the SAME seller (one order = one seller = one escrow), that products are
 * active and in stock, and computes the totals.
 */
async function loadBasket(customerId, rawItems) {
  const customer = await User.findByPk(customerId);
  if (!customer) throw new Error("Customer not found");
  if (!customer.walletPrivateKey) throw new Error("Customer wallet not configured");

  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) throw new Error("No items to check out");

  const lineItems = [];
  let merchant = null;
  let totalEth = 0;
  let totalUnits = 0;

  for (const it of items) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    const product = await Product.findByPk(it.productId, {
      include: [{ model: User, as: "merchant" }],
    });
    if (!product) throw new Error("A product in your cart no longer exists");
    if (!product.isActive || product.stock < qty) {
      throw new Error(`"${product.name}" is unavailable or out of stock`);
    }
    if (!product.merchant) throw new Error("Merchant not found");

    if (!merchant) {
      merchant = product.merchant;
    } else if (merchant.id !== product.merchant.id) {
      throw new Error(
        "All items in one order must be from the same seller. Check out each store separately.",
      );
    }

    const unit = parseFloat(product.priceEth);
    totalEth += unit * qty;
    totalUnits += qty;
    lineItems.push({ product, quantity: qty, unitPriceEth: unit });
  }

  return { customer, merchant, lineItems, totalEth, totalUnits };
}

/**
 * Create an order header + its line items, decrement stock, and clear the
 * purchased products from the customer's cart. Optionally runs in a
 * transaction (used by the RM ledger flow).
 */
async function createBasketOrder(opts, transaction = null) {
  const {
    customer,
    merchant,
    lineItems,
    totalEth,
    totalUnits,
    paymentMode,
    ethPaid = 0,
    tokensPaid = 0,
    tokensEarned = 0,
    txHash = null,
    escrowId = null,
    escrowStatus = "none",
    deliveryAddress,
  } = opts;

  const order = await Order.create(
    {
      onChainOrderId: null,
      customerId: customer.id,
      merchantId: merchant.id,
      productId: lineItems.length === 1 ? lineItems[0].product.id : null,
      quantity: totalUnits,
      totalPriceEth: totalEth,
      paymentMode,
      ethPaid,
      tokensPaid,
      tokensEarned,
      txHash,
      status: "completed",
      escrowId,
      escrowStatus,
      deliveryAddress,
    },
    transaction ? { transaction } : {},
  );

  for (const li of lineItems) {
    await OrderItem.create(
      {
        orderId: order.id,
        productId: li.product.id,
        merchantId: merchant.id,
        productName: li.product.name,
        quantity: li.quantity,
        unitPriceEth: li.unitPriceEth,
      },
      transaction ? { transaction } : {},
    );
    await li.product.update(
      { stock: li.product.stock - li.quantity },
      transaction ? { transaction } : {},
    );
  }

  const productIds = lineItems.map((li) => li.product.id);
  await Cart.destroy({
    where: { customerId: customer.id, productId: productIds },
    ...(transaction ? { transaction } : {}),
  });

  return order;
}

async function getCustomerWallet(customer) {
  const wallet = await CustomerWallet.findOne({
    where: { userCode: customer.userCode },
  });

  if (!wallet) {
    throw new Error("Customer wallet not found");
  }

  return wallet;
}

// ── POST /api/payment/eth ─────────────────────────────────────────────────
//
// The customer's MetaMask has already called EcommercePayment.payWithETH();
// we verify the on-chain transaction, then record the order.
//
router.post("/eth", authenticate, async (req, res) => {
  try {
    const { productId, quantity = 1, deliveryAddress, txHash } = req.body;
    const { customer, product, merchant } = await loadEntities(
      req.user.id,
      productId,
    );

    if (!customer.metamaskAddress) {
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to pay with ETH",
      });
    }
    const sellerPayout = merchant.metamaskAddress || merchant.walletAddress;
    if (!sellerPayout) {
      return res
        .status(400)
        .json({ success: false, message: "Seller wallet not configured" });
    }

    const priceEth = parseFloat(product.priceEth) * quantity;

    // Verify the MetaMask payment on-chain.
    let payment;
    try {
      payment = await blockchainService.verifyPaymentTx(txHash, {
        buyer: customer.metamaskAddress,
        seller: sellerPayout,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Payment could not be verified: ${verifyErr.message}`,
      });
    }

    await product.update({ stock: product.stock - quantity });

    const order = await Order.create({
      onChainOrderId: payment.orderId,
      customerId: customer.id,
      merchantId: merchant.id,
      productId: product.id,
      quantity,
      totalPriceEth: priceEth,
      paymentMode: "ETH_ONLY",
      ethPaid: priceEth,
      tokensPaid: 0,
      tokensEarned: payment.tokensEarned,
      txHash: payment.txHash,
      status: "completed",
      deliveryAddress,
    });

    await BlockchainLog.create({
      eventType: "PaymentCompleted",
      orderId: order.id,
      buyerAddress: customer.metamaskAddress,
      sellerAddress: sellerPayout,
      txHash: payment.txHash,
      blockNumber: payment.blockNumber,
      paymentMode: "ETH_ONLY",
      productRef: productId,
    });

    await mintOrderReceipt({ order, customer, merchant, product, priceEth });

    return res.json({
      success: true,
      message: "Payment successful",
      orderId: order.id,
      txHash: payment.txHash,
      priceEth,
      tokensEarned: payment.tokensEarned,
      paymentMode: "ETH_ONLY",
    });
  } catch (err) {
    console.error("ETH payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/token ───────────────────────────────────────────────

router.post("/token", authenticate, async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      deliveryAddress,
      txHash,
      tokensSpent,
    } = req.body;
    const { customer, product, merchant } = await loadEntities(
      req.user.id,
      productId,
    );

    if (!customer.metamaskAddress) {
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to pay with Elixir",
      });
    }
    const sellerPayout = merchant.metamaskAddress || merchant.walletAddress;
    if (!sellerPayout) {
      return res
        .status(400)
        .json({ success: false, message: "Seller wallet not configured" });
    }

    const priceEth = parseFloat(product.priceEth) * quantity;

    // The customer's MetaMask already called EcommercePayment.payWithTokens();
    // verify the on-chain transaction.
    let payment;
    try {
      payment = await blockchainService.verifyPaymentTx(txHash, {
        buyer: customer.metamaskAddress,
        seller: sellerPayout,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Payment could not be verified: ${verifyErr.message}`,
      });
    }

    await product.update({ stock: product.stock - quantity });

    const order = await Order.create({
      onChainOrderId: payment.orderId,
      customerId: customer.id,
      merchantId: merchant.id,
      productId: product.id,
      quantity,
      totalPriceEth: priceEth,
      paymentMode: "TOKEN_ONLY",
      ethPaid: 0,
      tokensPaid: tokensSpent ? Math.round(Number(tokensSpent)) : 0,
      tokensEarned: payment.tokensEarned,
      txHash: payment.txHash,
      status: "completed",
      deliveryAddress,
    });

    await BlockchainLog.create({
      eventType: "PaymentCompleted",
      orderId: order.id,
      buyerAddress: customer.metamaskAddress,
      sellerAddress: sellerPayout,
      txHash: payment.txHash,
      blockNumber: payment.blockNumber,
      paymentMode: "TOKEN_ONLY",
      productRef: productId,
    });

    await mintOrderReceipt({ order, customer, merchant, product, priceEth });

    return res.json({
      success: true,
      message: "Token payment successful",
      orderId: order.id,
      txHash: payment.txHash,
      tokensSpent: tokensSpent ? String(tokensSpent) : "0",
      tokensEarned: payment.tokensEarned,
      paymentMode: "TOKEN_ONLY",
    });
  } catch (err) {
    console.error("Token payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/escrow ──────────────────────────────────────────────
//
// Escrow checkout. The customer's MetaMask has already called
// PurchaseEscrow.createEscrow() (payable), locking the ETH in the contract.
// We verify the EscrowCreated event, then record a funded escrow order.
// The seller is NOT paid until the buyer confirms delivery (see escrow.routes).
//
router.post("/escrow", authenticate, async (req, res) => {
  try {
    const { deliveryAddress, txHash } = req.body;
    const { customer, merchant, lineItems, totalEth, totalUnits } =
      await loadBasket(req.user.id, normalizeItems(req.body));

    if (!customer.metamaskAddress) {
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to pay with escrow",
      });
    }
    const sellerPayout = merchant.metamaskAddress || merchant.walletAddress;
    if (!sellerPayout) {
      return res
        .status(400)
        .json({ success: false, message: "Seller wallet not configured" });
    }

    // Verify the on-chain escrow funding.
    let escrowInfo;
    try {
      escrowInfo = await blockchainService.verifyEscrowCreated(txHash, {
        buyer: customer.metamaskAddress,
        seller: sellerPayout,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Escrow could not be verified: ${verifyErr.message}`,
      });
    }

    // Guard against underpayment: the escrowed ETH must cover the basket total.
    const expectedWei = ethers.parseEther(totalEth.toFixed(8));
    if (BigInt(escrowInfo.amount) < (expectedWei * 99n) / 100n) {
      return res.status(400).json({
        success: false,
        message: "Escrowed ETH is less than the order total",
      });
    }

    const order = await createBasketOrder({
      customer,
      merchant,
      lineItems,
      totalEth,
      totalUnits,
      paymentMode: "ETH_ESCROW",
      ethPaid: totalEth,
      tokensEarned: 0, // rewarded on delivery confirmation (release)
      txHash: escrowInfo.txHash,
      escrowId: escrowInfo.escrowId,
      escrowStatus: "funded",
      deliveryAddress,
    });

    await BlockchainLog.create({
      eventType: "EscrowCreated",
      orderId: order.id,
      buyerAddress: customer.metamaskAddress,
      sellerAddress: sellerPayout,
      txHash: escrowInfo.txHash,
      blockNumber: escrowInfo.blockNumber,
      paymentMode: "ETH_ESCROW",
      productRef: order.id,
    });

    return res.json({
      success: true,
      message:
        "Payment secured in escrow. Funds release when you confirm delivery.",
      orderId: order.id,
      escrowId: escrowInfo.escrowId,
      txHash: escrowInfo.txHash,
      priceEth: totalEth,
      itemCount: totalUnits,
      paymentMode: "ETH_ESCROW",
    });
  } catch (err) {
    console.error("Escrow payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/escrow-token ────────────────────────────────────────
//
// Elixir (LYT) escrow checkout. The customer's MetaMask has already approved
// and called PurchaseEscrow.createTokenEscrow(), locking the Elixir tokens in
// the contract. We verify the EscrowCreated event, then record a funded token
// escrow order. The seller receives the Elixir only when the buyer confirms
// delivery (see escrow.routes).
//
router.post("/escrow-token", authenticate, async (req, res) => {
  try {
    const { deliveryAddress, txHash, tokensSpent } = req.body;
    const { customer, merchant, lineItems, totalEth, totalUnits } =
      await loadBasket(req.user.id, normalizeItems(req.body));

    if (!customer.metamaskAddress) {
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to pay with Elixir",
      });
    }
    const sellerPayout = merchant.metamaskAddress || merchant.walletAddress;
    if (!sellerPayout) {
      return res
        .status(400)
        .json({ success: false, message: "Seller wallet not configured" });
    }

    // Verify the on-chain token escrow funding.
    let escrowInfo;
    try {
      escrowInfo = await blockchainService.verifyEscrowCreated(txHash, {
        buyer: customer.metamaskAddress,
        seller: sellerPayout,
      });
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        message: `Escrow could not be verified: ${verifyErr.message}`,
      });
    }

    const tokens = tokensSpent ? Math.round(Number(tokensSpent)) : 0;
    // Guard against underpayment: escrowed Elixir must cover the basket total.
    if (tokens > 0) {
      const escrowedTokens = Number(
        ethers.formatUnits(escrowInfo.amount, 18),
      );
      if (escrowedTokens < tokens * 0.99) {
        return res.status(400).json({
          success: false,
          message: "Escrowed Elixir is less than the order total",
        });
      }
    }

    const order = await createBasketOrder({
      customer,
      merchant,
      lineItems,
      totalEth,
      totalUnits,
      paymentMode: "TOKEN_ESCROW",
      tokensPaid: tokens,
      tokensEarned: 0, // paying with Elixir earns no loyalty reward
      txHash: escrowInfo.txHash,
      escrowId: escrowInfo.escrowId,
      escrowStatus: "funded",
      deliveryAddress,
    });

    await BlockchainLog.create({
      eventType: "EscrowCreated",
      orderId: order.id,
      buyerAddress: customer.metamaskAddress,
      sellerAddress: sellerPayout,
      txHash: escrowInfo.txHash,
      blockNumber: escrowInfo.blockNumber,
      paymentMode: "TOKEN_ESCROW",
      productRef: order.id,
    });

    return res.json({
      success: true,
      message:
        "Elixir secured in escrow. Tokens release to the seller when you confirm delivery.",
      orderId: order.id,
      escrowId: escrowInfo.escrowId,
      txHash: escrowInfo.txHash,
      tokensSpent: String(tokens),
      itemCount: totalUnits,
      paymentMode: "TOKEN_ESCROW",
    });
  } catch (err) {
    console.error("Token escrow payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/rm ──────────────────────────────────────────────────
//
// Pay entirely with the off-chain RM ledger balance. Deducts the customer's
// RM wallet; no blockchain involved (RM is the platform's fiat currency).
//
router.post("/rm", authenticate, async (req, res) => {
  try {
    const { deliveryAddress } = req.body;
    const { customer, merchant, lineItems, totalEth, totalUnits } =
      await loadBasket(req.user.id, normalizeItems(req.body));

    if (customer.role !== "customer") {
      return res
        .status(403)
        .json({ success: false, message: "Only customers can purchase" });
    }

    // Server-side RM total (never trust the client).
    let totalRm = 0;
    for (const li of lineItems) {
      totalRm += li.product.priceMyr
        ? Number(li.product.priceMyr) * li.quantity
        : li.unitPriceEth * li.quantity * ETH_TO_RM_RATE;
    }
    totalRm = Number(totalRm.toFixed(2));

    const transaction = await mysqlDB.transaction();
    try {
      const wallet = await getCustomerWallet(customer);
      const currentRm = Number(wallet.RM || 0);
      if (currentRm < totalRm) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient RM balance. Need RM ${totalRm.toFixed(2)}, have RM ${currentRm.toFixed(2)}.`,
        });
      }

      const nextRm = Number((currentRm - totalRm).toFixed(2));
      await wallet.update({ RM: nextRm }, { transaction });

      const order = await createBasketOrder(
        {
          customer,
          merchant,
          lineItems,
          totalEth,
          totalUnits,
          paymentMode: "RM_ONLY",
          deliveryAddress,
        },
        transaction,
      );

      await WalletTransaction.create(
        {
          userCode: customer.userCode,
          type: "TRANSFER_OUT",
          fromCurrency: "RM",
          fromAmount: totalRm,
          counterparty: merchant.name || "merchant",
          note: `Purchased ${totalUnits} item(s) (RM)`,
          status: "completed",
        },
        { transaction },
      );

      await transaction.commit();

      return res.json({
        success: true,
        message: "RM payment successful",
        orderId: order.id,
        rmPaid: totalRm.toFixed(2),
        rmBalance: String(nextRm),
        itemCount: totalUnits,
        paymentMode: "RM_ONLY",
      });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error("RM payment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/preview ──────────────────────────────────────────────

router.get("/preview", authenticate, async (req, res) => {
  try {
    const { productId, quantity = 1, tokensToUse = 0 } = req.query;
    const product = await Product.findByPk(productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const priceEth = parseFloat(product.priceEth) * parseInt(quantity);
    const priceWei = blockchainService.parseEth(priceEth.toString());
    const { ethRequired, tokenEthValue } =
      await blockchainService.previewHybridCost(priceWei, BigInt(tokensToUse));

    return res.json({
      success: true,
      priceEth,
      tokensToUse: parseInt(tokensToUse),
      tokenEthValue: ethers.formatEther(tokenEthValue),
      ethRequired: ethers.formatEther(ethRequired),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/wallet ───────────────────────────────────────────────

router.get("/wallet", authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const wallet = user
      ? await CustomerWallet.findOne({ where: { userCode: user.userCode } })
      : null;

    console.log("[payment/wallet] SQL RM value", {
      userId: user?.id,
      userCode: user?.userCode,
      rm: wallet ? String(wallet.RM) : null,
    });

    const platformAddress = blockchainService.adminAddress || "";

    if (!user || !user.walletAddress) {
      return res.json({
        success: true,
        ethBalance: "0",
        lytBalance: wallet ? String(wallet.Elixir) : "0",
        rmBalance: wallet ? String(wallet.RM) : "0",
        metamaskAddress: user?.metamaskAddress || "",
        platformAddress,
      });
    }

    const provider = blockchainService.provider;
    const ethBalance = provider
      ? ethers.formatEther(await provider.getBalance(user.walletAddress))
      : "0";

    // Elixir is a real on-chain token. When the customer has linked a MetaMask
    // wallet, its on-chain LYT balance is authoritative — read it and mirror it
    // into the DB so the rest of the app stays consistent.
    let lytBalance = wallet ? String(wallet.Elixir) : "0";
    if (user.metamaskAddress) {
      const onChain = await readOnChainElixir(user.metamaskAddress);
      lytBalance = String(onChain);
      if (wallet && Number(wallet.Elixir) !== onChain) {
        await wallet.update({ Elixir: onChain });
      }
    }

    return res.json({
      success: true,
      walletAddress: user.walletAddress,
      metamaskAddress: user.metamaskAddress || "",
      ethBalance,
      lytBalance,
      rmBalance: wallet ? String(wallet.RM) : "0",
      platformAddress,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/swap ───────────────────────────────────────────────
//
// Multi-currency swap between ETH, ELIXIR and RM. Elixir is a REAL on-chain
// ERC-20 token (LYT) held in the customer's MetaMask wallet; the admin wallet
// is the Elixir treasury.
//
//   Body: { fromCurrency, toCurrency, amount, txHash?, metamaskAddress? }
//
//   ETH  → ELIXIR : MetaMask sends ETH to the admin (txHash); admin then
//                   sends real LYT tokens back to the customer's MetaMask.
//   RM   → ELIXIR : deduct RM ledger; admin sends real LYT to the customer.
//   ELIXIR → ETH  : MetaMask sends LYT to the admin (txHash); admin sends ETH.
//   ELIXIR → RM   : MetaMask sends LYT to the admin (txHash); credit RM ledger.
//   ETH  ↔ RM     : ETH on-chain (to/from admin), RM on the ledger.
//
router.post("/swap", authenticate, async (req, res) => {
  const transaction = await mysqlDB.transaction();

  try {
    const {
      fromCurrency: rawFrom,
      toCurrency: rawTo,
      amount,
      txHash,
      metamaskAddress,
    } = req.body;

    const fromCurrency = String(rawFrom || "").toUpperCase();
    const toCurrency = String(rawTo || "").toUpperCase();
    const swapAmount = Number(amount);

    if (!Number.isFinite(swapAmount) || swapAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Valid swap amount is required" });
    }

    if (
      !CURRENCIES.includes(fromCurrency) ||
      !CURRENCIES.includes(toCurrency) ||
      fromCurrency === toCurrency
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Choose two different currencies to swap",
      });
    }

    const customer = await User.findByPk(req.user.id);
    if (!customer || customer.role !== "customer") {
      await transaction.rollback();
      return res
        .status(403)
        .json({ success: false, message: "Only customers can swap balances" });
    }

    const wallet = await getCustomerWallet(customer);
    const currentRm = Number(wallet.RM || 0);

    const userMeta = metamaskAddress || customer.metamaskAddress;
    const involvesElixir =
      fromCurrency === "ELIXIR" || toCurrency === "ELIXIR";
    const involvesEth = fromCurrency === "ETH" || toCurrency === "ETH";

    // Elixir & ETH movements require a linked MetaMask wallet.
    if ((involvesElixir || involvesEth) && !userMeta) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Connect your MetaMask wallet to swap ETH or Elixir",
      });
    }

    const toAmount = convertCurrency(swapAmount, fromCurrency, toCurrency);
    let ethPayoutTx = null;
    let elixirPayoutTx = null;

    // ── Verify inbound on-chain legs ───────────────────────────────────────
    if (fromCurrency === "ETH") {
      // MetaMask already sent ETH to the platform; verify it.
      try {
        await blockchainService.verifyIncomingEth(txHash, swapAmount);
      } catch (verifyErr) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `ETH transfer could not be verified: ${verifyErr.message}`,
        });
      }
    }

    if (fromCurrency === "ELIXIR") {
      // MetaMask already sent LYT to the admin treasury; verify it.
      try {
        await blockchainService.verifyLytTransfer(
          txHash,
          blockchainService.adminAddress,
          swapAmount,
        );
      } catch (verifyErr) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Elixir transfer could not be verified: ${verifyErr.message}`,
        });
      }
    }

    if (fromCurrency === "RM" && currentRm < swapAmount) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Not enough RM for this swap" });
    }

    // ── Perform outbound on-chain legs ─────────────────────────────────────
    if (toCurrency === "ETH") {
      try {
        ethPayoutTx = await blockchainService.sendEthFromAdmin(
          userMeta,
          toAmount,
        );
      } catch (payErr) {
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `ETH payout failed: ${payErr.message}`,
        });
      }
    }

    if (toCurrency === "ELIXIR") {
      // Admin sends real LYT tokens to the customer's MetaMask wallet.
      try {
        elixirPayoutTx = await blockchainService.sendLytFromAdmin(
          userMeta,
          toAmount,
        );
      } catch (payErr) {
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Elixir payout failed: ${payErr.message}`,
        });
      }
    }

    // ── Update ledgers ─────────────────────────────────────────────────────
    // RM is tracked in the DB. Elixir lives on-chain — mirror the resulting
    // on-chain balance into the DB for consistent display across the app.
    let nextRm = currentRm;
    if (fromCurrency === "RM") nextRm -= swapAmount;
    if (toCurrency === "RM") nextRm += toAmount;
    nextRm = Number(nextRm.toFixed(2));

    let nextElixir = Number(wallet.Elixir || 0);
    if (involvesElixir) {
      nextElixir = Number((await readOnChainElixir(userMeta)).toFixed(8));
    }

    await wallet.update({ RM: nextRm, Elixir: nextElixir }, { transaction });

    // ── Record history ─────────────────────────────────────────────────────
    await WalletTransaction.create(
      {
        userCode: customer.userCode,
        type: "SWAP",
        fromCurrency,
        toCurrency,
        fromAmount: swapAmount,
        toAmount: Number(toAmount.toFixed(8)),
        counterparty: "platform",
        txHash: txHash || elixirPayoutTx || ethPayoutTx || null,
        note: `Swap ${fromCurrency} → ${toCurrency}`,
        status: "completed",
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: `Swapped ${swapAmount} ${fromCurrency} to ${Number(
        toAmount.toFixed(6),
      )} ${toCurrency}`,
      fromCurrency,
      toCurrency,
      fromAmount: swapAmount,
      toAmount: Number(toAmount.toFixed(8)),
      rmBalance: String(nextRm),
      lytBalance: String(nextElixir),
      txHash: txHash || elixirPayoutTx || ethPayoutTx || null,
    });
  } catch (err) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/deposit ─────────────────────────────────────────────

router.post("/deposit", authenticate, async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid RM deposit amount is required",
      });
    }

    const customer = await User.findByPk(req.user.id);
    if (!customer || customer.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can deposit RM",
      });
    }

    const wallet = await getCustomerWallet(customer);
    const nextRm = Number(wallet.RM) + amount;

    await wallet.update({ RM: nextRm });

    await WalletTransaction.create({
      userCode: customer.userCode,
      type: "DEPOSIT",
      toCurrency: "RM",
      toAmount: amount,
      counterparty: "top-up",
      note: `Deposited RM ${amount.toFixed(2)}`,
      status: "completed",
    });

    return res.json({
      success: true,
      message: `RM ${amount.toFixed(2)} deposited successfully`,
      rmBalance: String(nextRm),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/transfer ────────────────────────────────────────────
//
// Transfer ELIXIR, RM, or ETH to another user by wallet address.
//   Body: { recipientAddress, amount, currency, txHash? }
//
//   ELIXIR / RM : off-chain ledger transfer. Deducts from the sender and
//                 credits the recipient if they exist in the system.
//   ETH         : peer-to-peer on-chain transfer. The frontend sends ETH
//                 from MetaMask to `recipientAddress` and passes `txHash`;
//                 we verify it and record the history (recipient receives
//                 ETH directly on-chain).
//
router.post("/transfer", authenticate, async (req, res) => {
  const transaction = await mysqlDB.transaction();

  try {
    const {
      recipientAddress: rawRecipient,
      amount,
      currency: rawCurrency,
      txHash,
    } = req.body;

    const currency = String(rawCurrency || "ELIXIR").toUpperCase();
    const recipientAddress = String(rawRecipient || "").trim();
    const transferAmount = Number(amount);

    if (!["ELIXIR", "RM", "ETH"].includes(currency)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Unsupported transfer currency" });
    }

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "A valid amount is required" });
    }

    if (!recipientAddress || recipientAddress.length < 6) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Recipient address is required" });
    }

    const customer = await User.findByPk(req.user.id);
    if (!customer || customer.role !== "customer") {
      await transaction.rollback();
      return res
        .status(403)
        .json({ success: false, message: "Only customers can transfer" });
    }

    // Guard against sending to your own known addresses.
    const ownAddresses = [customer.walletAddress, customer.metamaskAddress]
      .filter(Boolean)
      .map((a) => a.toLowerCase());
    if (ownAddresses.includes(recipientAddress.toLowerCase())) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Cannot transfer to yourself" });
    }

    // Find a recipient user by their MetaMask or Hardhat address.
    const recipientUser = await User.findOne({
      where: {
        [Op.or]: [
          { metamaskAddress: recipientAddress },
          { walletAddress: recipientAddress },
        ],
      },
    });

    // ── ETH / ELIXIR: on-chain peer-to-peer transfer ───────────────────────
    // Both ETH and Elixir (LYT) are real on-chain assets sent from the
    // sender's MetaMask wallet; we verify the tx and record history. Balances
    // are read from chain (no DB debit/credit needed for on-chain assets).
    if (currency === "ETH" || currency === "ELIXIR") {
      try {
        if (currency === "ETH") {
          await blockchainService.verifyEthTransfer(
            txHash,
            recipientAddress,
            transferAmount,
          );
        } else {
          await blockchainService.verifyLytTransfer(
            txHash,
            recipientAddress,
            transferAmount,
          );
        }
      } catch (verifyErr) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `${currency} transfer could not be verified: ${verifyErr.message}`,
        });
      }

      await WalletTransaction.create(
        {
          userCode: customer.userCode,
          type: "TRANSFER_OUT",
          fromCurrency: currency,
          fromAmount: transferAmount,
          counterparty: recipientAddress,
          txHash: txHash || null,
          note: `Sent ${currency} transfer`,
          status: "completed",
        },
        { transaction },
      );

      if (recipientUser) {
        await WalletTransaction.create(
          {
            userCode: recipientUser.userCode,
            type: "TRANSFER_IN",
            toCurrency: currency,
            toAmount: transferAmount,
            counterparty: customer.metamaskAddress || customer.walletAddress,
            txHash: txHash || null,
            note: `Received ${currency} transfer`,
            status: "completed",
          },
          { transaction },
        );
      }

      // Mirror the sender's resulting on-chain Elixir balance into the DB.
      let senderElixir = null;
      if (currency === "ELIXIR" && customer.metamaskAddress) {
        senderElixir = Number(
          (await readOnChainElixir(customer.metamaskAddress)).toFixed(8),
        );
        const senderWallet = await CustomerWallet.findOne({
          where: { userCode: customer.userCode },
        });
        if (senderWallet) {
          await senderWallet.update({ Elixir: senderElixir }, { transaction });
        }
      }

      await transaction.commit();
      return res.json({
        success: true,
        message: `Transferred ${transferAmount} ${currency}`,
        txHash: txHash || null,
        lytBalance: senderElixir != null ? String(senderElixir) : undefined,
        recipientCredited: Boolean(recipientUser),
      });
    }

    // ── RM: off-chain ledger transfer ───────────────────────────────────────
    const field = "RM";
    const decimals = 2;

    const wallet = await getCustomerWallet(customer);
    const currentBalance = Number(wallet[field] || 0);

    if (currentBalance < transferAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Not enough ${currency === "RM" ? "RM" : "Elixir"} to transfer`,
      });
    }

    const nextBalance = Number((currentBalance - transferAmount).toFixed(decimals));
    await wallet.update({ [field]: nextBalance }, { transaction });

    // Credit the recipient's ledger if they exist in our system.
    let recipientCredited = false;
    if (recipientUser) {
      const recipientWallet = await CustomerWallet.findOne({
        where: { userCode: recipientUser.userCode },
      });
      if (recipientWallet) {
        const recipientNext = Number(
          (Number(recipientWallet[field] || 0) + transferAmount).toFixed(
            decimals,
          ),
        );
        await recipientWallet.update(
          { [field]: recipientNext },
          { transaction },
        );
        recipientCredited = true;

        await WalletTransaction.create(
          {
            userCode: recipientUser.userCode,
            type: "TRANSFER_IN",
            toCurrency: currency,
            toAmount: transferAmount,
            counterparty: customer.walletAddress || customer.userCode,
            note: `Received ${currency} transfer`,
            status: "completed",
          },
          { transaction },
        );
      }
    }

    await WalletTransaction.create(
      {
        userCode: customer.userCode,
        type: "TRANSFER_OUT",
        fromCurrency: currency,
        fromAmount: transferAmount,
        counterparty: recipientAddress,
        note: recipientCredited
          ? `Sent ${currency} transfer`
          : `Sent ${currency} transfer (external address)`,
        status: "completed",
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: `Transferred ${transferAmount} ${currency}`,
      rmBalance: String(field === "RM" ? nextBalance : Number(wallet.RM || 0)),
      lytBalance: String(
        field === "Elixir" ? nextBalance : Number(wallet.Elixir || 0),
      ),
      recipientCredited,
    });
  } catch (err) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/transactions ─────────────────────────────────────────
//
// Full wallet transaction history for the logged-in customer
// (swaps, transfers, deposits, stake/unstake).
//
router.get("/transactions", authenticate, async (req, res) => {
  try {
    const customer = await User.findByPk(req.user.id);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const transactions = await WalletTransaction.findAll({
      where: { userCode: customer.userCode },
      order: [["createdAt", "DESC"]],
      limit: 200,
    });

    return res.json({ success: true, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
