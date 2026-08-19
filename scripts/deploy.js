/**
 * deploy.js — Hardhat deployment script
 * FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Deploys:
 *   1. LoyaltyToken  (ERC-20, LYT)
 *   2. EcommercePayment  (payment + loyalty logic)
 *
 * Then:
 *   - Links both contracts together
 *   - Seeds the EcommercePayment contract with 5 ETH as reserve (for token redemptions)
 *   - Prints all 20 Hardhat test accounts for local testing
 *   - Writes deployed addresses to deployedAddresses.json (consumed by backend + frontend)
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, ...accounts] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const networkName = hre.network.name;
  const reserveEth =
    process.env.RESERVE_ETH || (chainId === 31337 ? "5.0" : "0");

  console.log("\n========================================================");
  console.log("  Blockchain E-Commerce Platform — Deployment");
  console.log("  FYP: Chan Zean Yeet TP070394 — APD3F2601");
  console.log("========================================================\n");

  console.log(`Deployer address  : ${deployer.address}`);
  console.log(`Deployer balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ── 1. Deploy LoyaltyToken ──────────────────────────────────────────────
  console.log("Deploying LoyaltyToken (LYT)...");
  const LoyaltyToken = await ethers.getContractFactory("LoyaltyToken");
  const loyaltyToken = await LoyaltyToken.deploy();
  await loyaltyToken.waitForDeployment();
  const loyaltyTokenAddress = await loyaltyToken.getAddress();
  console.log(`✅  LoyaltyToken deployed at : ${loyaltyTokenAddress}`);

  // ── 2. Deploy EcommercePayment ──────────────────────────────────────────
  console.log("\nDeploying EcommercePayment...");
  const EcommercePayment = await ethers.getContractFactory("EcommercePayment");
  const ecommerce = await EcommercePayment.deploy(loyaltyTokenAddress);
  await ecommerce.waitForDeployment();
  const ecommerceAddress = await ecommerce.getAddress();
  console.log(`✅  EcommercePayment deployed at : ${ecommerceAddress}`);

  // ── 3. Link contracts ───────────────────────────────────────────────────
  console.log("\nLinking LoyaltyToken → EcommercePayment...");
  const linkTx = await loyaltyToken.setEcommerceContract(ecommerceAddress);
  await linkTx.wait();
  console.log("✅  LoyaltyToken.ecommerceContract set");

  // ── 2b. Deploy PurchaseReceipt (ERC-721 proof-of-purchase) ───────────────
  console.log("\nDeploying PurchaseReceipt (NFT receipts)...");
  const PurchaseReceipt = await ethers.getContractFactory("PurchaseReceipt");
  const receipt = await PurchaseReceipt.deploy();
  await receipt.waitForDeployment();
  const receiptAddress = await receipt.getAddress();
  console.log(`✅  PurchaseReceipt deployed at : ${receiptAddress}`);

  // ── 2c. Deploy PurchaseEscrow (escrow-based delivery confirmation) ───────
  console.log("\nDeploying PurchaseEscrow...");
  const PurchaseEscrow = await ethers.getContractFactory("PurchaseEscrow");
  const escrow = await PurchaseEscrow.deploy(loyaltyTokenAddress, receiptAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✅  PurchaseEscrow deployed at : ${escrowAddress}`);

  // ── 3b. Authorise escrow to mint loyalty rewards + receipts ──────────────
  console.log("\nAuthorising PurchaseEscrow as minter...");
  await (await loyaltyToken.setMinter(escrowAddress, true)).wait();
  console.log("✅  LoyaltyToken.setMinter(escrow) set");
  await (await receipt.setMinter(escrowAddress, true)).wait();
  console.log("✅  PurchaseReceipt.setMinter(escrow) set");

  // ── 4. Seed reserve ETH into EcommercePayment ──────────────────────────
  if (Number(reserveEth) > 0) {
    console.log(`\nSeeding ${reserveEth} ETH reserve into EcommercePayment...`);
    const seedTx = await deployer.sendTransaction({
      to: ecommerceAddress,
      value: ethers.parseEther(reserveEth),
    });
    await seedTx.wait();
    console.log(`✅  Reserve balance: ${ethers.formatEther(await ethers.provider.getBalance(ecommerceAddress))} ETH`);
  } else {
    console.log("\nℹ️  Skipping reserve ETH funding");
  }

  // ── 5. Print Hardhat Accounts ───────────────────────────────────────────
  console.log("\n──────────────────────────────────────────────────────────");
  console.log("  Hardhat Simulated Accounts (for testing)");
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  [0] DEPLOYER/ADMIN : ${deployer.address}`);
  const roles = ["Seller 1", "Seller 2", "Seller 3", "Customer 1", "Customer 2",
                 "Customer 3", "Customer 4", "Customer 5", "Customer 6", "Customer 7",
                 "Customer 8", "Customer 9", "Customer 10", "Tester", "Tester",
                 "Tester", "Tester", "Tester", "Tester"];
  accounts.slice(0, 19).forEach((acc, i) => {
    console.log(`  [${i + 1}] ${roles[i].padEnd(12)}: ${acc.address}`);
  });

  // ── 6. Write addresses to JSON ──────────────────────────────────────────
  const deployed = {
    network: networkName,
    chainId,
    deployedAt: new Date().toISOString(),
    contracts: {
      LoyaltyToken: loyaltyTokenAddress,
      EcommercePayment: ecommerceAddress,
      PurchaseReceipt: receiptAddress,
      PurchaseEscrow: escrowAddress,
    },
    accounts: {
      deployer: deployer.address,
      sellers: accounts.slice(0, 3).map((a) => a.address),
      customers: accounts.slice(3, 13).map((a) => a.address),
    },
  };

  const outPath = path.join(__dirname, "..", "deployedAddresses.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`\n✅  Addresses saved to deployedAddresses.json`);

  // Copy to backend and frontend for convenience
  const backendOut = path.join(__dirname, "..", "backend", "deployedAddresses.json");
  const frontendOut = path.join(__dirname, "..", "frontend", "src", "deployedAddresses.json");
  fs.writeFileSync(backendOut, JSON.stringify(deployed, null, 2));
  fs.writeFileSync(frontendOut, JSON.stringify(deployed, null, 2));

  console.log("\n========================================================");
  console.log("  Deployment complete!");
  console.log("  Run `npm run backend` to start the API server.");
  console.log("  Run `npm run frontend` to start the React app.");
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
