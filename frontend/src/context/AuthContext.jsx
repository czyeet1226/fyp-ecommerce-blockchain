/**
 * frontend/src/context/AuthContext.jsx
 * Global auth state — user info, token, wallet
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [wallet, setWallet] = useState({
    ethBalance: "0",
    lytBalance: "0",
    rmBalance: "0",
    walletAddress: "",
  });
  const [walletLoading, setWalletLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const applySession = (nextUser, nextWallet) => {
    setUser(nextUser);
    if (nextWallet) {
      setWallet((current) => ({
        ...current,
        ...nextWallet,
      }));
    }
  };

  // Set auth header globally
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      delete axios.defaults.headers.common["Authorization"];
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get("/api/auth/me");
      applySession(res.data.user, res.data.wallet);
      return res.data;
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await axios.get("/api/payment/wallet");
      console.log("[fetchWallet] wallet payload", res.data);
      setWallet(res.data);
    } catch {
      // wallet fetch is non-critical
    } finally {
      setWalletLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post("/api/auth/login", { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem("token", t);
    axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    setToken(t);
    applySession(u);
    await fetchCurrentUser();
    return u;
  };

  const register = async (name, email, password, role) => {
    const res = await axios.post("/api/auth/register", {
      name,
      email,
      password,
      role,
    });
    const { token: t, user: u } = res.data;
    localStorage.setItem("token", t);
    axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    setToken(t);
    applySession(u);
    await fetchCurrentUser();
    return u;
  };

  const updateProfile = async (updates) => {
    const res = await axios.put("/api/auth/profile", updates);
    setUser((current) => ({ ...current, ...res.data.user }));
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setWallet({
      ethBalance: "0",
      lytBalance: "0",
      rmBalance: "0",
      walletAddress: "",
    });
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        wallet,
        walletLoading,
        loading,
        login,
        register,
        logout,
        fetchWallet,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
