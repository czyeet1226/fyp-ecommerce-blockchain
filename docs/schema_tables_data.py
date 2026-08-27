"""
Field-level schema data for every MySQL table and the MongoDB collection,
transcribed directly from docs/erd.md. Each entity is a dict with:
    - name: heading title (e.g. "Users Table")
    - store: "MySQL Table" or "MongoDB Collection"
    - fields: list of (data_type, field_name, constraints, description)
"""

SCHEMA_TABLES = [
    {
        "name": "Users",
        "store": "MySQL Table",
        "description": (
            "The Users table is the foundation for the system that saves all user "
            "accounts, with a field called role that sets up the different types "
            "of users: customer, merchant, and admin. This allows for flexible "
            "user management while maintaining role-specific attributes, rather "
            "than creating one table for each user type. Role-specific "
            "attributes: customers hold a walletAddress and metamaskAddress used "
            "for on-chain payments; merchants additionally use the plan, "
            "pendingPlan, and planRenewsAt fields to manage their subscription "
            "tier; admins only rely on the base account fields and have no "
            "extra attributes, since their access is controlled entirely by the "
            "role value. Every wallet, order, product, cart, wallet "
            "transaction, stake position, and subscription payment record links "
            "back to this table through its id or userCode, making Users the "
            "central reference point for the rest of the schema."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique user identifier"),
            ("string", "userCode", "Unique Key (UK)", "U0001 style, auto-incremented user code"),
            ("string", "name", "NOT NULL", "User's full name"),
            ("string", "email", "Unique Key (UK), NOT NULL", "User's email address"),
            ("string", "phone", "-", "User's phone number"),
            ("string", "address", "-", "User's delivery / contact address"),
            ("string", "passwordHash", "NOT NULL", "Hashed password used for login"),
            ("enum", "role", "NOT NULL", "Account role: customer | merchant | admin"),
            ("string", "walletAddress", "Unique Key (UK)", "App-generated blockchain wallet address"),
            ("string", "metamaskAddress", "Unique Key (UK), NULL", "Linked MetaMask address, nullable, one per user"),
            ("string", "walletPrivateKey", "-", "Dev-only private key, never store real keys"),
            ("boolean", "isActive", "NOT NULL", "Whether the account is active"),
            ("enum", "plan", "NULL", "Merchant subscription plan: starter | pro | enterprise"),
            ("enum", "pendingPlan", "NULL", "Plan pending activation on next renewal"),
            ("datetime", "planRenewsAt", "NULL", "Next subscription renewal date"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Customer Wallet",
        "store": "MySQL Table",
        "description": (
            "The Customer Wallet table holds the off-chain and mirrored on-chain "
            "balances for every customer, linked one-to-one to a Users record "
            "through the userCode reference field rather than the primary id. "
            "Only customer-role users receive a wallet row, created "
            "automatically at registration. RM is the authoritative fiat ledger "
            "balance managed entirely inside the database, while ETH and Elixir "
            "are refreshed mirrors of the customer's actual on-chain balances, "
            "meaning the blockchain remains the real source of truth for those "
            "two currencies. The walletAddress field ties the row back to the "
            "customer's blockchain wallet, and hideBalance is a UI preference "
            "flag rather than a financial attribute."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique wallet record identifier"),
            ("string", "userCode", "Foreign Key (FK)", "References Users.userCode"),
            ("decimal", "RM", "NOT NULL", "Off-chain fiat ledger balance (authoritative)"),
            ("decimal", "Elixir", "NOT NULL", "Mirrors on-chain LYT (Elixir) token balance"),
            ("decimal", "ETH", "NOT NULL", "Mirrors on-chain ETH balance"),
            ("boolean", "hideBalance", "-", "Whether the customer hides balances in the UI"),
            ("string", "walletAddress", "Unique Key (UK)", "Wallet address tied to this balance record"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Products",
        "store": "MySQL Table",
        "description": (
            "The Products table stores every item listed for sale, each owned "
            "by a single merchant through the merchantId reference field. "
            "Rather than separating products by category into different "
            "tables, a single table covers all listings, with category stored "
            "as a plain attribute so merchants can group their own catalogue "
            "freely. priceEth and priceMyr are kept side by side so a product "
            "can be checked out in either currency without a live conversion "
            "lookup. isActive lets a merchant deactivate a listing (for "
            "example when out of stock or discontinued) without deleting the "
            "row, which preserves history for past orders and cart entries "
            "that still reference it."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique product identifier"),
            ("uuid", "merchantId", "Foreign Key (FK)", "References Users.id (merchant role)"),
            ("string", "name", "NOT NULL", "Product name"),
            ("text", "description", "-", "Product description"),
            ("decimal", "priceEth", "NOT NULL", "Price denominated in ETH"),
            ("decimal", "priceMyr", "-", "Price denominated in Malaysian Ringgit"),
            ("string", "category", "-", "Product category"),
            ("int", "stock", "NOT NULL", "Available stock quantity"),
            ("string", "imageUrl", "-", "URL of the product image"),
            ("boolean", "isActive", "NOT NULL", "Whether the product is active / listed"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Orders",
        "store": "MySQL Table",
        "description": (
            "The Orders table is the central record of every purchase, "
            "referencing both the customerId and merchantId from Users so a "
            "single table can represent the transaction from either side. "
            "Rather than creating a separate table for every payment method, "
            "one paymentMode enum column (ETH_ONLY, TOKEN_ONLY, HYBRID, "
            "RM_ONLY, ETH_ESCROW, TOKEN_ESCROW) captures how the order was "
            "paid, and the escrow-specific fields (escrowId, escrowStatus) "
            "and receipt fields (receiptTokenId, receiptTxHash) are simply "
            "left null for orders that do not use those features. "
            "fulfillmentStage tracks the seller-controlled delivery progress "
            "(0-4), while onChainOrderId and txHash tie the row back to the "
            "EcommercePayment smart contract for on-chain verification."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique order identifier"),
            ("bigint", "onChainOrderId", "-", "Order id from the EcommercePayment smart contract"),
            ("uuid", "customerId", "Foreign Key (FK)", "References Users.id (as customer)"),
            ("uuid", "merchantId", "Foreign Key (FK)", "References Users.id (as merchant)"),
            ("uuid", "productId", "Foreign Key (FK), NULL", "Nullable, references Products.id"),
            ("int", "quantity", "NOT NULL", "Quantity ordered"),
            ("decimal", "totalPriceEth", "NOT NULL", "Total order price in ETH"),
            ("enum", "paymentMode", "NOT NULL", "ETH_ONLY | TOKEN_ONLY | HYBRID | RM_ONLY | ETH_ESCROW | TOKEN_ESCROW"),
            ("decimal", "ethPaid", "-", "Amount of ETH paid"),
            ("bigint", "tokensPaid", "-", "Amount of Elixir tokens paid"),
            ("bigint", "tokensEarned", "-", "Loyalty tokens earned from this order"),
            ("string", "txHash", "-", "On-chain transaction hash for the payment"),
            ("enum", "status", "NOT NULL", "pending | completed | cancelled"),
            ("int", "fulfillmentStage", "NOT NULL", "0-4 fulfillment stage, seller-controlled"),
            ("text", "deliveryAddress", "-", "Delivery address for the order"),
            ("bigint", "escrowId", "NULL", "PurchaseEscrow contract id, if escrow was used"),
            ("enum", "escrowStatus", "NULL", "none | funded | released | refunded | disputed"),
            ("boolean", "deliveryConfirmed", "-", "Whether the customer confirmed delivery"),
            ("datetime", "deliveryConfirmedAt", "NULL", "Timestamp delivery was confirmed"),
            ("bigint", "receiptTokenId", "NULL", "PurchaseReceipt NFT token id"),
            ("string", "receiptTxHash", "NULL", "Transaction hash for the receipt mint"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Order Items",
        "store": "MySQL Table",
        "description": (
            "The Order Items table breaks a single Orders row down into its "
            "individual line items, using orderId, productId, and merchantId "
            "reference fields to link each item back to its parent order, its "
            "product, and the merchant selling it. This design supports "
            "multi-product basket checkouts (used by the escrow and RM "
            "payment flows) without needing one Orders row per product. "
            "productName and unitPriceEth are stored as snapshots taken at "
            "purchase time, so historical order details stay accurate even if "
            "the merchant later renames or re-prices the product. Deleting an "
            "order cascades and removes its associated Order Items rows."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique order line item identifier"),
            ("uuid", "orderId", "Foreign Key (FK)", "References Orders.id, CASCADE delete"),
            ("uuid", "productId", "Foreign Key (FK)", "References Products.id"),
            ("uuid", "merchantId", "Foreign Key (FK)", "References Users.id (as merchant)"),
            ("string", "productName", "NOT NULL", "Product name snapshot at purchase time"),
            ("int", "quantity", "NOT NULL", "Quantity of this line item"),
            ("decimal", "unitPriceEth", "NOT NULL", "Unit price in ETH at purchase time"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Carts",
        "store": "MySQL Table",
        "description": (
            "The Carts table holds each customer's pending selections before "
            "checkout, with customerId and productId reference fields linking "
            "a cart row to the customer who added it and the product being "
            "considered. Each row represents one product line with its own "
            "quantity, so a customer's full cart is simply every Carts row "
            "matching their customerId. Rows are removed once checkout "
            "completes and the corresponding Orders and Order Items records "
            "are created, keeping the cart table limited to active, "
            "not-yet-purchased selections."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique cart line item identifier"),
            ("uuid", "customerId", "Foreign Key (FK)", "References Users.id"),
            ("uuid", "productId", "Foreign Key (FK)", "References Products.id"),
            ("int", "quantity", "NOT NULL", "Quantity added to cart"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Wallet Transactions",
        "store": "MySQL Table",
        "description": (
            "The Wallet Transactions table is a single, unified ledger for "
            "every kind of currency movement a user makes, rather than "
            "having a separate table for swaps, transfers, deposits, stakes, "
            "and unstakes. The type enum column (SWAP, TRANSFER_OUT, "
            "TRANSFER_IN, DEPOSIT, STAKE, UNSTAKE) distinguishes which "
            "activity a row represents, and fromCurrency/toCurrency plus "
            "fromAmount/toAmount are simply left null for whichever side does "
            "not apply to that type. userCode links each row back to the "
            "Users table, and counterparty records the other party's user "
            "code or address for peer-to-peer transfers, giving a complete "
            "audit trail of a user's financial activity in one place."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique wallet transaction identifier"),
            ("string", "userCode", "Foreign Key (FK)", "References Users.userCode"),
            ("enum", "type", "NOT NULL", "SWAP | TRANSFER_OUT | TRANSFER_IN | DEPOSIT | STAKE | UNSTAKE"),
            ("enum", "fromCurrency", "NULL", "ETH | ELIXIR | RM, nullable"),
            ("enum", "toCurrency", "NULL", "ETH | ELIXIR | RM, nullable"),
            ("decimal", "fromAmount", "-", "Amount debited from the source currency"),
            ("decimal", "toAmount", "-", "Amount credited to the destination currency"),
            ("string", "counterparty", "NULL", "Counterparty user code / address for transfers"),
            ("string", "txHash", "NULL", "On-chain transaction hash, if applicable"),
            ("string", "note", "-", "Optional free-text note"),
            ("enum", "status", "NOT NULL", "pending | completed | failed"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Stake Positions",
        "store": "MySQL Table",
        "description": (
            "The Stake Positions table records every Elixir stake a customer "
            "opens, linked back to Users through the userCode reference "
            "field. Rather than a foreign key, tierDays is a plain integer "
            "that logically matches a days value in the Staking Tiers table, "
            "letting the tier's rate settings change over time without "
            "retroactively affecting stakes that already locked in their own "
            "apy and compoundFrequency at creation time. stakedAt and "
            "maturityAt define the lock-up window, and status (active | "
            "completed) together with rewardPaid tracks whether the position "
            "is still earning or has already been unstaked and paid out."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique stake position identifier"),
            ("string", "userCode", "Foreign Key (FK)", "References Users.userCode"),
            ("decimal", "amount", "NOT NULL", "Principal Elixir amount staked"),
            ("int", "tierDays", "NOT NULL", "Lock-up period selected, matches Staking Tiers.days"),
            ("decimal", "apy", "NOT NULL", "Annual percentage yield at time of staking"),
            ("int", "compoundFrequency", "NOT NULL", "Compounds per year, default 12"),
            ("datetime", "stakedAt", "NOT NULL", "Timestamp the stake was created"),
            ("datetime", "maturityAt", "NOT NULL", "Timestamp the stake matures / unlocks"),
            ("decimal", "rewardPaid", "-", "Reward amount paid out on unstake"),
            ("enum", "status", "NOT NULL", "active | completed"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Staking Tiers",
        "store": "MySQL Table",
        "description": (
            "The Staking Tiers table holds the admin-configurable lock-up "
            "options that customers choose from when opening a stake, such as "
            "30-day, 90-day, or 365-day tiers. It has no foreign key "
            "relationship to any other table; instead, it is referenced "
            "logically by Stake Positions through the matching days/tierDays "
            "values. This separation lets an admin update a tier's apy or "
            "label at any time without altering historical stakes, since "
            "each Stake Positions row already copied the tier's apy at the "
            "moment the stake was created. sortOrder simply controls the "
            "display order of tiers in the staking UI."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique staking tier identifier"),
            ("int", "days", "Unique Key (UK)", "Lock-up period in days"),
            ("decimal", "apy", "NOT NULL", "Admin-editable annual percentage yield"),
            ("string", "label", "-", "Display label for the tier"),
            ("int", "sortOrder", "-", "Display order in the staking UI"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Subscription Payments",
        "store": "MySQL Table",
        "description": (
            "The Subscription Payments table records each fee a merchant "
            "(seller) pays to keep their plan active, linked back to Users "
            "through the sellerId reference field, with sellerCode kept as a "
            "denormalized copy for quick lookups. plan mirrors the plan enum "
            "on the Users table (starter | pro | enterprise) at the time of "
            "payment, so upgrading or downgrading later does not rewrite past "
            "payment history. periodStart and periodEnd define the billing "
            "cycle covered by that payment, and status (completed | failed) "
            "lets the platform decide whether to keep the merchant's plan "
            "active or revert it to pendingPlan on the Users table."
        ),
        "fields": [
            ("uuid", "id", "Primary Key (PK)", "Unique subscription payment identifier"),
            ("uuid", "sellerId", "Foreign Key (FK)", "References Users.id (as seller)"),
            ("string", "sellerCode", "-", "Denormalized seller user code"),
            ("enum", "plan", "NOT NULL", "starter | pro | enterprise"),
            ("decimal", "amountEth", "NOT NULL", "Subscription fee paid, in ETH"),
            ("string", "txHash", "-", "On-chain transaction hash for the payment"),
            ("datetime", "periodStart", "NOT NULL", "Subscription period start date"),
            ("datetime", "periodEnd", "NOT NULL", "Subscription period end date"),
            ("enum", "status", "NOT NULL", "completed | failed"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
    {
        "name": "Blockchain Logs",
        "store": "MongoDB Collection",
        "description": (
            "The Blockchain Logs collection is a MongoDB audit trail that "
            "records every significant on-chain event, such as completed "
            "payments, issued or redeemed tokens, escrow lifecycle changes, "
            "and receipt minting. Unlike the MySQL tables, it has no "
            "enforced foreign keys; instead, orderId, buyerAddress, and "
            "sellerAddress are plain string fields that happen to match "
            "values from the Orders and Users tables, forming an "
            "application-level reference rather than a database-level one. "
            "One flexible eventType field distinguishes the nine possible "
            "event kinds, and unused fields for a given eventType (for "
            "example issueReason on a payment event) are simply left empty, "
            "which is the main advantage MongoDB's schema-less documents give "
            "over a rigid relational table for this kind of event data."
        ),
        "fields": [
            ("objectid", "_id", "Primary Key (PK)", "MongoDB document id"),
            ("string", "eventType", "NOT NULL", "PaymentCompleted | TokensIssued | TokensRedeemed | OrderCreated | EscrowCreated | EscrowReleased | EscrowDisputed | EscrowRefunded | ReceiptMinted"),
            ("string", "orderId", "-", "App-level reference to Orders.id (no enforced FK)"),
            ("string", "buyerAddress", "-", "App-level reference to Users.metamaskAddress"),
            ("string", "sellerAddress", "-", "App-level reference to Users.metamaskAddress"),
            ("string", "txHash", "Unique Key (UK), sparse", "On-chain transaction hash for the event"),
            ("int", "blockNumber", "-", "Block number the event was recorded in"),
            ("string", "sellerReceivesWei", "-", "Amount the seller receives, in wei"),
            ("string", "platformFeeWei", "-", "Platform fee taken, in wei"),
            ("string", "tokensEarned", "-", "Loyalty tokens earned from the event"),
            ("string", "paymentMode", "-", "Payment mode used for the related order"),
            ("string", "customerAddress", "-", "Customer wallet address for token events"),
            ("string", "tokensIssuedWei", "-", "Tokens issued, in wei"),
            ("string", "issueReason", "-", "Reason tokens were issued"),
            ("string", "tokensRedeemedWei", "-", "Tokens redeemed, in wei"),
            ("string", "productRef", "-", "Reference to the related product"),
            ("string", "notes", "-", "Free-text notes about the event"),
            ("datetime", "createdAt", "NOT NULL", "Record creation timestamp"),
            ("datetime", "updatedAt", "NOT NULL", "Record last update timestamp"),
        ],
    },
]
