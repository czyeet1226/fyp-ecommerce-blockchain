/**
 * backend/routes/auth.routes.js
 * Registration & Login
 */

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const { mysqlDB } = require("../config/database");
const { authenticate } = require("../middleware/auth");
const { Op } = require("sequelize");
const { sendPasswordResetEmail, addAuthorizedRecipient } = require("../config/mailer");
const {
  User,
  CustomerWallet,
  getNextUserCode,
} = require("../models/mysql.models");

const blockchainService = require("../config/blockchain");

const router = express.Router();

// ── Password reset configuration ──────────────────────────────────────────

const RESET_TOKEN_TTL_MINUTES = 30;

/** Hash a raw reset token so only the digest is ever stored. */
function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Where the emailed link points. Set APP_URL in .env for other hosts. */
function buildResetUrl(rawToken, email) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
  const params = new URLSearchParams({ token: rawToken, email });
  return `${base}/reset-password?${params.toString()}`;
}

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

    // Best-effort: register the new user as an authorized Mailgun sandbox
    // recipient so the forgot-password flow works for them. Mailgun still
    // requires the user to click a one-time confirmation email; this call
    // only saves us from doing that step manually per account. Never blocks
    // or fails registration if it doesn't succeed.
    addAuthorizedRecipient(user.email).catch(() => {});

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

// ── POST /api/auth/forgot-password ────────────────────────────────────────
//
// Start a password reset. Emails a one-time link to the account owner.
//
// The response is deliberately identical whether or not the email exists, so
// this endpoint cannot be used to discover which addresses have accounts.
//
router.post("/forgot-password", async (req, res) => {
  // Same body for every outcome — do not leak account existence.
  const genericResponse = {
    success: true,
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid email address" });
    }

    const user = await User.findOne({ where: { email } });

    // Unknown address, or a deactivated account: stop here but still answer
    // with the generic message.
    if (!user || !user.isActive) {
      return res.json(genericResponse);
    }

    // 32 random bytes → 64 hex chars. Only the hash is persisted.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await user.update({
      resetTokenHash: hashResetToken(rawToken),
      resetTokenExpiresAt: expiresAt,
    });

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: buildResetUrl(rawToken, user.email),
      expiresMinutes: RESET_TOKEN_TTL_MINUTES,
    });

    return res.json(genericResponse);
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────
//
// Complete a password reset using the token from the emailed link.
// The token is single-use: it is cleared as soon as the password changes.
//
router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const token = String(req.body.token || "").trim();
    const { newPassword } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or incomplete",
      });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ where: { email } });

    // One message for every failure mode (wrong email, wrong token, expired,
    // already used) so nothing can be probed through this endpoint.
    const invalid = {
      success: false,
      code: "INVALID_RESET_TOKEN",
      message:
        "This password reset link is invalid or has expired. Please request a new one.",
    };

    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      return res.status(400).json(invalid);
    }

    if (user.resetTokenExpiresAt.getTime() < Date.now()) {
      // Expired: clear it so the row does not keep a stale token around.
      await user.update({ resetTokenHash: null, resetTokenExpiresAt: null });
      return res.status(400).json(invalid);
    }

    // Constant-time compare of the digests.
    const provided = Buffer.from(hashResetToken(token), "hex");
    const stored = Buffer.from(user.resetTokenHash, "hex");
    const matches =
      provided.length === stored.length &&
      crypto.timingSafeEqual(provided, stored);

    if (!matches) {
      return res.status(400).json(invalid);
    }

    await user.update({
      passwordHash: await bcrypt.hash(newPassword, 12),
      // Burn the token — a link works exactly once.
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });

    return res.json({
      success: true,
      message: "Password updated. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
