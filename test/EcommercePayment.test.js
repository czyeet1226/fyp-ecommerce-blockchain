/**
 * test/EcommercePayment.test.js
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Tests cover:
 *  - LoyaltyToken deployment & minting
 *  - EcommercePayment ETH-only flow
 *  - EcommercePayment Token-only flow
 *  - EcommercePayment Hybrid flow
 *  - Seller transfer verification (on-chain)
 *  - Token reward issuance
 *  - Platform fee calculation
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Blockchain E-Commerce Platform", function () {
  let loyaltyToken, ecommerce;
  let deployer, seller1, seller2, customer1, customer2;
  const SEED_ETH = ethers.parseEther("10"); // reserve for token redemptions

  beforeEach(async function () {
    [deployer, seller1, seller2, customer1, customer2] = await ethers.getSigners();

    // Deploy LoyaltyToken
    const LoyaltyToken = await ethers.getContractFactory("LoyaltyToken");
    loyaltyToken = await LoyaltyToken.deploy();
    await loyaltyToken.waitForDeployment();

    // Deploy EcommercePayment
    const EcommercePayment = await ethers.getContractFactory("EcommercePayment");
    ecommerce = await EcommercePayment.deploy(await loyaltyToken.getAddress());
    await ecommerce.waitForDeployment();

    // Link contracts
    await loyaltyToken.setEcommerceContract(await ecommerce.getAddress());

    // Seed reserve ETH
    await deployer.sendTransaction({ to: await ecommerce.getAddress(), value: SEED_ETH });
  });

  // ── LoyaltyToken ────────────────────────────────────────────────────────

  describe("LoyaltyToken", function () {
    it("should deploy with correct name and symbol", async function () {
      expect(await loyaltyToken.name()).to.equal("LoyaltyToken");
      expect(await loyaltyToken.symbol()).to.equal("LYT");
    });

    it("should mint 1,000,000 LYT to deployer on deployment", async function () {
      const balance = await loyaltyToken.getTokenBalance(deployer.address);
      expect(balance).to.equal(1_000_000n);
    });

    it("should set ecommerce contract correctly", async function () {
      expect(await loyaltyToken.ecommerceContract()).to.equal(await ecommerce.getAddress());
    });

    it("should reject direct issueTokensForPurchase from non-ecommerce address", async function () {
      await expect(
        loyaltyToken.issueTokensForPurchase(customer1.address, ethers.parseEther("1"))
      ).to.be.revertedWith("LoyaltyToken: caller is not the e-commerce contract");
    });
  });

  // ── ETH-Only Payment ─────────────────────────────────────────────────────

  describe("ETH-Only Payment", function () {
    const paymentAmount = ethers.parseEther("1"); // 1 ETH

    it("should transfer ETH to seller minus platform fee", async function () {
      const sellerBefore = await ethers.provider.getBalance(seller1.address);

      await ecommerce.connect(customer1).payWithETH(seller1.address, "PROD-001", {
        value: paymentAmount,
      });

      const sellerAfter = await ethers.provider.getBalance(seller1.address);
      const fee = (paymentAmount * 200n) / 10_000n; // 2%
      const expectedSellerAmount = paymentAmount - fee;

      expect(sellerAfter - sellerBefore).to.equal(expectedSellerAmount);
    });

    it("should issue LYT tokens to buyer after ETH payment", async function () {
      await ecommerce.connect(customer1).payWithETH(seller1.address, "PROD-001", {
        value: paymentAmount,
      });

      const tokenBalance = await loyaltyToken.getTokenBalance(customer1.address);
      expect(tokenBalance).to.be.greaterThan(0n);
      // 1 ETH × 1000 LYT/ETH = 1000 LYT
      expect(tokenBalance).to.equal(1000n);
    });

    it("should create a completed order record on-chain", async function () {
      await ecommerce.connect(customer1).payWithETH(seller1.address, "PROD-002", {
        value: paymentAmount,
      });

      const order = await ecommerce.getOrder(1);
      expect(order.completed).to.be.true;
      expect(order.buyer).to.equal(customer1.address);
      expect(order.seller).to.equal(seller1.address);
      expect(order.productRef).to.equal("PROD-002");
      expect(order.mode).to.equal(0); // ETH_ONLY
    });

    it("should revert if buyer and seller are the same", async function () {
      await expect(
        ecommerce.connect(seller1).payWithETH(seller1.address, "PROD-003", {
          value: paymentAmount,
        })
      ).to.be.revertedWith("EcommercePayment: buyer == seller");
    });
  });

  // ── Token-Only Payment ────────────────────────────────────────────────────

  describe("Token-Only Payment", function () {
    beforeEach(async function () {
      // Give customer1 some LYT tokens first (via a purchase)
      await ecommerce.connect(customer1).payWithETH(seller1.address, "SETUP", {
        value: ethers.parseEther("2"),
      });
      // customer1 now has 2000 LYT
    });

    it("should burn buyer tokens and pay seller in ETH", async function () {
      const tokensBefore = await loyaltyToken.getTokenBalance(customer1.address);
      const sellerBefore = await ethers.provider.getBalance(seller1.address);

      await ecommerce.connect(customer1).payWithTokens(seller1.address, 100n, "PROD-010");

      const tokensAfter = await loyaltyToken.getTokenBalance(customer1.address);
      const sellerAfter = await ethers.provider.getBalance(seller1.address);

      expect(tokensAfter).to.be.lessThan(tokensBefore);
      expect(sellerAfter).to.be.greaterThan(sellerBefore);
    });

    it("should revert if customer has insufficient tokens", async function () {
      await expect(
        ecommerce.connect(customer2).payWithTokens(seller1.address, 5000n, "PROD-011")
      ).to.be.revertedWith("EcommercePayment: insufficient LYT balance");
    });
  });

  // ── Hybrid Payment ────────────────────────────────────────────────────────

  describe("Hybrid Payment", function () {
    beforeEach(async function () {
      // Give customer1 tokens
      await ecommerce.connect(customer1).payWithETH(seller1.address, "SETUP", {
        value: ethers.parseEther("1"),
      });
      // customer1 now has 1000 LYT
    });

    it("should accept part ETH + part tokens and pay seller correctly", async function () {
      const totalPrice = ethers.parseEther("0.5"); // 0.5 ETH order
      const tokensToUse = 200n;                    // 200 LYT = 0.2 ETH equivalent
      const ethRequired = ethers.parseEther("0.3"); // 0.5 - 0.2 = 0.3 ETH

      const sellerBefore = await ethers.provider.getBalance(seller1.address);
      const tokensBefore = await loyaltyToken.getTokenBalance(customer1.address);

      await ecommerce.connect(customer1).payHybrid(
        seller1.address, totalPrice, tokensToUse, "PROD-020",
        { value: ethRequired }
      );

      const sellerAfter = await ethers.provider.getBalance(seller1.address);
      const tokensAfter = await loyaltyToken.getTokenBalance(customer1.address);

      const fee = (totalPrice * 200n) / 10_000n;
      const expectedSellerReceives = totalPrice - fee;

      expect(sellerAfter - sellerBefore).to.equal(expectedSellerReceives);
      expect(tokensBefore - tokensAfter).to.equal(tokensToUse);
    });

    it("should record order with HYBRID mode", async function () {
      const totalPrice = ethers.parseEther("0.3");
      const tokensToUse = 100n;
      const ethRequired = ethers.parseEther("0.2");

      await ecommerce.connect(customer1).payHybrid(
        seller1.address, totalPrice, tokensToUse, "PROD-021",
        { value: ethRequired }
      );

      const orderId = await ecommerce.orderCounter();
      const order = await ecommerce.getOrder(orderId);
      expect(order.mode).to.equal(2); // HYBRID
      expect(order.completed).to.be.true;
    });
  });

  // ── Order History ─────────────────────────────────────────────────────────

  describe("Order History", function () {
    it("should track buyer orders correctly", async function () {
      await ecommerce.connect(customer1).payWithETH(seller1.address, "P1", { value: ethers.parseEther("0.1") });
      await ecommerce.connect(customer1).payWithETH(seller2.address, "P2", { value: ethers.parseEther("0.1") });

      const orders = await ecommerce.getBuyerOrders(customer1.address);
      expect(orders.length).to.equal(2);
    });

    it("should track seller orders correctly", async function () {
      await ecommerce.connect(customer1).payWithETH(seller1.address, "P1", { value: ethers.parseEther("0.1") });
      await ecommerce.connect(customer2).payWithETH(seller1.address, "P2", { value: ethers.parseEther("0.1") });

      const orders = await ecommerce.getSellerOrders(seller1.address);
      expect(orders.length).to.equal(2);
    });
  });
});
