/**
 * backend/models/mysql.models.js
 *
 * CENTRALISED DATABASE (MySQL via Sequelize)
 * ─────────────────────────────────────────
 * Tables:
 *   users     — customers and merchants, login credentials, wallet address
 *   products  — merchant product listings
 *   orders    — order metadata (links to on-chain orderId)
 *   carts     — shopping cart items (temporary, pre-checkout)
 */

const { DataTypes } = require("sequelize");
const { mysqlDB } = require("../config/database");

function formatUserCode(value) {
  return `U${String(value).padStart(4, "0")}`;
}

async function getNextUserCode() {
  const latestUser = await User.findOne({
    attributes: ["userCode"],
    where: {
      userCode: {
        [require("sequelize").Op.ne]: null,
      },
    },
    order: [["userCode", "DESC"]],
  });

  const latestCode = latestUser?.userCode || "";
  const latestNumber = parseInt(String(latestCode).replace(/^U/i, ""), 10);
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

  return formatUserCode(nextNumber);
}

// ── User ──────────────────────────────────────────────────────────────────

const User = mysqlDB.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userCode: {
      type: DataTypes.STRING(8),
      unique: true,
      allowNull: true,
      comment: "Human-friendly incremental user code such as U0001",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Default shipping/delivery address for the customer",
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("customer", "merchant", "admin"),
      defaultValue: "customer",
    },
    walletAddress: {
      type: DataTypes.STRING(42), // Ethereum address
      unique: true,
      comment: "Hardhat/blockchain wallet address linked to this account",
    },
    metamaskAddress: {
      type: DataTypes.STRING(42),
      allowNull: true,
      unique: true,
      comment:
        "MetaMask wallet bound to this account. One address per user, not shareable across accounts.",
    },
    // Note: privateKey is stored only during development with Hardhat.
    // In production, the user would manage their own wallet (MetaMask etc.).
    walletPrivateKey: {
      type: DataTypes.TEXT,
      comment: "Hardhat test private key — NEVER store real keys in a database",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // ── Seller subscription plan ──────────────────────────────────────────
    plan: {
      type: DataTypes.ENUM("starter", "pro", "enterprise"),
      allowNull: false,
      defaultValue: "starter",
      comment: "Seller's active subscription plan",
    },
    pendingPlan: {
      type: DataTypes.ENUM("starter", "pro", "enterprise"),
      allowNull: true,
      comment: "Plan change queued to take effect at the next billing cycle",
    },
    planRenewsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Next monthly billing date for the seller's subscription",
    },
    // ── Password reset ────────────────────────────────────────────────────
    // Only the SHA-256 hash of the reset token is stored, so a database leak
    // does not hand out usable reset links. The raw token exists only in the
    // email that was sent to the account owner.
    resetTokenHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "SHA-256 hash of the active password reset token",
    },
    resetTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiry timestamp for the active password reset token",
    },
  },
  {
    tableName: "users",
    timestamps: true,
  },
);

const CustomerWallet = mysqlDB.define(
  "CustomerWallet",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      references: { model: "users", key: "userCode" },
    },
    RM: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    Elixir: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      defaultValue: 0,
    },
    ETH: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      defaultValue: 0,
    },
    hideBalance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    walletAddress: {
      type: DataTypes.STRING(42),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "customer_wallet",
    timestamps: true,
  },
);

User.addHook("beforeCreate", async (user) => {
  if (user.userCode) {
    return;
  }

  user.userCode = await getNextUserCode();
});

User.hasOne(CustomerWallet, {
  foreignKey: "userCode",
  sourceKey: "userCode",
  as: "customerWallet",
});
CustomerWallet.belongsTo(User, {
  foreignKey: "userCode",
  targetKey: "userCode",
  as: "user",
});

// ── Product ───────────────────────────────────────────────────────────────

