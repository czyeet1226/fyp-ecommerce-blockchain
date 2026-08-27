/**
 * frontend/src/customer/ResetPasswordPage.jsx
 *
 * Step 2 of the password reset flow. The token and email arrive as query
 * parameters from the emailed link:
 *   /reset-password?token=<64 hex chars>&email=<address>
 *
 * The token is single-use and expires server-side, so this page only submits
 * it once and then sends the user to login.
 */

import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { authStyles as s } from "./authStyles";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const token = params.get("token") || "";
  const email = params.get("email") || "";
  const linkOk = useMemo(() => Boolean(token && email), [token, email]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Validate locally first so an obvious mistake doesn't burn the token.
    if (password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", {
        email,
        token,
        newPassword: password,
      });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not reset your password. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Someone opened /reset-password directly, with no token in the URL.
  if (!linkOk) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.badge}>Password reset</div>
          <h1 style={s.title}>This link isn&apos;t valid</h1>
          <p style={s.text}>
            The reset link is missing information. It may have been truncated by
            your email client, or the link has already been used.
          </p>
          <p style={{ ...s.footer, marginTop: 22 }}>
            <Link to="/forgot-password" style={s.link}>
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>Password reset</div>

        {done ? (
          <>
            <h1 style={s.title}>Password updated</h1>
            <p style={s.text}>
              Your password has been changed. You can now sign in with it.
            </p>
            <div style={s.success}>
              Taking you to the login page&hellip;
            </div>
            <p style={{ ...s.footer, marginTop: 22 }}>
              <Link to="/login" style={s.link}>
                Go to login now
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 style={s.title}>Choose a new password</h1>
            <p style={s.text}>
              Setting a new password for <strong>{email}</strong>.
            </p>

            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label} htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={s.input}
                  placeholder="At least 6 characters"
                />
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="confirm">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={s.input}
                  placeholder="Re-enter your new password"
                />
              </div>

              <button type="submit" style={s.button} disabled={loading}>
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>

            {error ? <div style={s.error}>{error}</div> : null}

            <p style={s.footer}>
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
