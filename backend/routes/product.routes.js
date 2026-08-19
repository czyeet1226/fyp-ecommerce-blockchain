/**
 * backend/routes/product.routes.js
 */

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { Product, User } = require("../models/mysql.models");
const { getPlan, canAddProduct } = require("../config/plans");

const router = express.Router();

// GET /api/products — public product listing
router.get("/", async (req, res) => {
  try {
    const { category, search, merchantId, page = 1, limit = 20 } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;
    if (merchantId) where.merchantId = merchantId;
    if (search) {
      const { Op } = require("sequelize");
      where.name = { [Op.like]: `%${search}%` };
    }

    const products = await Product.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "merchant",
          attributes: ["id", "name", "walletAddress", "metamaskAddress"],
        },
      ],
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
      order:   [["createdAt", "DESC"]],
    });

    return res.json({
      success:  true,
      total:    products.count,
      page:     parseInt(page),
      products: products.rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/mine — merchant's own products (including deactivated)
router.get("/mine", authenticate, requireRole("merchant", "admin"), async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { merchantId: req.user.id },
      include: [
        {
          model: User,
          as: "merchant",
          attributes: ["id", "name", "walletAddress", "metamaskAddress"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, total: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "merchant",
          attributes: ["id", "name", "walletAddress", "metamaskAddress"],
        },
      ],
    });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products — merchant creates product
router.post("/", authenticate, requireRole("merchant", "admin"), async (req, res) => {
  try {
    const { name, description, priceEth, priceMyr, category, stock, imageUrl } = req.body;
    if (!name || !priceEth) {
      return res.status(400).json({ success: false, message: "Name and priceEth are required" });
    }

    // Enforce the seller's subscription plan product limit.
    if (req.user.role === "merchant") {
      const activeCount = await Product.count({
        where: { merchantId: req.user.id, isActive: true },
      });
      const plan = getPlan(req.user.plan);
      if (!canAddProduct(req.user.plan, activeCount)) {
        return res.status(403).json({
          success: false,
          code: "PLAN_LIMIT_REACHED",
          message: `Your ${plan.label} plan allows up to ${plan.productLimit} active products. Upgrade your plan to list more.`,
        });
      }
    }

    const product = await Product.create({
      merchantId: req.user.id,
      name, description, priceEth, priceMyr, category,
      stock: stock || 0,
      imageUrl,
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id — merchant updates product
router.put("/:id", authenticate, requireRole("merchant", "admin"), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (product.merchantId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not your product" });
    }

    // Reactivating a product counts against the plan's active-product limit.
    if (
      req.user.role === "merchant" &&
      req.body.isActive === true &&
      product.isActive === false
    ) {
      const activeCount = await Product.count({
        where: { merchantId: req.user.id, isActive: true },
      });
      const plan = getPlan(req.user.plan);
      if (!canAddProduct(req.user.plan, activeCount)) {
        return res.status(403).json({
          success: false,
          code: "PLAN_LIMIT_REACHED",
          message: `Your ${plan.label} plan allows up to ${plan.productLimit} active products. Upgrade to reactivate more.`,
        });
      }
    }

    await product.update(req.body);
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", authenticate, requireRole("merchant", "admin"), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    await product.update({ isActive: false });
    return res.json({ success: true, message: "Product deactivated" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
