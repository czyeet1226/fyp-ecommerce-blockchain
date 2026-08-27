# Use Case Specifications — Blockchain E-Commerce Platform

These specifications describe every use case shown in the draw.io use case
diagram (Customer / Merchant / Admin), grounded in the actual implementation:
`backend/routes/*.routes.js`, `backend/config/blockchain.js`,
`backend/models/mysql.models.js`, and the Solidity contracts
(`EcommercePayment`, `PurchaseEscrow`, `LoyaltyToken`, `PurchaseReceipt`).

Each specification uses this template:

| Field | Meaning |
|---|---|
| **ID** | Unique use case identifier |
| **Actor(s)** | Who initiates it |
| **Description** | One-line summary |
| **Preconditions** | What must be true before it starts |
| **Basic Flow** | Numbered steps of the normal/successful path |
| **Alternative Flow** | Valid variations of the basic flow |
| **Exception Flow** | Error paths and how the system responds |
| **Postconditions** | System state after successful completion |
| **Related Use Cases** | `<<include>>` / `<<extend>>` relationships |

---

# A. Customer Use Cases

## UC-C-01: Register

| Field | Detail |
|---|---|
| **ID** | UC-C-01 |
| **Actor(s)** | Customer, Merchant, Admin (shared registration form) |
| **Description** | A new user creates an account by choosing a role and submitting their details. |
| **Preconditions** | User is not logged in; user has a valid, unused email address. |
| **Basic Flow** | 1. User opens the registration page.<br>2. User enters name, email, password, and selects a role (customer/merchant/admin).<br>3. User submits the form.<br>4. System validates that name, email, and password are present.<br>5. System checks the email is not already registered.<br>6. System hashes the password with bcrypt.<br>7. System generates a new application wallet (`ethers.Wallet.createRandom()`).<br>8. System attempts to fund the new wallet with 10 test ETH from the admin wallet (best-effort; failure does not block registration).<br>9. System creates the `User` row with the generated `userCode`, hashed password, and wallet address.<br>10. If role is `customer`, system creates a matching `CustomerWallet` row with RM=0, Elixir=0, ETH=0.<br>11. System signs a JWT and returns it with the user's public profile.<br>12. Frontend stores the token and redirects the user to their role's landing page. |
| **Alternative Flow** | A1. Wallet funding fails (e.g. RPC unreachable) — registration still succeeds; the wallet simply starts with 0 ETH. |
| **Exception Flow** | E1. Missing name, email, or password → HTTP 400 "Name, email and password are required".<br>E2. Email already registered → HTTP 409 "Email already registered".<br>E3. Unexpected server/database error → HTTP 500 "Server error", transaction rolled back. |
| **Postconditions** | A new `User` row exists; a `CustomerWallet` row exists if role is customer; the user is authenticated with a JWT. |
| **Related Use Cases** | None (entry point). |

---

## UC-C-02: Login

| Field | Detail |
|---|---|
| **ID** | UC-C-02 |
| **Actor(s)** | Customer, Merchant, Admin |
| **Description** | An existing user authenticates with email and password. |
| **Preconditions** | User has a registered account. |
| **Basic Flow** | 1. User enters email and password.<br>2. System looks up the user by email.<br>3. System compares the password against the stored bcrypt hash.<br>4. System signs a JWT containing the user id and role.<br>5. System returns the token and public profile.<br>6. Frontend stores the token and redirects to the role's dashboard. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Email or password missing → HTTP 400.<br>E2. No user with that email → HTTP 401 "Invalid credentials".<br>E3. Password does not match → HTTP 401 "Invalid credentials" (same message as E2, to avoid leaking which part was wrong). |
| **Postconditions** | User session is authenticated; JWT stored client-side. |
| **Related Use Cases** | None (entry point). |

---

## UC-C-03: Connect MetaMask Wallet

| Field | Detail |
|---|---|
| **ID** | UC-C-03 |
| **Actor(s)** | Customer, Merchant |
| **Description** | The user links a MetaMask browser wallet address to their platform account so they can pay/receive ETH and Elixir on-chain. |
| **Preconditions** | User is logged in; MetaMask extension is installed. |
| **Basic Flow** | 1. User clicks "Connect MetaMask".<br>2. Frontend calls `eth_requestAccounts` via MetaMask.<br>3. User approves the connection in the MetaMask popup.<br>4. Frontend checks the active network is Sepolia; if not, it prompts a network switch.<br>5. Frontend sends the returned address to the backend (`POST /api/auth/link-metamask`).<br>6. System checks the user has no existing linked address.<br>7. System checks the address is not already linked to a different account.<br>8. System saves `metamaskAddress` on the `User` row.<br>9. System enables ETH/Elixir payment options in the UI. |
| **Alternative Flow** | A1. User already linked this exact address — system responds success without changes, UI shows "already linked". |
| **Exception Flow** | E1. MetaMask not installed → prompt to install.<br>E2. User rejects the connection popup → operation cancelled, no wallet linked.<br>E3. User's account already has a **different** linked address → HTTP 409 `ALREADY_BOUND_TO_USER`; frontend disconnects the new wallet.<br>E4. The address is already linked to **another account** → HTTP 409 `ADDRESS_IN_USE`; frontend disconnects the wallet. |
| **Postconditions** | `User.metamaskAddress` is set; on-chain payment options (ETH, Elixir, escrow, staking, swap) become available. |
| **Related Use Cases** | Included by: Checkout, Confirm Delivery, Raise Dispute, Manage Elixir Wallet, Swap Currency, Transfer Currency (all require a linked wallet first). |

---

## UC-C-04: Browse Products

