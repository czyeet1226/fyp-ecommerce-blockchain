/**
 * frontend/src/customer/ForgotPasswordPage.jsx
 *
 * Step 1 of the password reset flow: the user enters their email and the
 * backend emails a one-time reset link.
 *
 * The backend answers identically whether or not the address has an account,
 * so this screen always shows the same confirmation. That is intentional —
 * it stops the form being used to find out which emails are registered.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { authStyles as s } from "./authStyles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not start the password reset. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>Password reset</div>

        {sent ? (
          <>
            <h1 style={s.title}>Check your email</h1>
            <p style={s.text}>
              If an account exists for <strong>{email}</strong>, we&apos;ve sent
              a link you can use to choose a new password.
            </p>
            <div style={s.success}>
              The link expires in 30 minutes and can only be used once. If it
              doesn&apos;t arrive, check your spam folder or request another one.
            </div>
            <p style={{ ...s.footer, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={linkButton}
              >
                Use a different email
              </button>
            </p>
            <p style={s.footer}>
              <Link to="/login" style={s.link}>
                Back to login
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 style={s.title}>Forgot your password?</h1>
            <p style={s.text}>
              Enter the email address on your account and we&apos;ll send you a
              link to set a new password.
            </p>

            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={s.input}
                  placeholder="you@example.com"
                />
              </div>

              <button type="submit" style={s.button} disabled={loading}>
                {loading ? "Sending link..." : "Send reset link"}
              </button>
            </form>

            {error ? <div style={s.error}>{error}</div> : null}

            <p style={s.footer}>
              Remembered it?{" "}
              <Link to="/login" style={s.link}>
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const linkButton = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#7dd3fc",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};
