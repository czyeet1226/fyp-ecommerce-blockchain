/**
 * backend/routes/auth.routes.js
 * Registration & Login
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const { mysqlDB } = require("../config/database");
const { authenticate } = require("../middleware/auth");
const { Op } = require("sequelize");
const {
  User,
  CustomerWallet,
  getNextUserCode,
} = require("../models/mysql.models");

const blockchainService = require("../config/blockchain");

const router = express.Router();

function formatWallet(wallet) {
  if (!wallet) {
    return {
      ethBalance: "0",
      lytBalance: "0",
      rmBalance: "0",
      walletAddress: "",
      hideBalance: false,
    };
  }

  return {
    ethBalance: String(wallet.ETH ?? 0),
    lytBalance: String(wallet.Elixir ?? 0),
    rmBalance: String(wallet.RM ?? 0),
    walletAddress: wallet.walletAddress || "",
    hideBalance: Boolean(wallet.hideBalance),
  };
}

// ── GET /api/auth/me ─────────────────────────────────────────────────────

router.get("/me", authenticate, async (req, res) => {
  try {
    const wallet = await CustomerWallet.findOne({
      where: { userCode: req.user.userCode },
    });

    return res.json({
      success: true,
      user: {
        id: req.user.id,
        userCode: req.user.userCode,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || "",
        address: req.user.address || "",
        role: req.user.role,
        walletAddress: req.user.walletAddress,
        metamaskAddress: req.user.metamaskAddress || "",
        createdAt: req.user.createdAt,
      },
      wallet: formatWallet(wallet),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PUT /api/auth/profile ──────────────────────────────────────────────────
//
// Update the logged-in user's profile: name, email, phone, address, and
// optionally the password (requires currentPassword for verification).
//
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, email, phone, address, currentPassword, newPassword } =
      req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const updates = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res
          .status(400)
          .json({ success: false, message: "Name cannot be empty" });
      }
      updates.name = trimmedName;
    }

    if (email !== undefined) {
      const trimmedEmail = String(email).trim().toLowerCase();
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res
          .status(400)
          .json({ success: false, message: "Enter a valid email address" });
      }
      if (trimmedEmail !== user.email) {
        const existing = await User.findOne({
          where: { email: trimmedEmail, id: { [Op.ne]: user.id } },
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "This email is already used by another account",
          });
        }
      }
      updates.email = trimmedEmail;
    }

    if (phone !== undefined) {
      updates.phone = String(phone).trim();
    }

    if (address !== undefined) {
      updates.address = String(address).trim();
    }

    // Optional password change — requires the current password.
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set a new password",
        });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect" });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await user.update(updates);

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role,
        walletAddress: user.walletAddress,
        metamaskAddress: user.metamaskAddress || "",
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "This email is already used by another account",
      });
    }
    console.error("Profile update error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/link-metamask ──────────────────────────────────────────
//
// Bind a MetaMask address to the logged-in account. Enforces:
//   • one MetaMask address per user (cannot switch to a different one)
//   • an address cannot be shared across multiple e-commerce accounts
//
router.post("/link-metamask", authenticate, async (req, res) => {
  try {
    const { metamaskAddress } = req.body;

    if (!metamaskAddress || !ethers.isAddress(metamaskAddress)) {
      return res
        .status(400)
        .json({ success: false, message: "A valid MetaMask address is required" });
    }

    // Normalise to checksum form for consistent comparisons/storage.
    const address = ethers.getAddress(metamaskAddress);
    const user = await User.findByPk(req.user.id);

    // This account already has a bound wallet.
    if (user.metamaskAddress) {
      if (user.metamaskAddress.toLowerCase() === address.toLowerCase()) {
        return res.json({
          success: true,
          message: "MetaMask wallet already linked",
          metamaskAddress: user.metamaskAddress,
        });
      }
      return res.status(409).json({
        success: false,
        code: "ALREADY_BOUND_TO_USER",
        message:
          "This account is already linked to a different MetaMask wallet. Only one wallet is allowed per account.",
        metamaskAddress: user.metamaskAddress,
      });
    }

    // The address must not belong to another account.
    const existing = await User.findOne({
      where: {
        metamaskAddress: address,
        id: { [Op.ne]: user.id },
      },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: "ADDRESS_IN_USE",
        message:
          "This MetaMask wallet is already linked to another account and cannot be shared.",
      });
    }

    await user.update({ metamaskAddress: address });

    return res.json({
      success: true,
      message: "MetaMask wallet linked to your account",
      metamaskAddress: address,
    });
  } catch (err) {
    // Unique constraint violation fallback
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        code: "ADDRESS_IN_USE",
        message:
          "This MetaMask wallet is already linked to another account and cannot be shared.",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────

router.post("/register", async (req, res) => {
  let transaction;

  try {
    transaction = await mysqlDB.transaction();
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate a Hardhat-compatible wallet for this user (simulated blockchain account)
    const wallet = ethers.Wallet.createRandom();
    const userCode = await getNextUserCode();

    // Fund the new wallet with 10 ETH from the admin/deployer account so they can transact on Hardhat
    try {
      if (blockchainService.initialized && blockchainService.adminWallet) {
        const tx = await blockchainService.adminWallet.sendTransaction({
          to: wallet.address,
          value: ethers.parseEther("10.0"),
        });
        await tx.wait();
      }
    } catch (err) {
      console.warn("⚠️ Failed to fund new wallet with ETH:", err.message);
    }

    const user = await User.create(
      {
        userCode,
        name,
        email,
        passwordHash,
        role: ["customer", "merchant", "admin"].includes(role) ? role : "customer",
        walletAddress: wallet.address,
        walletPrivateKey: wallet.privateKey, // Development only!
      },
      { transaction },
    );

    if (user.role === "customer") {
      await CustomerWallet.create(
        {
          userCode: user.userCode,
          RM: 0,
          Elixir: 0,
          ETH: 0,
          hideBalance: false,
          walletAddress: user.walletAddress,
        },
        { transaction },
      );
    }

    await transaction.commit();

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password required" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        userCode: user.userCode,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