| Field | Detail |
|---|---|
| **ID** | UC-C-04 |
| **Actor(s)** | Customer |
| **Description** | Customer views the public product catalog. |
| **Preconditions** | None (public endpoint; login not required to browse). |
| **Basic Flow** | 1. User opens the Shop page.<br>2. Frontend calls `GET /api/products`.<br>3. System returns active products (`isActive = true`), paginated, with merchant name/wallet info attached.<br>4. Frontend renders the product grid. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Server error while querying products → HTTP 500. |
| **Postconditions** | Product list is displayed. |
| **Related Use Cases** | `<<include>>` Search / Filter Products; `<<include>>` View Product Details. |

## UC-C-04a: Search / Filter Products

| Field | Detail |
|---|---|
| **ID** | UC-C-04a |
| **Actor(s)** | Customer |
| **Description** | Narrow the product list by category, merchant, or keyword search. |
| **Preconditions** | Customer is on the Shop page. |
| **Basic Flow** | 1. User types a search term or selects a category/merchant filter.<br>2. Frontend calls `GET /api/products?search=...&category=...&merchantId=...`.<br>3. System applies a case-insensitive `LIKE` match on product name (and exact matches on category/merchantId).<br>4. System returns the filtered, paginated result set. |
| **Alternative Flow** | None. |
| **Exception Flow** | None beyond UC-C-04's. |
| **Postconditions** | Filtered product list displayed. |
| **Related Use Cases** | Included by Browse Products. |

## UC-C-04b: View Product Details

| Field | Detail |
|---|---|
| **ID** | UC-C-04b |
| **Actor(s)** | Customer |
| **Description** | View full details of a single product. |
| **Preconditions** | Product exists. |
| **Basic Flow** | 1. User clicks a product card.<br>2. Frontend calls `GET /api/products/:id`.<br>3. System returns the product with merchant wallet/display info.<br>4. Frontend shows the detail view. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Product not found → HTTP 404. |
| **Postconditions** | Product detail view displayed. |
| **Related Use Cases** | Included by Browse Products. |

---

## UC-C-05: Manage Cart

| Field | Detail |
|---|---|
| **ID** | UC-C-05 |
| **Actor(s)** | Customer |
| **Description** | Add, update, or remove items in the pre-checkout shopping cart. |
| **Preconditions** | Customer is logged in. |
| **Basic Flow** | 1. Customer views their cart (`GET /api/cart`).<br>2. Customer adjusts a line item's quantity (`PUT /api/cart/:id`), capped at available stock.<br>3. Customer removes a single item (`DELETE /api/cart/:id`) or clears the whole cart (`DELETE /api/cart`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Requested quantity exceeds stock → quantity is capped at stock level, not rejected. |
| **Postconditions** | Cart reflects the requested changes. |
| **Related Use Cases** | `<<extend>>` Add to Cart. |

## UC-C-05a: Add to Cart

| Field | Detail |
|---|---|
| **ID** | UC-C-05a |
| **Actor(s)** | Customer |
| **Description** | Add a product to the cart, or increment its quantity if already present. |
| **Preconditions** | Customer is logged in; product is active and in stock. |
| **Basic Flow** | 1. Customer clicks "Add to Cart" on a product.<br>2. Frontend calls `POST /api/cart` with `productId` and `quantity`.<br>3. System checks for an existing cart row for this customer/product; increments it if found, otherwise creates a new row.<br>4. System enforces the quantity does not exceed available stock. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Product is inactive or out of stock → request rejected. |
| **Postconditions** | Cart row created or incremented. |
| **Related Use Cases** | Extends Manage Cart. |

---

## UC-C-06: Checkout

| Field | Detail |
|---|---|
| **ID** | UC-C-06 |
| **Actor(s)** | Customer |
| **Description** | Convert the cart (or a direct "buy now") into an order, choosing one payment mode. |
| **Preconditions** | Cart contains at least one item, or a single product is selected directly; all items in the basket belong to one merchant. |
| **Basic Flow** | 1. Customer opens Checkout.<br>2. Frontend groups cart items by seller (splits into per-seller baskets if mixed).<br>3. Customer selects a payment mode: ETH, Elixir, ETH Escrow, Elixir Escrow, or RM.<br>4. System routes to the corresponding checkout use case (UC-C-06a–e). |
| **Alternative Flow** | A1. Cart contains items from multiple sellers — system splits into separate baskets, one checkout per seller. |
| **Exception Flow** | E1. Cart is empty — checkout cannot proceed. |
| **Postconditions** | Delegated to the selected payment-mode use case. |
| **Related Use Cases** | `<<include>>` Verify MetaMask Linked (for ETH/Elixir/escrow modes only — RM does not require it). Extended by: Checkout with ETH, Checkout with Elixir, Checkout with ETH Escrow, Checkout with Elixir Escrow, Checkout with RM. |

## UC-C-06a: Checkout with ETH

| Field | Detail |
|---|---|
| **ID** | UC-C-06a |
| **Actor(s)** | Customer |
| **Description** | Pay for a single product directly in ETH via the `EcommercePayment` contract; seller is paid immediately. |
| **Preconditions** | MetaMask is linked and holds sufficient Sepolia ETH; product is in stock. |
| **Basic Flow** | 1. MetaMask calls `EcommercePayment.payWithETH(seller, productRef)` with the price as `value`.<br>2. Contract deducts a 2% platform fee, pays the seller the remainder, and issues an LYT reward to the buyer.<br>3. Contract emits `OrderCreated` and `PaymentCompleted`.<br>4. Frontend submits the resulting `txHash` to `POST /api/payment/eth`.<br>5. Backend re-reads the transaction receipt and decodes the `PaymentCompleted` event (`verifyPaymentTx`).<br>6. Backend decrements product stock.<br>7. Backend creates an `Order` row (`paymentMode = ETH_ONLY`, `status = completed`).<br>8. Backend logs `PaymentCompleted` to the MongoDB audit trail.<br>9. Backend attempts to mint an NFT purchase receipt (best-effort). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. MetaMask not linked → HTTP 400 "Connect your MetaMask wallet to pay with ETH".<br>E2. Seller has no wallet configured → HTTP 400.<br>E3. On-chain verification fails (bad/unmined txHash) → HTTP 400 with the verification error message. |
| **Postconditions** | Order recorded as completed; seller paid; buyer earns LYT reward; audit log entry written. |
| **Related Use Cases** | Extends Checkout. |

