/**
 * backend/config/mailer.js
 *
 * Outbound email for account flows (currently password resets).
 *
 * Two modes:
 *   1. SMTP configured (SMTP_HOST + SMTP_USER + SMTP_PASS in .env)
 *      → a real email is sent through that SMTP server.
 *   2. Not configured (default in local development)
 *      → nothing leaves the machine; the message and reset link are printed
 *        to the server console so the flow can still be tested end to end.
 *
 * Mode 2 exists so the feature works out of the box without shipping
 * credentials in the repo. Set the SMTP_* variables to switch to real email.
 */

const nodemailer = require("nodemailer");

let transporter = null;
let smtpReady = false;

function initMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(
      "ℹ️  SMTP not configured — password reset emails will be logged to the console instead of sent.",
    );
    smtpReady = false;
    return;
  }

  const port = Number(SMTP_PORT) || 587;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  smtpReady = true;
  console.log(`✅  Mailer ready → ${SMTP_HOST}:${port}`);
}

/**
 * Send an email. Falls back to a console dump when SMTP is not configured.
 * Never throws: a mail failure must not reveal anything to the caller or
 * break the request that triggered it.
 *
 * @returns {Promise<boolean>} true if handed to an SMTP server
 */
async function sendMail({ to, subject, text, html }) {
  if (!smtpReady) {
    console.log("\n────────── EMAIL (dev console fallback) ──────────");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("");
    console.log(text);
    console.log("──────────────────────────────────────────────────\n");
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Elixir Commerce" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("✉️  Failed to send email:", err.message);
    return false;
  }
}

/**
 * Password reset email. `resetUrl` already carries the one-time token.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, expiresMinutes }) {
  const subject = "Reset your Elixir Commerce password";

  const text = [
    `Hi ${name || "there"},`,
    "",
    "We received a request to reset the password for your Elixir Commerce account.",
    "Open the link below to choose a new password:",
    "",
    resetUrl,
    "",
    `This link expires in ${expiresMinutes} minutes and can only be used once.`,
    "If you didn't request a password reset, you can safely ignore this email —",
    "your password will not change.",
    "",
    "— Elixir Commerce",
  ].join("\n");

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#0c1524;padding:32px;color:#e2e8f0">
    <div style="max-width:520px;margin:0 auto;background:#111b31;border-radius:16px;padding:32px;border:1px solid rgba(148,163,184,0.15)">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7dd3fc;font-weight:700">Elixir Commerce</p>
      <h1 style="margin:0 0 16px;font-size:24px;color:#f8fafc">Reset your password</h1>
      <p style="margin:0 0 12px;line-height:1.6;color:#cbd5e1">Hi ${escapeHtml(name || "there")},</p>
      <p style="margin:0 0 20px;line-height:1.6;color:#94a3b8">
        We received a request to reset the password for your account.
        Click the button below to choose a new one.
      </p>
      <p style="margin:0 0 24px">
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 22px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#818cf8);color:#04101f;font-weight:800;text-decoration:none">
          Choose a new password
        </a>
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.6">
        This link expires in ${expiresMinutes} minutes and can only be used once.
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.6">
        If you didn't request a password reset, you can safely ignore this email — your password will not change.
      </p>
      <p style="margin:0;font-size:12px;color:#475569;word-break:break-all">
        Button not working? Paste this into your browser:<br>${resetUrl}
      </p>
    </div>
  </div>`;

  return sendMail({ to, subject, text, html });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { initMailer, sendMail, sendPasswordResetEmail };
