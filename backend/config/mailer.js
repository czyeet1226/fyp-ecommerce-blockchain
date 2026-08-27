/**
 * backend/config/mailer.js
 *
 * Outbound email for account flows (currently password resets).
 *
 * Two modes:
 *   1. Mailgun HTTP API configured (MAILGUN_API_KEY + MAILGUN_DOMAIN in .env)
 *      → a real email is sent through Mailgun's REST API (port 443, works on Railway).
 *   2. Not configured (default in local development)
 *      → nothing leaves the machine; the message and reset link are printed
 *        to the server console so the flow can still be tested end to end.
 */

let mailgunReady = false;
let mailgunApiKey = null;
let mailgunDomain = null;
let mailgunFrom = null;

function initMailer() {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAIL_FROM } = process.env;

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log(
      "ℹ️  Mailgun not configured — password reset emails will be logged to the console instead of sent.",
    );
    mailgunReady = false;
    return;
  }

  mailgunApiKey = MAILGUN_API_KEY;
  mailgunDomain = MAILGUN_DOMAIN;
  mailgunFrom = MAIL_FROM || `"Elixir Commerce" <no-reply@${MAILGUN_DOMAIN}>`;
  mailgunReady = true;
  console.log(`✅  Mailer ready → Mailgun HTTP API (${MAILGUN_DOMAIN})`);
}

/**
 * Send an email via Mailgun HTTP API.
 * Falls back to a console dump when Mailgun is not configured.
 * Never throws — a mail failure must not break the request that triggered it.
 *
 * @returns {Promise<boolean>} true if handed to Mailgun successfully
 */
async function sendMail({ to, subject, text, html }) {
  if (!mailgunReady) {
    console.log("\n────────── EMAIL (dev console fallback) ──────────");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("");
    console.log(text);
    console.log("──────────────────────────────────────────────────\n");
    return false;
  }

  try {
    // Mailgun US region endpoint — change to api.eu.mailgun.net if EU region
    const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;

    const formData = new URLSearchParams();
    formData.append("from", mailgunFrom);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("text", text);
    if (html) formData.append("html", html);

    const credentials = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`✉️  Mailgun error ${response.status}: ${errorText}`);
      return false;
    }

    console.log(`✉️  Email sent to ${to}`);
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