## UC-C-06b: Checkout with Elixir

| Field | Detail |
|---|---|
| **ID** | UC-C-06b |
| **Actor(s)** | Customer |
| **Description** | Pay for a single product by burning LYT (Elixir) tokens via `EcommercePayment.payWithTokens`. |
| **Preconditions** | MetaMask is linked and holds sufficient Elixir; product is in stock. |
| **Basic Flow** | 1. MetaMask calls `payWithTokens(seller, tokenAmount, productRef)`.<br>2. Contract burns the tokens from the buyer and pays the seller ETH from the contract's reserve.<br>3. Contract emits `OrderCreated` and `PaymentCompleted`.<br>4. Frontend submits `txHash` and `tokensSpent` to `POST /api/payment/token`.<br>5. Backend verifies the event, decrements stock, creates an `Order` (`paymentMode = TOKEN_ONLY`), logs to MongoDB, and attempts to mint an NFT receipt. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-C-06a (E1–E3), substituted for Elixir. |
| **Postconditions** | Order completed; seller paid in ETH from contract reserve; buyer's Elixir burned. |
| **Related Use Cases** | Extends Checkout. |

## UC-C-06c: Checkout with ETH Escrow

| Field | Detail |
|---|---|
| **ID** | UC-C-06c |
| **Actor(s)** | Customer |
| **Description** | Fund a basket purchase into `PurchaseEscrow` in ETH; the seller is paid only after the buyer confirms delivery. |
| **Preconditions** | MetaMask is linked; buyer has enough ETH for the full basket total. |
| **Basic Flow** | 1. MetaMask calls `PurchaseEscrow.createEscrow(seller, productRef)` with `value` = basket total.<br>2. Contract locks the ETH and emits `EscrowCreated`.<br>3. Frontend submits `txHash` to `POST /api/payment/escrow`.<br>4. Backend verifies the event and checks the escrowed amount covers at least 99% of the basket total.<br>5. Backend creates a multi-item `Order` (`paymentMode = ETH_ESCROW`, `escrowStatus = funded`) with one `OrderItem` per product, decrements stock, and clears the purchased items from the cart.<br>6. Backend logs `EscrowCreated` to MongoDB. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. MetaMask not linked → HTTP 400.<br>E2. Escrowed amount < 99% of total → HTTP 400 "Escrowed ETH is less than the order total".<br>E3. Event verification fails → HTTP 400. |
| **Postconditions** | Order funded in escrow, awaiting delivery confirmation; seller not yet paid. |
| **Related Use Cases** | Extends Checkout. Leads to: Confirm Delivery or Raise Dispute. |

## UC-C-06d: Checkout with Elixir Escrow

| Field | Detail |
|---|---|
| **ID** | UC-C-06d |
| **Actor(s)** | Customer |
| **Description** | Fund a basket purchase into `PurchaseEscrow` using Elixir tokens instead of ETH. |
| **Preconditions** | MetaMask is linked; buyer has approved and holds enough Elixir. |
| **Basic Flow** | 1. MetaMask approves `PurchaseEscrow` to spend the buyer's LYT.<br>2. MetaMask calls `createTokenEscrow(seller, productRef, tokenAmount)`.<br>3. Contract transfers the tokens into escrow and emits `EscrowCreated`.<br>4. Frontend submits `txHash` and `tokensSpent` to `POST /api/payment/escrow-token`.<br>5. Backend verifies the event and checks escrowed Elixir covers at least 99% of the basket total.<br>6. Backend creates the multi-item `Order` (`paymentMode = TOKEN_ESCROW`, `escrowStatus = funded`), decrements stock, clears the cart, and logs to MongoDB. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same pattern as UC-C-06c, for Elixir amounts. |
| **Postconditions** | Order funded in escrow with Elixir; seller not yet paid. |
| **Related Use Cases** | Extends Checkout. Leads to: Confirm Delivery or Raise Dispute. |

## UC-C-06e: Checkout with RM

| Field | Detail |
|---|---|
| **ID** | UC-C-06e |
| **Actor(s)** | Customer |
| **Description** | Pay for a basket using the platform's off-chain RM ledger balance; no blockchain transaction involved. |
| **Preconditions** | Customer's `CustomerWallet.RM` balance is at least the basket total. |
| **Basic Flow** | 1. Customer selects RM as payment.<br>2. Backend opens a MySQL transaction.<br>3. Backend computes the basket total in RM (using `priceMyr` or the ETH-to-RM conversion rate).<br>4. Backend checks the wallet's RM balance covers the total.<br>5. Backend deducts RM from `CustomerWallet`.<br>6. Backend creates the `Order` (`paymentMode = RM_ONLY`), records a `WalletTransaction` (`TRANSFER_OUT`), decrements stock, clears the cart, and commits the transaction. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. RM balance insufficient → HTTP 400 "Insufficient RM balance. Need RM X, have RM Y."; transaction rolled back. |
| **Postconditions** | Order completed immediately (no escrow step, no MetaMask required); RM balance reduced. |
| **Related Use Cases** | Extends Checkout. Does **not** include Verify MetaMask Linked. |

