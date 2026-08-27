/**
 * frontend/src/customer/authStyles.js
 *
 * Shared styling for the public (pre-login) pages: Login, Register,
 * Forgot Password and Reset Password. Extracted so all four stay visually
 * consistent instead of drifting apart with copy-pasted style objects.
 */

export const authStyles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 30%), linear-gradient(135deg, #050b17 0%, #0c1524 45%, #111b31 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 480,
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
    background: "rgba(14, 165, 233, 0.12)",
    color: "#7dd3fc",
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
    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
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
  success: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(52, 211, 153, 0.25)",
    color: "#6ee7b7",
    fontSize: 14,
    lineHeight: 1.6,
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
  },
};
