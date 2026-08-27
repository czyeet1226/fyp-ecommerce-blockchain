# Entity Relationship Diagram — Blockchain E-Commerce Platform

Generated directly from the actual schema in `backend/models/mysql.models.js`
(MySQL / Sequelize) and `backend/models/blockchainLog.model.js` (MongoDB /
Mongoose). Written in Mermaid `erDiagram` syntax.

`erDiagram` is a natively supported draw.io Mermaid type
(**Arrange → Insert → Mermaid**, paste starting from `erDiagram`, click
**Insert**). For Figma, export as SVG from [mermaid.live](https://mermaid.live)
and drag it onto the canvas — see the notes at the end of this file.

> Note: `blockchainlogs` is a MongoDB collection, not a MySQL table. It has
> no foreign key constraints, but it references orders and users by
> `orderId`/`buyerAddress`/`sellerAddress` as plain string fields (an
> application-level relationship, not an enforced one). It's included here
> as a dashed relationship to show how the "decentralised" audit log ties
> back to the relational data.

```mermaid
erDiagram
    USERS {
        uuid id PK
        string userCode UK "U0001 style, auto-incremented"
        string name
        string email UK
        string phone
        string address
        string passwordHash
        enum role "customer | merchant | admin"
        string walletAddress UK "app-generated wallet"
        string metamaskAddress UK "nullable, one per user"
        string walletPrivateKey "dev-only, never store real keys"
        boolean isActive
        enum plan "starter | pro | enterprise"
        enum pendingPlan "nullable"
        datetime planRenewsAt
        datetime createdAt
        datetime updatedAt
    }

    CUSTOMER_WALLET {
        uuid id PK
        string userCode FK "references USERS.userCode"
        decimal RM "off-chain fiat ledger balance"
        decimal Elixir "mirrors on-chain LYT balance"
        decimal ETH "mirrors on-chain ETH balance"
        boolean hideBalance
        string walletAddress UK
        datetime createdAt
        datetime updatedAt
    }

    PRODUCTS {
        uuid id PK
        uuid merchantId FK "references USERS.id"
        string name
        text description
        decimal priceEth
        decimal priceMyr
        string category
        int stock
        string imageUrl
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    ORDERS {
        uuid id PK
        bigint onChainOrderId "EcommercePayment orderId"
        uuid customerId FK "references USERS.id"
        uuid merchantId FK "references USERS.id"
        uuid productId FK "nullable, references PRODUCTS.id"
        int quantity
        decimal totalPriceEth
        enum paymentMode "ETH_ONLY | TOKEN_ONLY | HYBRID | RM_ONLY | ETH_ESCROW | TOKEN_ESCROW"
        decimal ethPaid
        bigint tokensPaid
        bigint tokensEarned
        string txHash
        enum status "pending | completed | cancelled"
        int fulfillmentStage "0-4, seller-controlled"
        text deliveryAddress
        bigint escrowId "PurchaseEscrow id"
        enum escrowStatus "none | funded | released | refunded | disputed"
        boolean deliveryConfirmed
        datetime deliveryConfirmedAt
        bigint receiptTokenId "PurchaseReceipt NFT id"
        string receiptTxHash
        datetime createdAt
        datetime updatedAt
    }

    ORDER_ITEMS {
        uuid id PK
        uuid orderId FK "references ORDERS.id, CASCADE"
        uuid productId FK "references PRODUCTS.id"
        uuid merchantId FK "references USERS.id"
        string productName "snapshot at purchase time"
        int quantity
        decimal unitPriceEth
        datetime createdAt
        datetime updatedAt
    }

    CARTS {
        uuid id PK
        uuid customerId FK "references USERS.id"
        uuid productId FK "references PRODUCTS.id"
        int quantity
        datetime createdAt
        datetime updatedAt
    }

    WALLET_TRANSACTIONS {
        uuid id PK
        string userCode FK "references USERS.userCode"
        enum type "SWAP | TRANSFER_OUT | TRANSFER_IN | DEPOSIT | STAKE | UNSTAKE"
        enum fromCurrency "ETH | ELIXIR | RM, nullable"
        enum toCurrency "ETH | ELIXIR | RM, nullable"
        decimal fromAmount
        decimal toAmount
        string counterparty
        string txHash
        string note
        enum status "pending | completed | failed"
        datetime createdAt
        datetime updatedAt
    }

    STAKE_POSITIONS {
        uuid id PK
        string userCode FK "references USERS.userCode"
        decimal amount "principal Elixir staked"
        int tierDays
        decimal apy "annual percentage yield"
        int compoundFrequency "compounds per year, default 12"
        datetime stakedAt
        datetime maturityAt
        decimal rewardPaid
        enum status "active | completed"
        datetime createdAt
        datetime updatedAt
    }

    STAKING_TIERS {
        uuid id PK
        int days UK "lock-up period"
        decimal apy "admin-editable"
        string label
        int sortOrder
        datetime createdAt
        datetime updatedAt
    }

    SUBSCRIPTION_PAYMENTS {
        uuid id PK
        uuid sellerId FK "references USERS.id"
        string sellerCode
        enum plan "starter | pro | enterprise"
        decimal amountEth
        string txHash
        datetime periodStart
        datetime periodEnd
        enum status "completed | failed"
        datetime createdAt
        datetime updatedAt
    }

    BLOCKCHAIN_LOGS {
        objectid _id PK "MongoDB document id"
        string eventType "PaymentCompleted | TokensIssued | TokensRedeemed | OrderCreated | EscrowCreated | EscrowReleased | EscrowDisputed | EscrowRefunded | ReceiptMinted"
        string orderId "app-level reference to ORDERS.id"
        string buyerAddress "app-level reference to USERS.metamaskAddress"
        string sellerAddress "app-level reference to USERS.metamaskAddress"
        string txHash UK "sparse unique"
        int blockNumber
        string sellerReceivesWei
        string platformFeeWei
        string tokensEarned
        string paymentMode
        string customerAddress
        string tokensIssuedWei
        string issueReason
        string tokensRedeemedWei
        string productRef
        string notes
        datetime createdAt
        datetime updatedAt
    }

    USERS ||--o| CUSTOMER_WALLET : "has (customer role)"
    USERS ||--o{ PRODUCTS : "lists (merchant role)"
    USERS ||--o{ ORDERS : "places (as customer)"
    USERS ||--o{ ORDERS : "receives (as merchant)"
    USERS ||--o{ ORDER_ITEMS : "sells (as merchant)"
    USERS ||--o{ CARTS : "owns"
    USERS ||--o{ WALLET_TRANSACTIONS : "logs"
    USERS ||--o{ STAKE_POSITIONS : "stakes"
    STAKING_TIERS ||..o{ STAKE_POSITIONS : "selected by tierDays (logical, no FK)"
    USERS ||--o{ SUBSCRIPTION_PAYMENTS : "pays (as seller)"

    PRODUCTS ||--o{ ORDERS : "primary item (nullable)"
    PRODUCTS ||--o{ ORDER_ITEMS : "referenced in basket"
    PRODUCTS ||--o{ CARTS : "added to cart"

    ORDERS ||--o{ ORDER_ITEMS : "contains (CASCADE delete)"

    ORDERS }o..o{ BLOCKCHAIN_LOGS : "audited by (orderId string ref)"
    USERS }o..o{ BLOCKCHAIN_LOGS : "audited by (address string ref)"
```

---

## Notes on the schema design

- **Single `users` table with a `role` column.** There is no
  table-per-role inheritance (no separate `customers`/`merchants`/`admins`
  tables). `role` is a MySQL ENUM(`customer`, `merchant`, `admin`), and
  role-specific fields (subscription `plan`, `pendingPlan`, `planRenewsAt`)
  live on the same row even though only merchants use them.
- **`CUSTOMER_WALLET` is 1:1 with `USERS`**, keyed by `userCode` rather than
  `id`. Only customer-role users get a wallet row (created in
  `ensureCustomerWalletRows()` at backend startup and in the registration
  transaction).
- **`ORDERS.productId` is nullable.** Single-item legacy checkouts
  (ETH_ONLY/TOKEN_ONLY) set it directly; multi-item basket checkouts
  (escrow/RM) leave it null and store line items in `ORDER_ITEMS` instead.
- **Money/token fields intentionally mix DB and on-chain sources of truth.**
  `CUSTOMER_WALLET.RM` is the authoritative ledger value. `CUSTOMER_WALLET.ETH`
  and `.Elixir` are mirrors of on-chain balances, refreshed opportunistically
  by routes like `GET /api/payment/wallet` — the blockchain itself remains
  the source of truth for those two.
- **`BLOCKCHAIN_LOGS` lives in MongoDB, not MySQL**, so it has no real
  foreign keys. Its `orderId`, `buyerAddress`, and `sellerAddress` fields are
  plain strings that happen to match `ORDERS.id` and `USERS.metamaskAddress`
  values — an application-level join, shown here as a dashed relationship.
- **Smart contracts are not part of this ERD.** `LoyaltyToken`,
  `EcommercePayment`, `PurchaseEscrow`, and `PurchaseReceipt` are on-chain
  state (Solidity storage), not rows in either database. Their relevant
  fields already appear in the class diagrams in `diagrams.md`.

---

## Getting this into draw.io or Figma

**draw.io:**
1. Open **Arrange → Insert → Mermaid**.
2. Paste the code above, starting from `erDiagram`.
3. Click **Insert**.

`erDiagram` is natively supported, so it should convert to native draw.io
entity tables directly. If any relationship label or crow's-foot notation
looks off, switch to the **Image** insert option.

**Figma:**
Same as the other diagrams — paste into
[mermaid.live](https://mermaid.live), export as SVG, and drag the file onto
your Figma canvas, since I don't have a tool that draws directly onto a
Figma canvas.