---

## UC-C-07: Track Order Status

| Field | Detail |
|---|---|
| **ID** | UC-C-07 |
| **Actor(s)** | Customer |
| **Description** | View the delivery progress and payment status of the customer's own orders. |
| **Preconditions** | Customer has placed at least one order. |
| **Basic Flow** | 1. Customer opens the Track Order page.<br>2. Frontend calls `GET /api/orders/my`.<br>3. System returns orders with their `fulfillmentStage` (0–4), `escrowStatus`, and linked product/merchant info. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Order status displayed. |
| **Related Use Cases** | `<<include>>` View Order History. |

## UC-C-07a: View Order History

| Field | Detail |
|---|---|
| **ID** | UC-C-07a |
| **Actor(s)** | Customer |
| **Description** | View past orders and wallet transaction history. |
| **Preconditions** | Customer is logged in. |
| **Basic Flow** | 1. Customer opens the History page.<br>2. Frontend calls `GET /api/orders/my` and/or the wallet transaction endpoint.<br>3. System returns the full order/transaction list, most recent first. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | History displayed. |
| **Related Use Cases** | Included by Track Order Status. |

---

## UC-C-08: Confirm Delivery

| Field | Detail |
|---|---|
| **ID** | UC-C-08 |
| **Actor(s)** | Customer |
| **Description** | Buyer confirms goods were received, releasing the escrowed funds to the seller. |
| **Preconditions** | Order has `escrowStatus = funded`; buyer is the order's customer. |
| **Basic Flow** | 1. Customer clicks "Confirm Delivery".<br>2. MetaMask calls `PurchaseEscrow.confirmDelivery(escrowId)`.<br>3. Contract pays the seller minus a 2% fee.<br>4. For ETH escrows only, contract issues an LYT reward to the buyer.<br>5. Contract mints an NFT purchase receipt to the buyer via `PurchaseReceipt`.<br>6. Contract emits `EscrowReleased`.<br>7. Frontend submits `txHash` to `POST /api/escrow/confirm`.<br>8. Backend verifies the event and updates the `Order` (`escrowStatus = released`, `fulfillmentStage = 4`, `receiptTokenId` saved).<br>9. Backend logs `EscrowReleased` to MongoDB. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Event verification fails → operation rejected, order state unchanged. |
| **Postconditions** | Escrow released; seller paid; order marked delivered; buyer holds an NFT receipt. |
| **Related Use Cases** | `<<include>>` Verify On-chain Transaction. |

---

## UC-C-09: Raise Dispute

| Field | Detail |
|---|---|
| **ID** | UC-C-09 |
| **Actor(s)** | Customer |
| **Description** | Buyer disputes a funded escrow order instead of confirming delivery, escalating it to admin review. |
| **Preconditions** | Order has `escrowStatus = funded`; buyer is the order's customer. |
| **Basic Flow** | 1. Customer clicks "Raise Dispute".<br>2. MetaMask calls `PurchaseEscrow.raiseDispute(escrowId)`.<br>3. Contract emits `EscrowDisputed`.<br>4. Frontend submits `txHash` to `POST /api/escrow/dispute`.<br>5. Backend verifies the event and updates the `Order` (`escrowStatus = disputed`).<br>6. Backend logs `EscrowDisputed` to MongoDB.<br>7. The order becomes visible in the Admin "Disputes" queue. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Event verification fails → dispute not recorded. |
| **Postconditions** | Order marked disputed; funds remain locked in escrow pending admin resolution. |
| **Related Use Cases** | `<<include>>` Verify On-chain Transaction. Extended by (from the admin side): Resolve Escrow Dispute. |

---

## UC-C-10: Manage Elixir Wallet

| Field | Detail |
|---|---|
| **ID** | UC-C-10 |
| **Actor(s)** | Customer |
| **Description** | Umbrella use case for the staking page — view positions/tiers and perform stake or unstake actions. |
| **Preconditions** | Customer is logged in. |
| **Basic Flow** | 1. Customer opens the Staking page.<br>2. Frontend calls `GET /api/staking/positions`, which returns available tiers (30/90/180/365 days) and the customer's existing positions with live compound-interest calculations. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Staking dashboard displayed. |
| **Related Use Cases** | `<<include>>` Stake Elixir; `<<include>>` Unstake Elixir. |

## UC-C-10a: Stake Elixir

| Field | Detail |
|---|---|
| **ID** | UC-C-10a |
| **Actor(s)** | Customer |
| **Description** | Lock a chosen amount of Elixir into a tier for a fixed period to earn compound interest. |
| **Preconditions** | MetaMask is linked; customer holds enough Elixir; a tier is selected. |
| **Basic Flow** | 1. Customer chooses a tier and amount.<br>2. MetaMask transfers the Elixir amount to the admin treasury address.<br>3. Frontend submits `txHash`, `amount`, and `tierDays` to `POST /api/staking/stake`.<br>4. Backend verifies the LYT transfer (`verifyLytTransfer`).<br>5. Backend creates a `StakePosition` (`maturityAt = now + tierDays`, `status = active`).<br>6. Backend records a `WalletTransaction` (`type = STAKE`).<br>7. Backend mirrors the customer's new on-chain Elixir balance into `CustomerWallet`. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. MetaMask not linked → blocked.<br>E2. Insufficient Elixir → blocked.<br>E3. Transfer verification fails → HTTP 400. |
| **Postconditions** | Active `StakePosition` created; Elixir locked until maturity. |
| **Related Use Cases** | Included by Manage Elixir Wallet. |