const Product = mysqlDB.define(
  "Product",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    merchantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    priceEth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      comment: "Price in ETH (e.g. 0.05)",
    },
    priceMyr: {
      type: DataTypes.DECIMAL(10, 2),
      comment: "Display price in MYR for reference",
    },
    category: {
      type: DataTypes.STRING(100),
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    imageUrl: {
      type: DataTypes.STRING(500),
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "products",
    timestamps: true,
  },
);

// ── Order (metadata only — actual payment lives on-chain) ─────────────────

const Order = mysqlDB.define(
  "Order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    onChainOrderId: {
      type: DataTypes.BIGINT,
      comment: "The orderId from EcommercePayment smart contract",
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    merchantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true, // basket orders keep line items in order_items instead
      references: { model: "products", key: "id" },
      comment:
        "Primary product for single-item orders; null for multi-item baskets",
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: "Total item units across the whole order",
    },
    totalPriceEth: {
      type: DataTypes.DECIMAL(18, 8),
    },
    paymentMode: {
      type: DataTypes.ENUM(
        "ETH_ONLY",
        "TOKEN_ONLY",
        "HYBRID",
        "RM_ONLY",
        "ETH_ESCROW",
        "TOKEN_ESCROW",
      ),
    },
    ethPaid: {
      type: DataTypes.DECIMAL(18, 8),
    },
    tokensPaid: {
      type: DataTypes.BIGINT,
      comment: "LYT tokens used for payment",
    },
    tokensEarned: {
      type: DataTypes.BIGINT,
      comment: "LYT tokens rewarded for this purchase",
    },
    txHash: {
      type: DataTypes.STRING(66),
      comment: "Blockchain transaction hash",
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "cancelled"),
      defaultValue: "pending",
    },
    fulfillmentStage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment:
        "Seller-controlled delivery progress index (0=Order placed, 1=Processing, 2=Packed, 3=Shipped, 4=Delivered)",
    },
    deliveryAddress: {
      type: DataTypes.TEXT,
    },
    // ── Escrow (delivery-confirmation) ────────────────────────────────────
    escrowId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "On-chain escrow id from PurchaseEscrow (ETH_ESCROW orders)",
    },
    escrowStatus: {
      type: DataTypes.ENUM(
        "none",
        "funded",
        "released",
        "refunded",
        "disputed",
      ),
      allowNull: false,
      defaultValue: "none",
      comment: "Escrow lifecycle state for ETH_ESCROW orders",
    },
    deliveryConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Buyer confirmed receipt of the goods",
    },
    deliveryConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // ── NFT purchase receipt ──────────────────────────────────────────────
    receiptTokenId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "PurchaseReceipt ERC-721 token id minted for this order",
    },
    receiptTxHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      comment: "Transaction hash of the receipt mint",
    },
  },
  {
    tableName: "orders",
    timestamps: true,
  },
);

// ── OrderItem (line items for a multi-product basket order) ────────────────

const OrderItem = mysqlDB.define(
  "OrderItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "orders", key: "id" },
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
    merchantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    productName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Snapshot of the product name at purchase time",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unitPriceEth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      comment: "Unit price in ETH at purchase time",
    },
  },
  {
    tableName: "order_items",
    timestamps: true,
  },
);

// ── Cart ──────────────────────────────────────────────────────────────────

const Cart = mysqlDB.define(
  "Cart",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
  },
  {
    tableName: "carts",
    timestamps: true,
  },
);

// ── WalletTransaction (swap / transfer / deposit / stake / unstake history) ─

