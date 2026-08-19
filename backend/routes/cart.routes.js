/**
 * backend/routes/cart.routes.js
 *
 * Shopping cart for customers. The cart is a staging area before checkout;
 * items are grouped by seller on the frontend and checked out per store into
 * a single multi-item order (see payment.routes escrow/escrow-token/rm).
 *
 *   GET    /api/cart          — current customer's cart (items + product/seller)
 *   POST   /api/cart          — add { productId, quantity } (upsert / increment)
 *   PUT    /api/cart/:id      — set an item's quantity
 *   DELETE /api/cart/:id      — remove one item
 *   DELETE /api/cart          — clear the whole cart
 *
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

const express = require("express");
const { authenticate } = require("../middleware/auth");
const { Cart, Product, User } = require("../models/mysql.models");

const router = express.Router();

// Shape a cart row for the frontend (includes seller wallet for escrow).
function serializeItem(row) {
  const p = row.product;
  const merchant = p?.merchant;
  return {
    id: row.id,
    productId: row.productId,
    quantity: Number(row.quantity || 1),
    name: p?.name || "Product",
    priceEth: p ? String(p.priceEth) : "0",
    priceMyr: p?.priceMyr ? String(p.priceMyr) : "",
    imageUrl: p?.imageUrl || "",
    category: p?.category || "",
    stock: p?.stock ?? 0,
    isActive: p?.isActive ?? true,
    merchantId: merchant?.id || p?.merchantId || null,
    merchantName: merchant?.name || "Marketplace",
    merchantWallet: merchant?.metamaskAddress || merchant?.walletAddress || "",
    merchantHasMetamask: Boolean(merchant?.metamaskAddress),
  };
}

async function loadCart(customerId) {
  const rows = await Cart.findAll({
    where: { customerId },
    include: [
      {
        model: Product,
        as: "product",
        include: [
          {
            model: User,
            as: "merchant",
            attributes: ["id", "name", "metamaskAddress", "walletAddress"],
          },
        ],
      },
    ],
    order: [["createdAt", "ASC"]],
  });
  return rows.map(serializeItem);
}

// ── GET /api/cart ───────────────────────────────────────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    const items = await loadCart(req.user.id);
    return res.json({ success: true, items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/cart ──────────────────────────────────────────────────────────
// Add a product to the cart. If it's already there, increment the quantity.
router.post("/", authenticate, async (req, res) => {
  try {
    const { productId } = req.body;
    const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    const product = await Product.findByPk(productId);
    if (!product || !product.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Product unavailable" });
    }

    const existing = await Cart.findOne({
      where: { customerId: req.user.id, productId },
    });
    const desired = (existing ? Number(existing.quantity) : 0) + qty;

    if (product.stock < desired) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} in stock`,
      });
    }

    if (existing) {
      await existing.update({ quantity: desired });
    } else {
      await Cart.create({
        customerId: req.user.id,
        productId,
        quantity: qty,
      });
    }

    const items = await loadCart(req.user.id);
    return res.json({ success: true, message: "Added to cart", items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/cart/:id ─────────────────────────────────────────────────────
// Set an item's quantity (min 1, capped at stock).
router.put("/:id", authenticate, async (req, res) => {
  try {
    const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    const row = await Cart.findByPk(req.params.id, {
      include: [{ model: Product, as: "product" }],
    });
    if (!row || row.customerId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found" });
    }
    if (row.product && row.product.stock < qty) {
      return res
        .status(400)
        .json({ success: false, message: `Only ${row.product.stock} in stock` });
    }

    await row.update({ quantity: qty });

    const items = await loadCart(req.user.id);
    return res.json({ success: true, items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/cart/:id ──────────────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const row = await Cart.findByPk(req.params.id);
    if (!row || row.customerId !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found" });
    }
    await row.destroy();

    const items = await loadCart(req.user.id);
    return res.json({ success: true, items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/cart ──────────────────────────────────────────────────────
router.delete("/", authenticate, async (req, res) => {
  try {
    await Cart.destroy({ where: { customerId: req.user.id } });
    return res.json({ success: true, items: [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
