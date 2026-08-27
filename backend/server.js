/**
 * backend/server.js
 * Main Express server entry point
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { connectMySQL, connectMongoDB } = require("./config/database");
const blockchainService = require("./config/blockchain");
const { initMailer } = require("./config/mailer");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const paymentRoutes = require("./routes/payment.routes");
const orderRoutes = require("./routes/order.routes");
const stakingRoutes = require("./routes/staking.routes");
const adminRoutes = require("./routes/admin.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const escrowRoutes = require("./routes/escrow.routes");
const cartRoutes = require("./routes/cart.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────────────────

// Browsers compare origins exactly, so a trailing slash, a stray path, or a
// different case in FRONTEND_URL silently breaks every cross-origin request:
// the preflight still returns 204, but without an Access-Control-Allow-Origin
// header the browser blocks the follow-up POST. Normalising both sides removes
// that failure mode. FRONTEND_URL accepts a comma-separated list so preview
// deployments can be allowed alongside production.
function normaliseOrigin(value) {
  if (!value) return null;
  try {
    const { protocol, host } = new URL(value.trim());
    return `${protocol}//${host}`.toLowerCase();
  } catch {
    return null;
  }
}

const allowedOrigins = [
  "http://localhost:3000",
  ...(process.env.FRONTEND_URL || "").split(","),
]
  .map(normaliseOrigin)
  .filter(Boolean);

console.log("🌐  Allowed CORS origins:", allowedOrigins.join(", ") || "(none)");

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/non-browser callers (curl, health checks) send no Origin.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(normaliseOrigin(origin))) {
        return callback(null, true);
      }

      console.warn(`⚠️  Blocked CORS origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/staking", stakingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/cart", cartRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    databases: {
      mysql: "connected",
      mongodb: "connected",
    },
    blockchain: {
      status: blockchainService.initialized ? "connected" : "disconnected",
      network:
        process.env.HARDHAT_RPC_URL &&
        !process.env.HARDHAT_RPC_URL.includes("127.0.0.1")
          ? "remote"
          : "local",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────

async function start() {
  console.log("\n========================================================");
  console.log("  Blockchain E-Commerce Backend");
  console.log("  FYP: Chan Zean Yeet TP070394 — APD3F2601");
  console.log("========================================================\n");

  await connectMySQL(); // Centralised DB
  await connectMongoDB(); // Decentralised DB
  await blockchainService.init(); // Blockchain service
  initMailer(); // Outbound email (password resets)

  app.listen(PORT, () => {
    console.log(`\n🚀  API server running at http://localhost:${PORT}`);
    console.log(`    Health: http://localhost:${PORT}/api/health\n`);
  });
}

start();