const WalletTransaction = mysqlDB.define(
  "WalletTransaction",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      references: { model: "users", key: "userCode" },
    },
    type: {
      type: DataTypes.ENUM(
        "SWAP",
        "TRANSFER_OUT",
        "TRANSFER_IN",
        "DEPOSIT",
        "STAKE",
        "UNSTAKE",
      ),
      allowNull: false,
    },
    fromCurrency: {
      type: DataTypes.ENUM("ETH", "ELIXIR", "RM"),
      allowNull: true,
    },
    toCurrency: {
      type: DataTypes.ENUM("ETH", "ELIXIR", "RM"),
      allowNull: true,
    },
    fromAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
    },
    toAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
    },
    counterparty: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: "Recipient/sender wallet address or platform for transfers",
    },
    txHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      comment: "On-chain tx hash when ETH is involved",
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed"),
      allowNull: false,
      defaultValue: "completed",
    },
  },
  {
    tableName: "wallet_transactions",
    timestamps: true,
  },
);

// ── StakePosition (Elixir staking positions) ──────────────────────────────

const StakePosition = mysqlDB.define(
  "StakePosition",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      references: { model: "users", key: "userCode" },
    },
    amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      comment: "Principal Elixir staked",
    },
    tierDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    apy: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: "Annual percentage yield for the tier",
    },
    compoundFrequency: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 12,
      comment: "Compounds per year (monthly = 12)",
    },
    stakedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    maturityAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    rewardPaid: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      comment: "Interest paid out at unstake",
    },
    status: {
      type: DataTypes.ENUM("active", "completed"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "stake_positions",
    timestamps: true,
  },
);

User.hasMany(WalletTransaction, {
  foreignKey: "userCode",
  sourceKey: "userCode",
  as: "walletTransactions",
});
WalletTransaction.belongsTo(User, {
  foreignKey: "userCode",
  targetKey: "userCode",
  as: "user",
});

User.hasMany(StakePosition, {
  foreignKey: "userCode",
  sourceKey: "userCode",
  as: "stakePositions",
});
StakePosition.belongsTo(User, {
  foreignKey: "userCode",
  targetKey: "userCode",
  as: "user",
});

// ── StakingTier (admin-editable APY configuration) ─────────────────────────

const StakingTier = mysqlDB.define(
  "StakingTier",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      comment: "Lock-up period in days",
    },
    apy: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: "Annual percentage yield (admin-editable)",
    },
    label: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "staking_tiers",
    timestamps: true,
  },
);

// ── SubscriptionPayment (seller monthly plan payments → admin revenue) ─────

const SubscriptionPayment = mysqlDB.define(
  "SubscriptionPayment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    sellerCode: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    plan: {
      type: DataTypes.ENUM("starter", "pro", "enterprise"),
      allowNull: false,
    },
    amountEth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    txHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("completed", "failed"),
      allowNull: false,
      defaultValue: "completed",
    },
  },
  {
    tableName: "subscription_payments",
    timestamps: true,
  },
);

User.hasMany(SubscriptionPayment, {
  foreignKey: "sellerId",
  as: "subscriptionPayments",
});
SubscriptionPayment.belongsTo(User, {
  foreignKey: "sellerId",
  as: "seller",
});

// ── Associations ──────────────────────────────────────────────────────────

User.hasMany(Product, { foreignKey: "merchantId", as: "products" });
Product.belongsTo(User, { foreignKey: "merchantId", as: "merchant" });

User.hasMany(Order, { foreignKey: "customerId", as: "purchases" });
User.hasMany(Order, { foreignKey: "merchantId", as: "sales" });
Order.belongsTo(User, { foreignKey: "customerId", as: "customer" });
Order.belongsTo(User, { foreignKey: "merchantId", as: "merchant" });
Order.belongsTo(Product, { foreignKey: "productId", as: "product" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });
OrderItem.belongsTo(User, { foreignKey: "merchantId", as: "merchant" });

User.hasMany(Cart, { foreignKey: "customerId", as: "cartItems" });
Cart.belongsTo(User, { foreignKey: "customerId", as: "customer" });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" });

module.exports = {
  User,
  CustomerWallet,
  Product,
  Order,
  OrderItem,
  Cart,
  WalletTransaction,
  StakePosition,
  StakingTier,
  SubscriptionPayment,
  getNextUserCode,
};
