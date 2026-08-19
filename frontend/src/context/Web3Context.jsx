/**
 * frontend/src/context/Web3Context.jsx
 * MetaMask wallet connection state and ETH balance management.
 * Provides connect/disconnect functions and auto-refreshes ETH balance.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import deployed from "../deployedAddresses.json";

const Web3Context = createContext(null);

// LoyaltyToken (Elixir) contract — used for real on-chain token transfers.
const LYT_ADDRESS = deployed?.contracts?.LoyaltyToken || "";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// EcommercePayment contract — checkout is signed by the customer's MetaMask.
const ECOMMERCE_ADDRESS = deployed?.contracts?.EcommercePayment || "";
const ECOMMERCE_ABI = [
  "function payWithETH(address seller, string productRef) payable returns (uint256)",
  "function payWithTokens(address seller, uint256 tokenAmount, string productRef) returns (uint256)",
];

// PurchaseEscrow contract — escrow-based delivery confirmation for both ETH and
// Elixir. The buyer's MetaMask funds the escrow, confirms delivery, or disputes.
const ESCROW_ADDRESS = deployed?.contracts?.PurchaseEscrow || "";
const ESCROW_ABI = [
  "function createEscrow(address seller, string productRef) payable returns (uint256)",
  "function createTokenEscrow(address seller, string productRef, uint256 tokenAmount) returns (uint256)",
  "function confirmDelivery(uint256 escrowId)",
  "function raiseDispute(uint256 escrowId)",
];

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [ethBalance, setEthBalance] = useState("0");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const isConnected = !!account;

  // Fetch ETH balance for the connected account
  const fetchBalance = useCallback(async (address) => {
    if (!address || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      setEthBalance(ethers.formatEther(balance));
    } catch {
      setEthBalance("0");
    }
  }, []);

  // Connect to MetaMask
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setConnecting(true);
    setError("");
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await fetchBalance(accounts[0]);

        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
        setChainId(parseInt(chainIdHex, 16));
      }
    } catch (err) {
      if (err.code === 4001) {
        setError("Connection rejected. Please approve in MetaMask.");
      } else {
        setError("Failed to connect MetaMask.");
      }
    } finally {
      setConnecting(false);
    }
  }, [fetchBalance]);

  // Disconnect wallet (clear local state)
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setEthBalance("0");
    setChainId(null);
    setError("");
  }, []);

  /**
   * Send ETH from the connected MetaMask account to a recipient address.
   * Used when swapping ETH into another currency (ETH leaves MetaMask and
   * goes to the platform address). Returns the transaction hash.
   */
  const sendEth = useCallback(
    async (toAddress, amountEth) => {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }
      if (!account) {
        throw new Error("Connect your MetaMask wallet first.");
      }
      if (!toAddress) {
        throw new Error("Missing destination address.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(String(amountEth)),
      });
      const receipt = await tx.wait();

      // Refresh balance after the transfer settles
      await fetchBalance(account);

      return receipt.hash;
    },
    [account, fetchBalance],
  );

  /**
   * Send Elixir (LYT ERC-20) tokens from the connected MetaMask wallet to a
   * recipient. Used when swapping/transferring Elixir out of MetaMask (e.g.
   * Elixir → ETH/RM sends tokens to the platform). Returns the tx hash.
   * @param {string} toAddress recipient wallet
   * @param {number|string} wholeAmount amount in whole Elixir (not wei)
   */
  const sendToken = useCallback(
    async (toAddress, wholeAmount) => {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }
      if (!account) {
        throw new Error("Connect your MetaMask wallet first.");
      }
      if (!LYT_ADDRESS) {
        throw new Error("Elixir token address is not configured.");
      }
      if (!toAddress) {
        throw new Error("Missing destination address.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(LYT_ADDRESS, ERC20_ABI, signer);
      const amount = ethers.parseUnits(String(wholeAmount), 18);

      const balance = await token.balanceOf(account);
      if (balance < amount) {
        throw new Error("Insufficient Elixir balance in your MetaMask wallet.");
      }

      const tx = await token.transfer(toAddress, amount);
      const receipt = await tx.wait();

      return receipt.hash;
    },
    [account],
  );

  /**
   * Read the connected wallet's on-chain Elixir (LYT) balance as whole units.
   */
  const getElixirBalance = useCallback(async () => {
    if (!window.ethereum || !account || !LYT_ADDRESS) return "0";
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const token = new ethers.Contract(LYT_ADDRESS, ERC20_ABI, provider);
      const raw = await token.balanceOf(account);
      return ethers.formatUnits(raw, 18);
    } catch {
      return "0";
    }
  }, [account]);

  // Build an EcommercePayment contract bound to the MetaMask signer.
  const getEcommerceContract = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    if (!account) throw new Error("Connect your MetaMask wallet first.");
    if (!ECOMMERCE_ADDRESS) {
      throw new Error("Payment contract address is not configured.");
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(ECOMMERCE_ADDRESS, ECOMMERCE_ABI, signer);
  }, [account]);

  /**
   * Checkout: pay entirely in ETH through the EcommercePayment contract.
   * @param {string} seller merchant wallet address
   * @param {string} productRef product id
   * @param {number|string} ethAmount total price in ETH
   * @returns {Promise<string>} transaction hash
   */
  const payWithEthOnChain = useCallback(
    async (seller, productRef, ethAmount) => {
      const contract = await getEcommerceContract();
      const tx = await contract.payWithETH(seller, String(productRef), {
        value: ethers.parseEther(String(ethAmount)),
      });
      const receipt = await tx.wait();
      await fetchBalance(account);
      return receipt.hash;
    },
    [getEcommerceContract, fetchBalance, account],
  );

  /**
   * Checkout: pay entirely in Elixir (LYT) through the contract. Tokens are
   * burned; the seller is paid ETH from the platform reserve.
   * @param {string} seller merchant wallet address
   * @param {number|string} tokenAmount amount in whole Elixir units
   * @param {string} productRef product id
   * @returns {Promise<string>} transaction hash
   */
  const payWithTokensOnChain = useCallback(
    async (seller, tokenAmount, productRef) => {
      const contract = await getEcommerceContract();
      const tx = await contract.payWithTokens(
        seller,
        BigInt(Math.round(Number(tokenAmount))),
        String(productRef),
      );
      const receipt = await tx.wait();
      return receipt.hash;
    },
    [getEcommerceContract],
  );

  // Build a PurchaseEscrow contract bound to the MetaMask signer.
  const getEscrowContract = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    if (!account) throw new Error("Connect your MetaMask wallet first.");
    if (!ESCROW_ADDRESS) {
      throw new Error("Escrow contract address is not configured.");
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
  }, [account]);

  /**
   * Escrow checkout: lock ETH in the escrow contract until delivery is
   * confirmed. Returns the transaction hash.
   */
  const createEscrowOnChain = useCallback(
    async (seller, productRef, ethAmount) => {
      const contract = await getEscrowContract();
      const tx = await contract.createEscrow(seller, String(productRef), {
        value: ethers.parseEther(String(ethAmount)),
      });
      const receipt = await tx.wait();
      await fetchBalance(account);
      return receipt.hash;
    },
    [getEscrowContract, fetchBalance, account],
  );

  /**
   * Elixir escrow checkout: approve the escrow contract to spend the buyer's
   * LYT, then lock those tokens in escrow until delivery is confirmed. This
   * needs TWO MetaMask signatures — approve, then createTokenEscrow.
   * @param {string} seller merchant wallet address
   * @param {string} productRef product id
   * @param {number|string} tokenAmount amount in whole Elixir units
   * @returns {Promise<string>} the createTokenEscrow transaction hash
   */
  const createTokenEscrowOnChain = useCallback(
    async (seller, productRef, tokenAmount) => {
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      if (!account) throw new Error("Connect your MetaMask wallet first.");
      if (!ESCROW_ADDRESS) {
        throw new Error("Escrow contract address is not configured.");
      }
      if (!LYT_ADDRESS) {
        throw new Error("Elixir token address is not configured.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(String(tokenAmount), 18);

      const token = new ethers.Contract(LYT_ADDRESS, ERC20_ABI, signer);
      const balance = await token.balanceOf(account);
      if (balance < amountWei) {
        throw new Error("Insufficient Elixir balance in your MetaMask wallet.");
      }

      // 1) Approve the escrow contract to pull the tokens (if not already).
      const allowance = await token.allowance(account, ESCROW_ADDRESS);
      if (allowance < amountWei) {
        const approveTx = await token.approve(ESCROW_ADDRESS, amountWei);
        await approveTx.wait();
      }

      // 2) Lock the tokens in escrow.
      const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.createTokenEscrow(
        seller,
        String(productRef),
        BigInt(Math.round(Number(tokenAmount))),
      );
      const receipt = await tx.wait();
      return receipt.hash;
    },
    [account],
  );

  /**
   * Confirm delivery — releases the escrowed ETH to the seller and mints the
   * buyer's loyalty reward + NFT receipt. Returns the transaction hash.
   */
  const confirmDeliveryOnChain = useCallback(
    async (escrowId) => {
      const contract = await getEscrowContract();
      const tx = await contract.confirmDelivery(BigInt(escrowId));
      const receipt = await tx.wait();
      await fetchBalance(account);
      return receipt.hash;
    },
    [getEscrowContract, fetchBalance, account],
  );

  /**
   * Raise a dispute on a funded escrow (before release). Returns the tx hash.
   */
  const raiseDisputeOnChain = useCallback(
    async (escrowId) => {
      const contract = await getEscrowContract();
      const tx = await contract.raiseDispute(BigInt(escrowId));
      const receipt = await tx.wait();
      return receipt.hash;
    },
    [getEscrowContract],
  );

  // Listen for MetaMask events
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        fetchBalance(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex) => {
      setChainId(parseInt(chainIdHex, 16));
      if (account) fetchBalance(account);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [account, fetchBalance, disconnectWallet]);

  // Auto-refresh balance every 15 seconds when connected
  useEffect(() => {
    if (!account) return;
    const interval = setInterval(() => fetchBalance(account), 15000);
    return () => clearInterval(interval);
  }, [account, fetchBalance]);

  // Check if already connected on mount
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          fetchBalance(accounts[0]);
          window.ethereum
            .request({ method: "eth_chainId" })
            .then((hex) => setChainId(parseInt(hex, 16)));
        }
      })
      .catch(() => {});
  }, [fetchBalance]);

  return (
    <Web3Context.Provider
      value={{
        account,
        ethBalance,
        chainId,
        isConnected,
        connecting,
        error,
        connectWallet,
        disconnectWallet,
        fetchBalance,
        sendEth,
        sendToken,
        getElixirBalance,
        payWithEthOnChain,
        payWithTokensOnChain,
        createEscrowOnChain,
        createTokenEscrowOnChain,
        confirmDeliveryOnChain,
        raiseDisputeOnChain,
        lytAddress: LYT_ADDRESS,
        ecommerceAddress: ECOMMERCE_ADDRESS,
        escrowAddress: ESCROW_ADDRESS,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export const useWeb3 = () => useContext(Web3Context);
