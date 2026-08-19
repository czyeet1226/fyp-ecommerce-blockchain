import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { css, Section, SummaryItem } from "../dashboard/dashboardUi";

export default function ProfilePage({ liveWallet, fmt }) {
  const { user, updateProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const startEdit = () => {
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
    });
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordFields(false);
    setMessage({ text: "", type: "" });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setMessage({ text: "", type: "" });
  };

  const updateField = (field) => (e) =>
    setForm((cur) => ({ ...cur, [field]: e.target.value }));

  const updatePasswordField = (field) => (e) =>
    setPasswordForm((cur) => ({ ...cur, [field]: e.target.value }));

  const showMsg = (text, type = "info") => {
    setMessage({ text, type });
    if (type === "success") {
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showMsg("Name cannot be empty.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showMsg("Enter a valid email address.", "error");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };

    if (showPasswordFields && passwordForm.newPassword) {
      if (!passwordForm.currentPassword) {
        showMsg("Enter your current password to set a new one.", "error");
        return;
      }
      if (passwordForm.newPassword.length < 6) {
        showMsg("New password must be at least 6 characters.", "error");
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        showMsg("New password and confirmation do not match.", "error");
        return;
      }
      payload.currentPassword = passwordForm.currentPassword;
      payload.newPassword = passwordForm.newPassword;
    }

    setSaving(true);
    try {
      await updateProfile(payload);
      setEditing(false);
      setShowPasswordFields(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showMsg("Profile updated successfully.", "success");
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to update profile right now.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section label="Profile" title="Your Account & Identity">
      {!editing ? (
        <>
          <div style={css.profileGrid}>
            <div style={css.panel}>
              <h4 style={css.subTitle}>Account Details</h4>
              <SummaryItem label="Name" value={user?.name || "Not signed in"} />
              <SummaryItem
                label="Account Number"
                value={user?.userCode || user?.id || "Pending"}
              />
              <SummaryItem label="Email" value={user?.email || "–"} />
              <SummaryItem label="Phone" value={user?.phone || "Not set"} />
              <SummaryItem
                label="Delivery Address"
                value={user?.address || "Not set"}
              />
              <SummaryItem label="Role" value={user?.role || "customer"} />
              <SummaryItem
                label="Member Since"
                value={
                  user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "–"
                }
              />
            </div>
            <div style={css.panel}>
              <h4 style={css.subTitle}>Wallet Identity</h4>
              <SummaryItem
                label="Wallet Address"
                value={user?.walletAddress || "Not configured"}
              />
              <SummaryItem
                label="MetaMask Address"
                value={user?.metamaskAddress || "Not linked"}
              />
              <SummaryItem
                label="Live Elixir"
                value={`${fmt(liveWallet?.elixirBalance, 0)} ✦`}
              />
              <SummaryItem
                label="RM Equivalent"
                value={`RM ${fmt(liveWallet?.rmEquivalent, 2)}`}
              />
              <SummaryItem
                label="ETH Balance"
                value={`${fmt(liveWallet?.ethBalance, 4)} ETH`}
              />
            </div>
          </div>

          <button style={s.editBtn} onClick={startEdit}>
            ✎ Edit Profile
          </button>
        </>
      ) : (
        <div style={s.editForm}>
          <div style={css.profileGrid}>
            <div style={css.panel}>
              <h4 style={css.subTitle}>Account Details</h4>

              <div style={s.field}>
                <label style={css.inputLabel}>Full Name</label>
                <input
                  style={css.inputField}
                  value={form.name}
                  onChange={updateField("name")}
                  placeholder="Your name"
                />
              </div>

              <div style={s.field}>
                <label style={css.inputLabel}>Email</label>
                <input
                  type="email"
                  style={css.inputField}
                  value={form.email}
                  onChange={updateField("email")}
                  placeholder="you@example.com"
                />
              </div>

              <div style={s.field}>
                <label style={css.inputLabel}>Phone</label>
                <input
                  type="tel"
                  style={css.inputField}
                  value={form.phone}
                  onChange={updateField("phone")}
                  placeholder="e.g. 012-3456789"
                />
              </div>

              <div style={s.field}>
                <label style={css.inputLabel}>Delivery Address</label>
                <textarea
                  style={{ ...css.inputField, minHeight: 80, resize: "vertical" }}
                  value={form.address}
                  onChange={updateField("address")}
                  placeholder="Street, city, postcode"
                />
              </div>

              <div style={s.field}>
                <label style={css.inputLabel}>Account Number</label>
                <input
                  style={{ ...css.inputField, opacity: 0.6 }}
                  value={user?.userCode || ""}
                  disabled
                />
              </div>
            </div>

            <div style={css.panel}>
              <h4 style={css.subTitle}>Security</h4>

              {!showPasswordFields ? (
                <button
                  style={s.linkBtn}
                  onClick={() => setShowPasswordFields(true)}
                  type="button"
                >
                  🔒 Change Password
                </button>
              ) : (
                <>
                  <div style={s.field}>
                    <label style={css.inputLabel}>Current Password</label>
                    <input
                      type="password"
                      style={css.inputField}
                      value={passwordForm.currentPassword}
                      onChange={updatePasswordField("currentPassword")}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div style={s.field}>
                    <label style={css.inputLabel}>New Password</label>
                    <input
                      type="password"
                      style={css.inputField}
                      value={passwordForm.newPassword}
                      onChange={updatePasswordField("newPassword")}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div style={s.field}>
                    <label style={css.inputLabel}>Confirm New Password</label>
                    <input
                      type="password"
                      style={css.inputField}
                      value={passwordForm.confirmPassword}
                      onChange={updatePasswordField("confirmPassword")}
                      placeholder="Re-enter new password"
                    />
                  </div>
                  <button
                    style={s.linkBtnMuted}
                    onClick={() => setShowPasswordFields(false)}
                    type="button"
                  >
                    Cancel password change
                  </button>
                </>
              )}

              <h4 style={{ ...css.subTitle, marginTop: 20 }}>
                Wallet Identity
              </h4>
              <SummaryItem
                label="Wallet Address"
                value={user?.walletAddress || "Not configured"}
              />
              <SummaryItem
                label="MetaMask Address"
                value={user?.metamaskAddress || "Not linked"}
              />
              <p style={css.helperText}>
                Wallet addresses are managed automatically and cannot be
                edited here.
              </p>
            </div>
          </div>

          <div style={s.actionsRow}>
            <button
              style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "💾 Save Changes"}
            </button>
            <button style={s.cancelBtn} onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message.text && (
        <div
          style={{
            ...css.walletToast,
            background:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.12)"
                : message.type === "error"
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(56, 189, 248, 0.12)",
            borderColor:
              message.type === "success"
                ? "rgba(52, 211, 153, 0.3)"
                : message.type === "error"
                ? "rgba(248, 113, 113, 0.3)"
                : "rgba(125, 211, 252, 0.3)",
            color:
              message.type === "success"
                ? "#34d399"
                : message.type === "error"
                ? "#fca5a5"
                : "#7dd3fc",
          }}
        >
          {message.type === "success" ? "✓" : message.type === "error" ? "⚠" : "ℹ"}{" "}
          {message.text}
        </div>
      )}
    </Section>
  );
}

const s = {
  editForm: { display: "grid", gap: 16 },
  field: { display: "grid", gap: 6, marginBottom: 14 },
  editBtn: {
    marginTop: 20,
    padding: "12px 22px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #0ea5e9, #818cf8)",
    color: "#060d1a",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.08)",
    color: "#38bdf8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 8,
  },
  linkBtnMuted: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    textDecoration: "underline",
  },
  actionsRow: { display: "flex", gap: 12 },
  saveBtn: {
    padding: "12px 24px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #34d399)",
    color: "#060d1a",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  cancelBtn: {
    padding: "12px 24px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.15)",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
};
