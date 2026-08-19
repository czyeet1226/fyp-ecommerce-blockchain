/**
 * backend/config/database.js
 *
 * Two-database architecture:
 *
 *  CENTRALISED  → MySQL via Sequelize
 *    Stores:  users, merchants, products, orders (metadata), cart
 *    Reason:  Relational integrity for product catalog & user accounts.
 *
 *  DECENTRALISED → MongoDB via Mongoose
 *    Stores:  blockchain transaction logs, audit trail, token history
 *    Reason:  Schema-flexible, append-only log that mirrors on-chain events.
 *             Represents the "off-chain decentralised record" that complements
 *             the immutable blockchain state.
 */

const { Sequelize } = require("sequelize");
const mongoose = require("mongoose");
require("dotenv").config();

// ── MySQL (Centralised) ────────────────────────────────────────────────────

const mysqlDB = new Sequelize(
  process.env.MYSQL_DATABASE || "ecommerce_central",
  process.env.MYSQL_USER || "root",
  process.env.MYSQL_PASSWORD || "password",
  {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

const connectMySQL = async () => {
  try {
    await mysqlDB.authenticate();
    await pruneDuplicateIndexes(); // reclaim keys before alter (see fn below)
    await relaxLegacyConstraints(); // make orders.productId nullable before alter
    await mysqlDB.sync({ alter: true }); // auto-create/alter tables in dev
    await ensureUserCodeColumn();
    await ensureCustomerWalletRows();
    await ensureAdminUser();
    await ensureStakingTiers();
    await ensureSellerPlans();
    console.log("✅  MySQL (Centralised DB) connected");
  } catch (err) {
    console.error("❌  MySQL connection failed:", err.message);
    process.exit(1);
  }
};

/**
 * Sequelize's `sync({ alter: true })` re-creates a UNIQUE index for every
 * column marked `unique: true` on each startup, because MySQL's index
 * introspection doesn't always match what Sequelize expects. Over many
 * restarts this piles up duplicate indexes (email_2, email_3, metamaskAddress_4…)
 * until the table hits MySQL's hard limit of 64 keys and sync fails with
 * "Too many keys specified".
 *
 * This prunes those auto-generated duplicate indexes (any index named
 * `<column>_<number>`) before sync runs, keeping the canonical index and
 * reclaiming key slots. It's safe: the original named unique index and all
 * foreign-key indexes are left untouched.
 */
const pruneDuplicateIndexes = async () => {
  const tables = ["users", "customer_wallet", "staking_tiers"];
  for (const table of tables) {
    try {
      const [indexes] = await mysqlDB.query(`SHOW INDEX FROM \`${table}\``);
      const duplicates = new Set();
      for (const idx of indexes) {
        const name = idx.Key_name;
        if (name === "PRIMARY") continue;
        // Auto-generated duplicates look like "email_2", "metamaskAddress_15".
        if (/_\d+$/.test(name)) duplicates.add(name);
      }
      for (const name of duplicates) {
        try {
          await mysqlDB.query(
            `ALTER TABLE \`${table}\` DROP INDEX \`${name}\``,
          );
        } catch {
          /* index may be referenced by a FK — skip it */
        }
      }
      if (duplicates.size > 0) {
        console.log(
          `🧹  Pruned ${duplicates.size} duplicate index(es) on \`${table}\``,
        );
      }
    } catch {
      /* table may not exist yet on first run — non-fatal */
    }
  }
};

/**
 * The Order model changed so that `productId` is now nullable (basket orders
 * keep their products in `order_items`). Sequelize's alter tries to add an
 * `ON DELETE SET NULL` foreign key on `orders.productId` before it relaxes the
 * column, which MySQL rejects while the column is still NOT NULL.
 *
 * This drops the FK on `orders.productId` and makes the column nullable using
 * the EXACT type/charset/collation of `products.id`, so the subsequent sync
 * can recreate a compatible `SET NULL` foreign key.
 */
const relaxLegacyConstraints = async () => {
  try {
    const [cols] = await mysqlDB.query(
      `SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
         AND COLUMN_NAME = 'id'`,
    );
    if (!cols || cols.length === 0) return; // fresh DB — sync will create it

    const { COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME } = cols[0];
    const charset = CHARACTER_SET_NAME ? ` CHARACTER SET ${CHARACTER_SET_NAME}` : "";
    const collate = COLLATION_NAME ? ` COLLATE ${COLLATION_NAME}` : "";

    const [fks] = await mysqlDB.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
         AND COLUMN_NAME = 'productId' AND REFERENCED_TABLE_NAME IS NOT NULL`,
    );
    for (const fk of fks) {
      await mysqlDB
        .query(`ALTER TABLE \`orders\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``)
        .catch(() => {});
    }
    await mysqlDB
      .query(
        `ALTER TABLE \`orders\` MODIFY COLUMN \`productId\` ${COLUMN_TYPE}${charset}${collate} NULL`,
      )
      .catch(() => {});
  } catch {
    /* orders table may not exist on first run — non-fatal */
  }
};

const ensureUserCodeColumn = async () => {
  const queryInterface = mysqlDB.getQueryInterface();
  const tableDefinition = await queryInterface.describeTable("users");

  if (!tableDefinition.userCode) {
    await mysqlDB.query(
      "ALTER TABLE `users` ADD COLUMN `userCode` VARCHAR(8) UNIQUE NULL AFTER `id`",
    );
  }

  const [rows] = await mysqlDB.query(
    "SELECT `id`, `userCode` FROM `users` ORDER BY `createdAt` ASC",
  );

  let counter = 1;
  for (const row of rows) {
    if (row.userCode) {
      const parsed = parseInt(String(row.userCode).replace(/^U/i, ""), 10);
      if (Number.isFinite(parsed) && parsed >= counter) {
        counter = parsed + 1;
      }
      continue;
    }

    const generatedCode = `U${String(counter).padStart(4, "0")}`;
    await mysqlDB.query(
      "UPDATE `users` SET `userCode` = :userCode WHERE `id` = :id",
      {
        replacements: {
          userCode: generatedCode,
          id: row.id,
        },
      },
    );
    counter += 1;
  }
};

const ensureCustomerWalletRows = async () => {
  const { User, CustomerWallet } = require("../models/mysql.models");

  const customers = await User.findAll({
    where: { role: "customer" },
    order: [["createdAt", "ASC"]],
  });

  for (const customer of customers) {
    const [walletRow, created] = await CustomerWallet.findOrCreate({
      where: { userCode: customer.userCode },
      defaults: {
        userCode: customer.userCode,
        RM: 0,
        Elixir: 0,
        ETH: 0,
        hideBalance: false,
        walletAddress: customer.walletAddress,
      },
    });

    if (!created && walletRow.walletAddress !== customer.walletAddress) {
      await walletRow.update({ walletAddress: customer.walletAddress });
    }
  }
};

// Seed a default admin account linked to the platform/treasury wallet.
// The admin manages the platform and owns the on-chain ETH + Elixir reserve.
const ensureAdminUser = async () => {
  const { ethers } = require("ethers");
  const bcrypt = require("bcryptjs");
  const { User } = require("../models/mysql.models");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@elixir.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // Derive the platform wallet address from the admin private key
  // (defaults to Hardhat account[0], the contract deployer / Elixir treasury).
  const adminKey =
    process.env.ADMIN_PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  let adminAddress = null;
  try {
    adminAddress = new ethers.Wallet(adminKey).address;
  } catch {
    adminAddress = null;
  }

  const existing = await User.findOne({ where: { email: adminEmail } });
  if (existing) {
    // Keep the admin wallet address in sync with the treasury wallet.
    if (adminAddress && existing.walletAddress !== adminAddress) {
      try {
        await existing.update({ walletAddress: adminAddress });
      } catch {
        /* address may collide with another row — ignore in dev */
      }
    }
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  try {
    await User.create({
      name: "Platform Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      walletAddress: adminAddress,
    });
    console.log(`✅  Admin account ready → ${adminEmail} / ${adminPassword}`);
  } catch (err) {
    console.warn("⚠️  Could not seed admin user:", err.message);
  }
};

// Seed the default staking tiers (admin can later edit their APY).
const ensureStakingTiers = async () => {
  const { StakingTier } = require("../models/mysql.models");
  const defaults = [
    { days: 30, apy: 8, label: "30 Days", sortOrder: 1 },
    { days: 90, apy: 14, label: "90 Days", sortOrder: 2 },
    { days: 180, apy: 22, label: "180 Days", sortOrder: 3 },
    { days: 365, apy: 35, label: "365 Days", sortOrder: 4 },
  ];
  for (const tier of defaults) {
    await StakingTier.findOrCreate({
      where: { days: tier.days },
      defaults: tier,
    });
  }
};

// Give existing sellers a subscription renewal date if they don't have one.
const ensureSellerPlans = async () => {
  const { User } = require("../models/mysql.models");
  const { BILLING_PERIOD_MS } = require("./plans");

  const sellers = await User.findAll({ where: { role: "merchant" } });
  for (const seller of sellers) {
    const updates = {};
    if (!seller.plan) updates.plan = "starter";
    if (!seller.planRenewsAt) {
      updates.planRenewsAt = new Date(Date.now() + BILLING_PERIOD_MS);
    }
    if (Object.keys(updates).length > 0) {
      try {
        await seller.update(updates);
      } catch {
        /* non-critical */
      }
    }
  }
};

// ── MongoDB (Decentralised audit log) ─────────────────────────────────────

const connectMongoDB = async () => {
  try {
    const uri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/ecommerce_blockchain";
    await mongoose.connect(uri);
    console.log("✅  MongoDB (Decentralised DB) connected");
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = { mysqlDB, connectMySQL, connectMongoDB };
