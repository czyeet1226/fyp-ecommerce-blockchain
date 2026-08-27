import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authStyles as styles } from "./authStyles";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser?.role === "admin" ? "/" : "/shop", {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Login failed. Check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Customer Portal</div>
        <h1 style={styles.title}>Sign in to continue</h1>
        <p style={styles.text}>
          Access your dashboard, track orders, and manage your wallet.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <div style={rowBetween}>
              <label style={styles.label} htmlFor="password">
                Password
              </label>
              <Link to="/forgot-password" style={forgotLink}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {error ? <div style={styles.error}>{error}</div> : null}

        <p style={styles.footer}>
          New here?{" "}
          <Link to="/register" style={styles.link}>
            Create an account now.
          </Link>
        </p>
        <p style={{ ...styles.footer, marginTop: 8 }}>
          <Link to="/" style={{ ...styles.link, color: "#64748b" }}>
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

const rowBetween = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const forgotLink = {
  color: "#7dd3fc",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 700,
};
