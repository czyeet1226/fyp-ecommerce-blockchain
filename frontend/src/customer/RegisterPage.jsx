import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at top, rgba(129,140,248,0.18), transparent 30%), linear-gradient(135deg, #050b17 0%, #0c1524 45%, #111b31 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    padding: 32,
    borderRadius: 24,
    background: "rgba(12, 21, 36, 0.9)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(16px)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(129, 140, 248, 0.12)",
    color: "#c4b5fd",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    margin: "18px 0 10px",
    fontSize: 30,
    lineHeight: 1.1,
    color: "#f8fafc",
  },
  text: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  form: { display: "grid", gap: 14, marginTop: 24 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  field: { display: "grid", gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  input: {
    width: "100%",
    padding: "14px 15px",
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.16)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "#e2e8f0",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    marginTop: 6,
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
    color: "#04101f",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
  },
  footer: {
    marginTop: 18,
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  link: {
    color: "#7dd3fc",
    textDecoration: "none",
    fontWeight: 700,
  },
  error: {
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(248, 113, 113, 0.12)",
    color: "#fca5a5",
    fontSize: 14,
  },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const u = await register(form.name, form.email, form.password, form.role);
      navigate(u?.role === "admin" ? "/" : "/shop", { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Registration failed. Please check the form and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Create Account</div>
        <h1 style={styles.title}>Join the marketplace</h1>
        <p style={styles.text}>
          Your account is saved in the MySQL user table through the backend
          registration endpoint.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={updateField("name")}
                style={styles.input}
                placeholder="Your name"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="role">
                Account Type
              </label>
              <select
                id="role"
                value={form.role}
                onChange={updateField("role")}
                style={styles.input}
              >
                <option value="customer">Customer</option>
                <option value="merchant">Merchant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={updateField("email")}
              style={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={updateField("password")}
              style={styles.input}
              placeholder="Create a password"
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        {error ? <div style={styles.error}>{error}</div> : null}

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
