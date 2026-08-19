/**
 * backend/routes/order.routes.js
 * Order history from MySQL + blockchain audit trail from MongoDB
 */

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { Order, OrderItem, Product, User } = require("../models/mysql.models");
const { BlockchainLog } = require("../models/blockchainLog.model");

// Reusable include for an order's line items (multi-product baskets).
const ITEMS_INCLUDE = {
  model: OrderItem,
  as: "items",
  include: [
    { model: Product, as: "product", attributes: ["id", "name", "imageUrl", "category"] },
  ],
};
const blockchainService = require("../config/blockchain");

const router = express.Router();

// GET /api/orders/my — logged-in customer's orders
router.get("/my", authenticate, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.user.id },
      include: [
        { model: Product, as: "product", attributes: ["id", "name", "imageUrl", "priceEth"] },
        { model: User,    as: "merchant", attributes: ["id", "name"] },
        ITEMS_INCLUDE,
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/merchant — merchant's sales
router.get("/merchant", authenticate, requireRole("merchant", "admin"), async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { merchantId: req.user.id },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "imageUrl", "priceEth", "priceMyr", "category"],
        },
        {
          model: User,
          as: "customer",
          attributes: ["id", "name", "email", "walletAddress"],
        },
        ITEMS_INCLUDE,
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/merchant/revenue — merchant revenue & product statistics
router.get(
  "/merchant/revenue",
  authenticate,
  requireRole("merchant", "admin"),
  async (req, res) => {
    try {
      const RM_PER_ETH = 12000;

      const orders = await Order.findAll({
        where: { merchantId: req.user.id },
        include: [
          { model: Product, as: "product", attributes: ["id", "name", "category"] },
          ITEMS_INCLUDE,
        ],
        order: [["createdAt", "DESC"]],
      });

      let totalRevenueEth = 0;
      let totalItemsSold = 0;
      const productMap = {};
      const stageCounts = [0, 0, 0, 0, 0]; // placed, processing, packed, shipped, delivered

      for (const o of orders) {
        const qty = Number(o.quantity || 1);
        const revenue = Number(o.totalPriceEth || 0);
        // Cancelled orders don't count toward revenue.
        const counts = o.status !== "cancelled";

        if (counts) {
          totalRevenueEth += revenue;
          totalItemsSold += qty;
        }

        const stage = Number(o.fulfillmentStage || 0);
        if (stage >= 0 && stage < stageCounts.length) stageCounts[stage] += 1;

        // Aggregate per-product stats from line items (multi-item baskets),
        // falling back to the single product for legacy orders.
        const lines =
          o.items && o.items.length > 0
            ? o.items.map((it) => ({
                productId: it.productId,
                name: it.productName || it.product?.name || "Unknown product",
                category: it.product?.category || "—",
                units: Number(it.quantity || 0),
                revenueEth: Number(it.unitPriceEth || 0) * Number(it.quantity || 0),
              }))
            : [
                {
                  productId: o.productId,
                  name: o.product?.name || "Unknown product",
                  category: o.product?.category || "—",
                  units: qty,
                  revenueEth: revenue,
                },
              ];

        for (const line of lines) {
          const pid = line.productId || line.name;
          if (!productMap[pid]) {
            productMap[pid] = {
              productId: line.productId,
              name: line.name,
              category: line.category,
              unitsSold: 0,
              orders: 0,
              revenueEth: 0,
            };
          }
          if (counts) {
            productMap[pid].unitsSold += line.units;
            productMap[pid].revenueEth += line.revenueEth;
          }
          productMap[pid].orders += 1;
        }
      }

      const productStats = Object.values(productMap)
        .map((p) => ({
          ...p,
          revenueEth: Number(p.revenueEth.toFixed(8)),
          revenueRm: Number((p.revenueEth * RM_PER_ETH).toFixed(2)),
        }))
        .sort((a, b) => b.revenueEth - a.revenueEth);

      return res.json({
        success: true,
        stats: {
          totalOrders: orders.length,
          totalItemsSold,
          totalRevenueEth: Number(totalRevenueEth.toFixed(8)),
          totalRevenueRm: Number((totalRevenueEth * RM_PER_ETH).toFixed(2)),
          activeOrders: orders.filter(
            (o) => o.status !== "cancelled" && Number(o.fulfillmentStage || 0) < 4,
          ).length,
          deliveredOrders: orders.filter(
            (o) => Number(o.fulfillmentStage || 0) === 4,
          ).length,
          stageCounts,
          productStats,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/orders/:id/fulfillment — merchant updates delivery progress
router.put(
  "/:id/fulfillment",
  authenticate,
  requireRole("merchant", "admin"),
  async (req, res) => {
    try {
      const { stage } = req.body;
      const nextStage = Number(stage);

      if (!Number.isInteger(nextStage) || nextStage < 0 || nextStage > 4) {
        return res.status(400).json({
          success: false,
          message: "Stage must be an integer between 0 and 4",
        });
      }

      const order = await Order.findByPk(req.params.id);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.merchantId !== req.user.id && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ success: false, message: "Not your order" });
      }

      await order.update({ fulfillmentStage: nextStage });

      return res.json({
        success: true,
        message: "Delivery progress updated",
        orderId: order.id,
        fulfillmentStage: nextStage,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/orders/:id — single order detail
router.get("/:id", authenticate, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: Product, as: "product" },
        { model: User, as: "customer", attributes: ["id", "name", "email", "walletAddress"] },
        { model: User, as: "merchant", attributes: ["id", "name", "walletAddress"] },
        ITEMS_INCLUDE,
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Fetch blockchain log from MongoDB for this order
    const blockchainLog = await BlockchainLog.findOne({ orderId: order.id });

    return res.json({ success: true, order, blockchainLog });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/blockchain/logs — admin: full audit trail from MongoDB
router.get("/blockchain/logs", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { eventType, address, page = 1, limit = 50 } = req.query;
    const query = {};
    if (eventType) query.eventType = eventType;
    if (address) {
      query.$or = [{ buyerAddress: address }, { sellerAddress: address }];
    }

    const logs = await BlockchainLog.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await BlockchainLog.countDocuments(query);

    return res.json({ success: true, total, page: parseInt(page), logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/blockchain/onchain/:address — on-chain order history via ethers.js
router.get("/blockchain/onchain/:address", authenticate, async (req, res) => {
  try {
    const orders = await blockchainService.getBuyerOrders(req.params.address);
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