## UC-C-10b: Unstake Elixir

| Field | Detail |
|---|---|
| **ID** | UC-C-10b |
| **Actor(s)** | Customer |
| **Description** | Withdraw a matured stake position, receiving principal plus accrued compound interest. |
| **Preconditions** | A `StakePosition` exists with `status = active` and `maturityAt` has passed. |
| **Basic Flow** | 1. Customer clicks "Unstake" on a matured position.<br>2. Frontend calls `POST /api/staking/unstake`.<br>3. Backend computes the compound reward: `A = P(1 + r/n)^(n·t)`.<br>4. Backend (admin wallet) sends principal + reward in LYT to the customer's MetaMask address (`sendLytFromAdmin`).<br>5. Backend updates the position (`status = completed`, `rewardPaid` recorded).<br>6. Backend records a `WalletTransaction` (`type = UNSTAKE`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Maturity not yet reached → HTTP 400 "Not yet matured". |
| **Postconditions** | Position marked completed; customer receives principal + reward in Elixir. |
| **Related Use Cases** | Included by Manage Elixir Wallet. |

---

## UC-C-11: Swap Currency

| Field | Detail |
|---|---|
| **ID** | UC-C-11 |
| **Actor(s)** | Customer |
| **Description** | Convert a balance between ETH, Elixir, and RM using the platform's admin-mediated exchange. |
| **Preconditions** | Customer is logged in; MetaMask linked if the swap involves ETH or Elixir. |
| **Basic Flow** | 1. Customer chooses `fromCurrency`, `toCurrency`, and an amount.<br>2. System validates the two currencies differ and the amount is positive.<br>3. If the inbound leg is ETH or Elixir, MetaMask sends it to the admin address and the backend verifies the transaction.<br>4. If the inbound leg is RM, the backend checks the RM ledger balance.<br>5. If the outbound leg is ETH or Elixir, the admin wallet sends the converted amount to the customer.<br>6. If the outbound leg is RM, the backend credits the RM ledger.<br>7. Backend updates `CustomerWallet` mirrors and records a `WalletTransaction` (`type = SWAP`). |
| **Alternative Flow** | A1. Both legs are RM-only variants are not applicable since `fromCurrency ≠ toCurrency` is enforced; at least one leg touches a different currency. |
| **Exception Flow** | E1. Same currency selected on both sides → HTTP 400.<br>E2. On-chain leg requires MetaMask but none is linked → HTTP 400.<br>E3. Insufficient RM for an RM-based leg → HTTP 400.<br>E4. On-chain verification or payout fails → HTTP 400/500, transaction rolled back. |
| **Postconditions** | Balances updated on both sides of the swap; `WalletTransaction` recorded. |
| **Related Use Cases** | None (standalone wallet operation). |

---

## UC-C-12: Deposit RM

