import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useWeb3 } from "./context/Web3Context";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminApp from "./admin/AdminApp";
import SellerApp from "./seller/SellerApp";
import HomePage from "./customer/HomePage";
import LoginPage from "./customer/LoginPage";
import RegisterPage from "./customer/RegisterPage";
import ForgotPasswordPage from "./customer/ForgotPasswordPage";
import ResetPasswordPage from "./customer/ResetPasswordPage";
import ShopPage from "./customer/ShopPage";
import CartPage from "./customer/CartPage";
import WalletPage from "./customer/WalletPage";
import StakingPage from "./customer/StakingPage";
import TrackOrderPage from "./customer/TrackOrderPage";
import HistoryPage from "./customer/HistoryPage";
import ProfilePage from "./customer/ProfilePage";
import { css } from "./dashboard/dashboardUi";
import {
  ELIXIR_TO_RM_RATE,
  LIVE_RM_PER_ETH,
  RM_TO_ELIXIR_RATE,
  SAMPLE_PRODUCTS,
  convertCurrency,
  fmt,
  getOrderStageIndex,
  normalizeProduct,
  orderEarnedElixir,
} from "./dashboard/dashboardData";

function AppRoutes({ user, liveWallet, logout, dashboard }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Public (signed-out) routes. "/" is the marketing home page, which is the
  // entry point into either Sign Up or Login.
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Admins get a dedicated administration console.
  if (user.role === "admin") {
    return (
      <Routes>
        <Route
          path="*"
          element={<AdminApp user={user} logout={handleSignOut} />}
        />
      </Routes>
    );
  }

  // Merchants (sellers) get a dedicated seller console.
  if (user.role === "merchant") {
    return (
      <Routes>
        <Route
          path="*"
          element={<SellerApp user={user} logout={handleSignOut} />}
        />
      </Routes>
    );
  }

  return (
    <DashboardLayout
      user={user}
      liveWallet={liveWallet}
      wallet={dashboard.walletLedger}
      logout={handleSignOut}
      cartCount={(dashboard.cart || []).reduce(
        (sum, i) => sum + Number(i.quantity || 0),
        0,
      )}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/shop" replace />} />
        <Route path="/shop" element={<ShopPage {...dashboard} />} />
        <Route path="/cart" element={<CartPage {...dashboard} />} />
        <Route path="/wallet" element={<WalletPage {...dashboard} />} />
        <Route path="/staking" element={<StakingPage {...dashboard} />} />
        <Route
          path="/track-order"
          element={<TrackOrderPage {...dashboard} />}
        />
        <Route path="/history" element={<HistoryPage {...dashboard} />} />
        <Route path="/profile" element={<ProfilePage {...dashboard} />} />
        <Route path="*" element={<Navigate to="/shop" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export default function App() {
  const {
    user,
    wallet,
    walletLoading,
    loading: authLoading,
    logout,
    fetchWallet,
  } = useAuth();

  const {
    account: metamaskAccount,
    ethBalance: metamaskEth,
    isConnected: metamaskConnected,
    connectWallet: connectMetamask,
    disconnectWallet: disconnectMetamask,
    sendEth,
    sendToken,
  } = useWeb3();

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("hot selling");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sellerFilter, setSellerFilter] = useState(null); // { id, name } | null

  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [walletLedger, setWalletLedger] = useState({
    rmBalance: 0,
    elixirBalance: 0,
  });
  const [swapFrom, setSwapFrom] = useState("RM");
  const [swapTo, setSwapTo] = useState("ELIXIR");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);
  const [depositRm, setDepositRm] = useState("");
  const [transferAddress, setTransferAddress] = useState("");
  const [transferElixir, setTransferElixir] = useState("");
  const [transferCurrency, setTransferCurrency] = useState("ELIXIR");
  const [transferBusy, setTransferBusy] = useState(false);
  const [walletMessage, setWalletMessage] = useState({ text: "", type: "" });

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [stakeData, setStakeData] = useState({
    positions: [],
    tiers: [],
    totalStaked: 0,
    totalEarned: 0,
    compoundFrequency: 12,
  });
  const [stakeLoading, setStakeLoading] = useState(false);

  const [cart, setCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState({ text: "", type: "" });

  const liveWallet = useMemo(() => {
    // Prefer the connected MetaMask balance for ETH; fall back to backend value.
    const ethBalance = metamaskConnected
      ? Number(metamaskEth || 0)
      : Number(wallet.ethBalance || 0);
    const elixirBalance = Number(
      walletLedger.elixirBalance ?? wallet.lytBalance ?? 0,
    );
    return {
      ethBalance,
      elixirBalance,
      rmEquivalent: ethBalance * LIVE_RM_PER_ETH,
      elixirEquivalentRm: elixirBalance * ELIXIR_TO_RM_RATE,
      metamaskConnected,
    };
  }, [
    wallet.ethBalance,
    wallet.lytBalance,
    walletLedger.elixirBalance,
    metamaskConnected,
    metamaskEth,
  ]);

  useEffect(() => {
    setWalletLedger((cur) => ({
      ...cur,
      rmBalance: wallet.rmBalance !== undefined ? Number(wallet.rmBalance) : 0,
      elixirBalance: Number(wallet.lytBalance || cur.elixirBalance || 0),
    }));
  }, [wallet.lytBalance, wallet.rmBalance]);

  useEffect(() => {
    loadProducts(selectedCategory, sellerFilter?.id);
  }, [selectedCategory, sellerFilter]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setSelectedOrder(null);
      setSelectedOrderId("");
      setTransactions([]);
      setStakeData({
        positions: [],
        tiers: [],
        totalStaked: 0,
        totalEarned: 0,
        compoundFrequency: 12,
      });
      setCart([]);
      return;
    }
    fetchWallet(); // refresh balances + platformAddress for ETH swaps
    loadOrders();
    loadTransactions();
    loadStakes();
    loadCart();
  }, [user]);

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null);
      return;
    }
    loadOrderDetail(selectedOrderId);
  }, [selectedOrderId]);

  // Bind the connected MetaMask wallet to the logged-in account.
  // Enforces one wallet per account and rejects wallets used elsewhere.
  useEffect(() => {
    if (!user || !metamaskConnected || !metamaskAccount) return;
    let cancelled = false;

    (async () => {
      try {
        await axios.post("/api/auth/link-metamask", {
          metamaskAddress: metamaskAccount,
        });
        if (!cancelled) await fetchWallet();
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          "This MetaMask wallet can't be linked to your account.";
        showMsg(msg, "error");
        // Reject the connection so a mismatched/shared wallet isn't used.
        disconnectMetamask();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, metamaskConnected, metamaskAccount]);

  async function loadProducts(category, merchantId) {
    setProductsLoading(true);
    setProductsError("");
    try {
      const params = { limit: 50 };
      if (category !== "hot selling") params.category = category;
      if (merchantId) params.merchantId = merchantId;
      const res = await axios.get("/api/products", { params });
      const apiProds = (res.data.products || [])
        .map(normalizeProduct)
        .filter(Boolean);

      // When filtering by a specific seller, show exactly what the API returns
      // (no sample fallback, which would leak other sellers' demo items).
      if (merchantId) {
        setProducts(apiProds);
        setSelectedProduct(null);
        return;
      }

      const fallback = SAMPLE_PRODUCTS.filter(
        (p) => category === "hot selling" || p.category === category,
      );
      const next = apiProds.length > 0 ? apiProds : fallback;
      setProducts(next);
      setSelectedProduct((cur) => cur || next[0] || null);
    } catch {
      if (merchantId) {
        setProducts([]);
        setProductsError("Unable to load this seller's products.");
        return;
      }
      const fallback = SAMPLE_PRODUCTS.filter(
        (p) => category === "hot selling" || p.category === category,
      );
      setProducts(fallback);
      setSelectedProduct((cur) => cur || fallback[0] || null);
      setProductsError("Using sample catalog while products load.");
    } finally {
      setProductsLoading(false);
    }
  }

  function viewSeller(seller) {
    if (!seller?.id) return;
    setSelectedProduct(null);
    setSellerFilter({ id: seller.id, name: seller.name || "Seller" });
  }

  function clearSeller() {
    setSellerFilter(null);
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await axios.get("/api/orders/my");
      const next = res.data.orders || [];
      setOrders(next);
      if (next.length > 0) setSelectedOrderId((cur) => cur || next[0].id);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadOrderDetail(orderId) {
    setSelectedOrderLoading(true);
    try {
      const res = await axios.get(`/api/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch {
      const fallback = orders.find((o) => o.id === orderId) || null;
      setSelectedOrder(
        fallback ? { order: fallback, blockchainLog: null } : null,
      );
    } finally {
      setSelectedOrderLoading(false);
    }
  }

  // Re-pull the order list and the currently-selected order so the customer
  // sees the seller's latest delivery progress.
  async function refreshOrders() {
    await loadOrders();
    if (selectedOrderId) await loadOrderDetail(selectedOrderId);
  }

  async function loadTransactions() {
    setTransactionsLoading(true);
    try {
      const res = await axios.get("/api/payment/transactions");
      setTransactions(res.data.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function loadStakes() {
    setStakeLoading(true);
    try {
      const res = await axios.get("/api/staking/positions");
      setStakeData({
        positions: res.data.positions || [],
        tiers: res.data.tiers || [],
        totalStaked: Number(res.data.totalStaked || 0),
        totalEarned: Number(res.data.totalEarned || 0),
        compoundFrequency: Number(res.data.compoundFrequency || 12),
      });
    } catch {
      setStakeData((cur) => ({ ...cur, positions: [] }));
    } finally {
      setStakeLoading(false);
    }
  }

  function showMsg(text, type = "info") {
    setWalletMessage({ text, type });
    setTimeout(() => setWalletMessage({ text: "", type: "" }), 4000);
  }

  // ── Cart actions ───────────────────────────────────────────────────────────

  function showCartMsg(text, type = "info") {
    setCartMessage({ text, type });
    setTimeout(() => setCartMessage({ text: "", type: "" }), 3500);
  }

  async function loadCart() {
    setCartLoading(true);
    try {
      const res = await axios.get("/api/cart");
      setCart(res.data.items || []);
    } catch {
      setCart([]);
    } finally {
      setCartLoading(false);
    }
  }

  async function addToCart(productId, quantity = 1) {
    try {
      const res = await axios.post("/api/cart", { productId, quantity });
      setCart(res.data.items || []);
      showCartMsg("Added to cart 🛒", "success");
      return true;
    } catch (err) {
      showCartMsg(
        err?.response?.data?.message || "Could not add to cart.",
        "error",
      );
      return false;
    }
  }

  async function updateCartItem(cartId, quantity) {
    try {
      const res = await axios.put(`/api/cart/${cartId}`, { quantity });
      setCart(res.data.items || []);
    } catch (err) {
      showCartMsg(
        err?.response?.data?.message || "Could not update quantity.",
        "error",
      );
    }
  }

  async function removeCartItem(cartId) {
    try {
      const res = await axios.delete(`/api/cart/${cartId}`);
      setCart(res.data.items || []);
    } catch {
      showCartMsg("Could not remove item.", "error");
    }
  }

  async function handleDeposit() {
    const amount = Number(depositRm);
    if (!Number.isFinite(amount) || amount <= 0) {
      showMsg("Enter a valid RM deposit amount.", "error");
      return;
    }

    try {
      const res = await axios.post("/api/payment/deposit", { amount });
      const nextRm = Number(res.data.rmBalance);
      setWalletLedger((cur) => ({
        ...cur,
        rmBalance: Number.isFinite(nextRm) ? nextRm : cur.rmBalance + amount,
      }));
      setDepositRm("");
      await fetchWallet();
      showMsg(
        res.data.message || `RM ${amount.toFixed(2)} deposited into wallet.`,
        "success",
      );
      setTimeout(() => window.location.reload(), 250);
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to deposit RM right now.",
        "error",
      );
    }
  }

  async function handleTransfer() {
    const amount = Number(transferElixir);
    const recipient = (transferAddress || "").trim();
    const currency = transferCurrency;

    if (!Number.isFinite(amount) || amount <= 0) {
      showMsg("Enter a valid amount to transfer.", "error");
      return;
    }
    if (!recipient || recipient.length < 6) {
      showMsg("Enter a recipient wallet address.", "error");
      return;
    }

    setTransferBusy(true);
    try {
      let txHash = null;

      // ETH and Elixir transfers move real assets peer-to-peer via MetaMask.
      if (currency === "ETH" || currency === "ELIXIR") {
        if (!metamaskConnected) {
          showMsg(`Connect MetaMask to transfer ${currency}.`, "error");
          setTransferBusy(false);
          return;
        }
        showMsg(`Confirm the ${currency} transfer in MetaMask…`, "info");
        txHash =
          currency === "ETH"
            ? await sendEth(recipient, amount)
            : await sendToken(recipient, amount);
      }

      const res = await axios.post("/api/payment/transfer", {
        recipientAddress: recipient,
        amount,
        currency,
        txHash,
      });

      const nextElixir = Number(res.data.lytBalance);
      const nextRm = Number(res.data.rmBalance);
      setWalletLedger((cur) => ({
        ...cur,
        elixirBalance: Number.isFinite(nextElixir)
          ? nextElixir
          : cur.elixirBalance,
        rmBalance: Number.isFinite(nextRm) ? nextRm : cur.rmBalance,
      }));

      setTransferElixir("");
      setTransferAddress("");
      await fetchWallet();
      await loadTransactions();
      showMsg(res.data.message || "Transfer completed.", "success");
    } catch (err) {
      const reason =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to transfer right now.";
      showMsg(reason, "error");
    } finally {
      setTransferBusy(false);
    }
  }

  async function handleSwap() {
    const amount = Number(swapAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showMsg("Enter a valid amount to swap.", "error");
      return;
    }
    if (swapFrom === swapTo) {
      showMsg("Choose two different currencies.", "error");
      return;
    }

    setSwapBusy(true);
    try {
      let txHash = null;

      const involvesElixir = swapFrom === "ELIXIR" || swapTo === "ELIXIR";
      const involvesEth = swapFrom === "ETH" || swapTo === "ETH";

      // Any ETH or Elixir leg needs a connected MetaMask wallet.
      if ((involvesElixir || involvesEth) && !metamaskConnected) {
        showMsg("Connect MetaMask to swap ETH or Elixir.", "error");
        setSwapBusy(false);
        return;
      }

      const platformAddress = wallet.platformAddress;
      if ((involvesElixir || involvesEth) && !platformAddress) {
        showMsg("Platform address unavailable. Try again shortly.", "error");
        setSwapBusy(false);
        return;
      }

      // ETH → other: send ETH from MetaMask to the platform address first.
      if (swapFrom === "ETH") {
        showMsg("Confirm the ETH transfer in MetaMask…", "info");
        txHash = await sendEth(platformAddress, amount);
      }

      // Elixir → other: send real LYT tokens from MetaMask to the platform.
      if (swapFrom === "ELIXIR") {
        showMsg("Confirm the Elixir transfer in MetaMask…", "info");
        txHash = await sendToken(platformAddress, amount);
      }

      const res = await axios.post("/api/payment/swap", {
        fromCurrency: swapFrom,
        toCurrency: swapTo,
        amount,
        txHash,
        metamaskAddress: metamaskAccount,
      });

      const nextRm = Number(res.data.rmBalance);
      const nextElixir = Number(res.data.lytBalance);
      setWalletLedger((cur) => ({
        ...cur,
        rmBalance: Number.isFinite(nextRm) ? nextRm : cur.rmBalance,
        elixirBalance: Number.isFinite(nextElixir)
          ? nextElixir
          : cur.elixirBalance,
      }));

      setSwapAmount("");
      await fetchWallet();
      await loadTransactions();
      showMsg(res.data.message || "Swap completed successfully.", "success");
    } catch (err) {
      const reason =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to swap right now.";
      showMsg(reason, "error");
    } finally {
      setSwapBusy(false);
    }
  }

  // ── Staking actions ───────────────────────────────────────────────────────

  async function handleStake(amount, tierDays) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      showMsg("Enter a valid Elixir amount to stake.", "error");
      return false;
    }
    if (!metamaskConnected) {
      showMsg("Connect MetaMask to stake Elixir.", "error");
      return false;
    }
    const platformAddress = wallet.platformAddress;
    if (!platformAddress) {
      showMsg("Platform address unavailable. Try again shortly.", "error");
      return false;
    }
    try {
      // Send the staked Elixir (real LYT) to the staking pool (admin) first.
      showMsg("Confirm the Elixir stake in MetaMask…", "info");
      const txHash = await sendToken(platformAddress, value);

      const res = await axios.post("/api/staking/stake", {
        amount: value,
        tierDays,
        txHash,
      });
      const nextElixir = Number(res.data.lytBalance);
      setWalletLedger((cur) => ({
        ...cur,
        elixirBalance: Number.isFinite(nextElixir)
          ? nextElixir
          : cur.elixirBalance,
      }));
      await fetchWallet();
      await loadStakes();
      await loadTransactions();
      showMsg(res.data.message || "Stake created.", "success");
      return true;
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to stake right now.",
        "error",
      );
      return false;
    }
  }

  async function handleUnstake(positionId) {
    try {
      const res = await axios.post("/api/staking/unstake", { positionId });
      const nextElixir = Number(res.data.lytBalance);
      setWalletLedger((cur) => ({
        ...cur,
        elixirBalance: Number.isFinite(nextElixir)
          ? nextElixir
          : cur.elixirBalance,
      }));
      await fetchWallet();
      await loadStakes();
      await loadTransactions();
      showMsg(res.data.message || "Unstaked successfully.", "success");
      return true;
    } catch (err) {
      showMsg(
        err?.response?.data?.message || "Unable to unstake right now.",
        "error",
      );
      return false;
    }
  }

  const currentOrder =
    selectedOrder?.order ||
    orders.find((o) => o.id === selectedOrderId) ||
    orders[0] ||
    null;
  const currentOrderLog = selectedOrder?.blockchainLog || null;
  const currentOrderStage = getOrderStageIndex(currentOrder);

  const swapPreview = useMemo(() => {
    const amount = Number(swapAmount);
    if (!amount || amount <= 0 || swapFrom === swapTo) return null;
    const converted = convertCurrency(amount, swapFrom, swapTo);
    const digits = swapTo === "RM" ? 2 : swapTo === "ETH" ? 6 : 4;
    return {
      from: `${fmt(amount, swapFrom === "RM" ? 2 : 4)} ${swapFrom}`,
      to: `${fmt(converted, digits)} ${swapTo}`,
      toAmount: converted,
    };
  }, [swapAmount, swapFrom, swapTo]);

  if (authLoading || walletLoading) {
    return (
      <div style={css.loadingScreen}>
        <div style={css.loadingSpinner} />
        <p style={{ margin: "16px 0 0", color: "#94a3b8" }}>
          Loading customer portal…
        </p>
      </div>
    );
  }

  const dashboard = {
    products,
    productsLoading,
    productsError,
    selectedCategory,
    setSelectedCategory,
    selectedProduct,
    selectedProductPrev: selectedProduct,
    setSelectedProduct,
    sellerFilter,
    viewSeller,
    clearSeller,
    liveWallet,
    walletLedger,
    wallet,
    swapFrom,
    setSwapFrom,
    swapTo,
    setSwapTo,
    swapAmount,
    setSwapAmount,
    swapPreview,
    swapBusy,
    depositRm,
    setDepositRm,
    transferAddress,
    setTransferAddress,
    transferElixir,
    setTransferElixir,
    transferCurrency,
    setTransferCurrency,
    transferBusy,
    walletMessage,
    handleDeposit,
    handleTransfer,
    handleSwap,
    metamaskConnected,
    metamaskAccount,
    connectMetamask,
    transactions,
    transactionsLoading,
    stakeData,
    stakeLoading,
    handleStake,
    handleUnstake,
    orders,
    selectedOrderId,
    setSelectedOrderId,
    selectedOrderLoading,
    currentOrder,
    currentOrderLog,
    currentOrderStage,
    ordersLoading,
    refreshOrders,
    orderEarnedElixir,
    fmt,
    // Cart
    cart,
    cartLoading,
    cartMessage,
    addToCart,
    updateCartItem,
    removeCartItem,
    loadCart,
    refreshWallet: fetchWallet,
  };

  return (
    <BrowserRouter>
      <AppRoutes
        user={user}
        liveWallet={liveWallet}
        logout={logout}
        dashboard={dashboard}
      />
    </BrowserRouter>
  );
}