| Field | Detail |
|---|---|
| **ID** | UC-C-12 |
| **Actor(s)** | Customer |
| **Description** | Top up the off-chain RM ledger balance (simulated deposit, no real payment gateway). |
| **Preconditions** | Customer is logged in. |
| **Basic Flow** | 1. Customer enters a deposit amount.<br>2. Frontend calls `POST /api/payment/deposit`.<br>3. Backend validates the amount is positive.<br>4. Backend increments `CustomerWallet.RM`.<br>5. Backend records a `WalletTransaction` (`type = DEPOSIT`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Amount is zero, negative, or not a number → HTTP 400.<br>E2. Non-customer role attempts this → HTTP 403. |
| **Postconditions** | RM balance increased. |
| **Related Use Cases** | None. |

---

## UC-C-13: Transfer Currency (P2P)

| Field | Detail |
|---|---|
| **ID** | UC-C-13 |
| **Actor(s)** | Customer |
| **Description** | Send ETH, Elixir, or RM directly to another wallet/user. |
| **Preconditions** | MetaMask linked for ETH/Elixir transfers; sufficient balance in the source currency. |
| **Basic Flow** | 1. Customer enters a recipient address and amount.<br>2. For ETH/Elixir, MetaMask signs and sends the transfer on-chain; backend verifies the resulting `txHash`.<br>3. For RM, backend deducts from the sender's ledger and credits the recipient's ledger directly.<br>4. Backend records `WalletTransaction` rows for the transfer (`TRANSFER_OUT` / `TRANSFER_IN`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Insufficient balance → HTTP 400.<br>E2. On-chain verification fails → HTTP 400. |
| **Postconditions** | Balance moved from sender to recipient; transaction history updated for both parties. |
| **Related Use Cases** | None. |

---

## UC-C-14: View NFT Receipts

| Field | Detail |
|---|---|
| **ID** | UC-C-14 |
| **Actor(s)** | Customer |
| **Description** | View the ERC-721 purchase receipts minted to the customer's wallet. |
| **Preconditions** | Customer has completed at least one order that minted a receipt. |
| **Basic Flow** | 1. Customer opens the Receipts view.<br>2. Frontend calls `GET /api/escrow/receipts`.<br>3. Backend reads `PurchaseReceipt.receiptsOf(customerAddress)` on-chain and returns the list.<br>4. Customer can select one to view full details (`GET /api/escrow/receipt/:tokenId`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. No MetaMask address linked → empty result. |
| **Postconditions** | Receipt list/details displayed. |
| **Related Use Cases** | None. |

---

## UC-C-15 / UC-M-10: Update Profile

| Field | Detail |
|---|---|
| **ID** | UC-C-15 (shared with Merchant as UC-M-10, Admin as UC-A-09) |
| **Actor(s)** | Customer, Merchant, Admin |
| **Description** | Update name, email, phone, address, and optionally change password. |
| **Preconditions** | User is logged in. |
| **Basic Flow** | 1. User edits one or more profile fields.<br>2. Frontend calls `PUT /api/auth/profile`.<br>3. Backend validates the new email format (if changed) and checks it is not used by another account.<br>4. If a new password is supplied, backend verifies `currentPassword` first, then hashes and stores the new password.<br>5. Backend applies the updates and returns the updated profile. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. New email invalid or already used → HTTP 400/409.<br>E2. New password given without a correct `currentPassword` → HTTP 400/401.<br>E3. New password shorter than 6 characters → HTTP 400. |
| **Postconditions** | Profile fields updated. |
| **Related Use Cases** | None. |

---

# B. Merchant Use Cases

## UC-M-01: Manage Product Catalog

| Field | Detail |
|---|---|
| **ID** | UC-M-01 |
| **Actor(s)** | Merchant |
| **Description** | Umbrella use case for viewing and maintaining the merchant's product listings. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Merchant opens "Create Product" / catalog view.<br>2. Frontend calls `GET /api/products/mine`, returning all of the merchant's products including deactivated ones. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Catalog displayed. |
| **Related Use Cases** | `<<include>>` Create Product; `<<include>>` Edit Product; `<<extend>>` Deactivate / Reactivate Product. |

## UC-M-01a: Create Product

| Field | Detail |
|---|---|
| **ID** | UC-M-01a |
| **Actor(s)** | Merchant |
| **Description** | List a new product for sale. |
| **Preconditions** | Merchant is logged in; merchant's active product count is under their plan's limit. |
| **Basic Flow** | 1. Merchant fills in name, description, ETH/MYR price, category, stock, and image.<br>2. Frontend calls `POST /api/products`.<br>3. Backend validates name and priceEth are present.<br>4. Backend counts the merchant's current active products and checks against `plan.productLimit` (UC-M-01c).<br>5. Backend creates the `Product` row (`isActive = true`).<br>6. Product becomes visible in the public catalog. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Missing name or priceEth → HTTP 400.<br>E2. Plan limit reached → HTTP 403 `PLAN_LIMIT_REACHED`, prompting an upgrade. |
| **Postconditions** | New `Product` row created and publicly listed. |
| **Related Use Cases** | Included by Manage Product Catalog. `<<include>>` Check Plan Product Limit. |

## UC-M-01b: Edit Product

| Field | Detail |
|---|---|
| **ID** | UC-M-01b |
| **Actor(s)** | Merchant |
| **Description** | Modify an existing product's details. |
| **Preconditions** | Product exists and belongs to the logged-in merchant. |
| **Basic Flow** | 1. Merchant selects a product and edits fields.<br>2. Frontend calls `PUT /api/products/:id`.<br>3. Backend verifies `product.merchantId` matches the requester (or requester is admin).<br>4. Backend applies the updates. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Product not found → HTTP 404.<br>E2. Requester does not own the product → HTTP 403 "Not your product". |
| **Postconditions** | Product fields updated. |
| **Related Use Cases** | Included by Manage Product Catalog. |

## UC-M-01c: Check Plan Product Limit

| Field | Detail |
|---|---|
| **ID** | UC-M-01c |
| **Actor(s)** | System (invoked internally) |
| **Description** | Enforce the merchant's subscription plan's active-product cap. |
| **Preconditions** | A create or reactivate action is in progress. |
| **Basic Flow** | 1. System counts the merchant's active products.<br>2. System looks up the plan's `productLimit` via `getPlan(merchant.plan)`.<br>3. System compares the count to the limit via `canAddProduct`.<br>4. If within the limit, the calling action proceeds. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Count meets or exceeds the limit → the calling action is rejected with HTTP 403 `PLAN_LIMIT_REACHED`. |
| **Postconditions** | None (pure check). |
| **Related Use Cases** | Included by Create Product; also checked when reactivating a deactivated product. |

## UC-M-01d: Deactivate / Reactivate Product

| Field | Detail |
|---|---|
| **ID** | UC-M-01d |
| **Actor(s)** | Merchant |
| **Description** | Hide a product from the public catalog, or bring a hidden product back. |
| **Preconditions** | Product exists and belongs to the logged-in merchant. |
| **Basic Flow** | 1. Merchant clicks "Deactivate" — frontend calls `DELETE /api/products/:id`, backend sets `isActive = false` (soft delete).<br>2. To reactivate: merchant clicks "Reactivate" — frontend calls `PUT /api/products/:id` with `isActive: true`; backend re-runs the plan-limit check (UC-M-01c) before allowing it. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Reactivating would exceed the plan limit → HTTP 403 `PLAN_LIMIT_REACHED`. |
| **Postconditions** | Product's `isActive` flag toggled. |
| **Related Use Cases** | Extends Manage Product Catalog. |

---

## UC-M-02: Manage Purchase Orders

| Field | Detail |
|---|---|
| **ID** | UC-M-02 |
| **Actor(s)** | Merchant |
| **Description** | Umbrella use case for viewing incoming orders and updating delivery progress. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Merchant opens "Track Purchase Order".<br>2. Frontend calls `GET /api/orders/merchant`, returning orders where the merchant is the seller. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Order list displayed. |
| **Related Use Cases** | `<<include>>` View Purchase Orders; `<<extend>>` Update Fulfillment Stage. |

## UC-M-02a: View Purchase Orders

| Field | Detail |
|---|---|
| **ID** | UC-M-02a |
| **Actor(s)** | Merchant |
| **Description** | List all orders placed against the merchant's products, with buyer info and payment mode. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Backend queries `Order` rows where `merchantId` matches.<br>2. Backend includes buyer and product details.<br>3. Frontend renders the order table. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Orders displayed. |
| **Related Use Cases** | Included by Manage Purchase Orders. |

## UC-M-02b: Update Fulfillment Stage

| Field | Detail |
|---|---|
| **ID** | UC-M-02b |
| **Actor(s)** | Merchant |
| **Description** | Advance an order's delivery progress indicator (0 Placed → 1 Processing → 2 Packed → 3 Shipped → 4 Delivered). |
| **Preconditions** | Order exists and belongs to the merchant. |
| **Basic Flow** | 1. Merchant selects a new stage for an order.<br>2. Frontend calls `PUT /api/orders/:id/fulfillment`.<br>3. Backend verifies ownership.<br>4. Backend updates `Order.fulfillmentStage`. |
| **Alternative Flow** | A1. If the order uses escrow, the seller's actual payout still depends on the buyer's separate delivery confirmation (UC-C-08) — updating the stage here is informational tracking only, not a payout trigger. |
| **Exception Flow** | E1. Merchant does not own the order → HTTP 403 "Not your order". |
| **Postconditions** | `fulfillmentStage` updated. |
| **Related Use Cases** | Extends Manage Purchase Orders. |

---

## UC-M-03: Manage Subscription

| Field | Detail |
|---|---|
| **ID** | UC-M-03 |
| **Actor(s)** | Merchant |
| **Description** | Umbrella use case for viewing plan usage/revenue and changing or paying for the subscription plan. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Merchant opens the "Payments" tab.<br>2. Frontend calls `GET /api/subscription/me`, returning current plan, pending plan, product usage, and renewal date. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Subscription dashboard displayed. |
| **Related Use Cases** | `<<include>>` View Revenue Dashboard; `<<include>>` Pay Subscription Fee; `<<extend>>` Change Subscription Plan. |

## UC-M-03a: View Revenue Dashboard

| Field | Detail |
|---|---|
| **ID** | UC-M-03a |
| **Actor(s)** | Merchant |
| **Description** | View total sales revenue, order counts, and per-product performance. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Frontend calls `GET /api/orders/merchant/revenue`.<br>2. Backend aggregates the merchant's completed orders: total ETH revenue, unit counts, fulfillment-stage breakdown, and per-product statistics.<br>3. Frontend renders charts/tables. |
| **Alternative Flow** | None. |
| **Exception Flow** | None. |
| **Postconditions** | Revenue figures displayed. |
| **Related Use Cases** | Included by Manage Subscription. |

## UC-M-03b: Change Subscription Plan

| Field | Detail |
|---|---|
| **ID** | UC-M-03b |
| **Actor(s)** | Merchant |
| **Description** | Queue a change to a different plan tier (starter/pro/enterprise), effective at the next billing cycle. |
| **Preconditions** | Merchant is logged in. |
| **Basic Flow** | 1. Merchant selects a different plan tile.<br>2. Frontend calls `POST /api/subscription/change`.<br>3. Backend sets `pendingPlan` on the `User` row. |
| **Alternative Flow** | A1. Merchant selects the currently active plan again — this cancels any previously queued `pendingPlan`. |
| **Exception Flow** | None. |
| **Postconditions** | `pendingPlan` set (or cleared); takes effect on the next successful payment. |
| **Related Use Cases** | Extends Manage Subscription. |

## UC-M-03c: Pay Subscription Fee

| Field | Detail |
|---|---|
| **ID** | UC-M-03c |
| **Actor(s)** | Merchant |
| **Description** | Pay the monthly subscription fee in ETH, applying any queued plan change and extending the renewal date. |
| **Preconditions** | Merchant is logged in; MetaMask linked with sufficient ETH. |
| **Basic Flow** | 1. Merchant clicks "Pay Subscription".<br>2. MetaMask sends ETH to the platform admin address.<br>3. Frontend submits `txHash` to `POST /api/subscription/pay`.<br>4. Backend verifies the incoming ETH amount matches the effective plan's price (`verifyIncomingEth`).<br>5. Backend applies `pendingPlan` as the active plan (if one was queued).<br>6. Backend extends `planRenewsAt` by 30 days.<br>7. Backend records a `SubscriptionPayment` (`status = completed`). |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Payment amount does not match the plan price → HTTP 400 "Incorrect amount". |
| **Postconditions** | Plan active; renewal date extended; payment recorded for admin revenue reporting. |
| **Related Use Cases** | Included by Manage Subscription. |

---

# C. Admin Use Cases

## UC-A-01: View All Users

| Field | Detail |
|---|---|
| **ID** | UC-A-01 |
| **Actor(s)** | Admin |
| **Description** | Browse and search every registered account with their wallet balances. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Admin opens the "Users" tab.<br>2. Frontend calls `GET /api/admin/users` (optionally with a search term).<br>3. Backend returns all users with their `CustomerWallet` balances. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. Non-admin attempts access → HTTP 403 (enforced globally by `requireRole("admin")` on the admin router). |
| **Postconditions** | User list displayed. |
| **Related Use Cases** | None. |

## UC-A-02: View Platform Overview

| Field | Detail |
|---|---|
| **ID** | UC-A-02 |
| **Actor(s)** | Admin |
| **Description** | View aggregate counts of users by role. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Frontend calls `GET /api/admin/overview`.<br>2. Backend returns counts grouped by role (customer/merchant/admin) and a total. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Overview stats displayed. |
| **Related Use Cases** | None. |

## UC-A-03: View Platform Treasury Balance

| Field | Detail |
|---|---|
| **ID** | UC-A-03 |
| **Actor(s)** | Admin |
| **Description** | Monitor the platform admin wallet's live on-chain ETH and Elixir balances. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Frontend polls `GET /api/admin/balance` every 15 seconds.<br>2. Backend reads the admin wallet's on-chain ETH balance and LYT balance.<br>3. Frontend displays both figures in the sidebar. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Treasury balances displayed and kept current. |
| **Related Use Cases** | None. |

## UC-A-04: Manage Staking Tiers

| Field | Detail |
|---|---|
| **ID** | UC-A-04 |
| **Actor(s)** | Admin |
| **Description** | View and edit the APY offered for each staking lock-up period. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Admin opens the "Staking" tab.<br>2. Frontend calls `GET /api/admin/staking/tiers`, returning the 30/90/180/365-day tiers.<br>3. Admin edits a tier's APY.<br>4. Frontend calls `PUT /api/admin/staking/tiers/:days`.<br>5. Backend updates the `StakingTier` row. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Tier APY updated; applies to future stakes (existing positions keep their locked-in APY). |
| **Related Use Cases** | `<<include>>` View All Staking Positions. |

## UC-A-04a: View All Staking Positions

| Field | Detail |
|---|---|
| **ID** | UC-A-04a |
| **Actor(s)** | Admin |
| **Description** | View every customer's staking positions across the platform, with a summary. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Frontend calls `GET /api/admin/staking/positions`.<br>2. Backend returns all `StakePosition` rows joined with the owning user, plus aggregate totals. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Positions list displayed. |
| **Related Use Cases** | Included by Manage Staking Tiers. |

## UC-A-05: View Escrow Disputes

| Field | Detail |
|---|---|
| **ID** | UC-A-05 |
| **Actor(s)** | Admin |
| **Description** | View all orders currently flagged as disputed. |
| **Preconditions** | At least one order has `escrowStatus = disputed`. |
| **Basic Flow** | 1. Admin opens the "Disputes" tab.<br>2. Frontend calls `GET /api/admin/escrow/disputes`.<br>3. Backend returns orders where `escrowStatus = disputed`. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Dispute queue displayed. |
| **Related Use Cases** | `<<include>>`d by Resolve Escrow Dispute. |

## UC-A-06: Resolve Escrow Dispute

| Field | Detail |
|---|---|
| **ID** | UC-A-06 |
| **Actor(s)** | Admin |
| **Description** | Adjudicate a disputed escrow order, either refunding the buyer or releasing funds to the seller. |
| **Preconditions** | Order has `escrowStatus = disputed`. |
| **Basic Flow** | 1. Admin reviews the dispute details.<br>2. Admin chooses "Refund Buyer" or "Release to Seller".<br>3. Frontend calls `POST /api/admin/escrow/resolve` with `escrowId` and `refundBuyer`.<br>4. Backend (admin wallet) calls `PurchaseEscrow.resolveDispute(escrowId, refundBuyer)` on-chain.<br>5a. If refunding: contract returns funds to the buyer; backend sets `Order.status = cancelled` and restores product stock; backend logs `EscrowRefunded`.<br>5b. If releasing: contract pays the seller; backend sets `escrowStatus = released`, `fulfillmentStage = 4`; backend logs `EscrowReleased`. |
| **Alternative Flow** | None. |
| **Exception Flow** | E1. On-chain call fails (e.g. admin wallet not the contract owner, insufficient gas) → HTTP 500, order state unchanged. |
| **Postconditions** | Dispute resolved; order reaches a terminal state (`cancelled` or `released`). |
| **Related Use Cases** | `<<include>>` View Escrow Disputes. `<<extend>>` Raise Dispute (this use case is the admin-side continuation of the customer's dispute). |

## UC-A-07: View Subscription Revenue

| Field | Detail |
|---|---|
| **ID** | UC-A-07 |
| **Actor(s)** | Admin |
| **Description** | View all merchant subscription payments and revenue breakdowns by plan/month. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Admin opens the "Revenue" tab.<br>2. Frontend calls `GET /api/admin/revenue`.<br>3. Backend returns all `SubscriptionPayment` rows plus monthly/plan aggregates. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Revenue report displayed. |
| **Related Use Cases** | None. |

## UC-A-08: View Blockchain Audit Log

| Field | Detail |
|---|---|
| **ID** | UC-A-08 |
| **Actor(s)** | Admin |
| **Description** | Inspect the append-only MongoDB mirror of on-chain events for auditing/debugging. |
| **Preconditions** | Admin is logged in. |
| **Basic Flow** | 1. Admin opens the audit log view.<br>2. Frontend calls `GET /api/orders/blockchain/logs` (optionally filtered by `eventType` or address).<br>3. Backend queries `BlockchainLog` and returns paginated results, most recent first. |
| **Alternative Flow** | None. |
| **Exception Flow** | Same as UC-A-01, E1. |
| **Postconditions** | Audit trail displayed. |
| **Related Use Cases** | None. |

---

## Summary Table — Include / Extend Cross-Reference

| Relationship type | Count | Notes |
|---|---|---|
| `<<include>>` | 20 | Mandatory sub-steps always performed as part of the base use case. |
| `<<extend>>` | 8 | Optional/conditional variants that only occur under specific conditions (e.g. one of five payment modes, or a merchant choosing to reactivate rather than just deactivate). |
| Cross-actor | 1 | Resolve Escrow Dispute (Admin) `<<extend>>` Raise Dispute (Customer) — the only relationship spanning two different actors' use case clusters. |

This mirrors the relationship table already documented in
`usecase-diagrams.md`; this file adds the full pre/post-condition and flow
detail behind each of those relationships.
