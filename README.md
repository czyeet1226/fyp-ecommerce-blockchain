# Blockchain-Integrated E-Commerce Platform

**FYP: Chan Zean Yeet | TP070394 | APD3F2601**
**Supervisor: Dr. Kuruvikulam**

---

## Project Overview

A blockchain-integrated e-commerce platform for SMEs with:
- **Hybrid payment system** — pay with ETH, LYT tokens, or both in one transaction
- **Token loyalty reward** — automatically earn LYT tokens on every purchase (no expiry)
- **Dual database architecture** — centralised MySQL + decentralised MongoDB
- **Hardhat simulated blockchain** — Solidity smart contracts on a local Ethereum node

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React.js Frontend                     │
│         (Product listing, Checkout, Wallet)             │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (axios)
┌────────────────────────▼────────────────────────────────┐
│               Node.js / Express Backend                 │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  CENTRALISED DB     │  │  DECENTRALISED DB        │  │
│  │  MySQL (Sequelize)  │  │  MongoDB (Mongoose)      │  │
│  │                     │  │                          │  │
│  │  • users            │  │  • blockchainlogs        │  │
│  │  • products         │  │    (on-chain event       │  │
│  │  • orders (meta)    │  │     mirror / audit trail)│  │
│  │  • carts            │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │       Blockchain Service (ethers.js v6)          │   │
│  └────────────────────────┬─────────────────────────┘   │
└───────────────────────────│─────────────────────────────┘
                            │ JSON-RPC
┌───────────────────────────▼─────────────────────────────┐
│                  Hardhat Local Node                     │
│              (20 simulated accounts)                    │
│                                                         │
│  ┌──────────────────────┐  ┌────────────────────────┐   │
│  │   LoyaltyToken.sol   │  │ EcommercePayment.sol   │   │
│  │   ERC-20 (LYT)       │  │                        │   │
│  │                      │  │  • payWithETH()        │   │
│  │  • issueTokens()     │  │  • payWithTokens()     │   │
│  │  • redeemTokens()    │  │  • payHybrid()         │   │
│  │  • getBalance()      │  │  • Seller transfer     │   │
│  └──────────────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ecommerce-blockchain/
├── contracts/
│   ├── LoyaltyToken.sol          ← ERC-20 loyalty token (LYT)
│   └── EcommercePayment.sol      ← Payment + seller transfer smart contract
│
├── scripts/
│   └── deploy.js                 ← Hardhat deployment script
│
├── test/
│   └── EcommercePayment.test.js  ← Mocha/Chai unit tests
│
├── backend/
│   ├── server.js                 ← Express entry point
│   ├── config/
│   │   ├── database.js           ← MySQL + MongoDB connections
│   │   └── blockchain.js         ← ethers.js blockchain service
│   ├── models/
│   │   ├── mysql.models.js       ← User, Product, Order, Cart (MySQL)
│   │   └── blockchainLog.model.js← Blockchain audit trail (MongoDB)
│   ├── middleware/
│   │   └── auth.js               ← JWT authentication
│   └── routes/
│       ├── auth.routes.js        ← Register / Login
│       ├── product.routes.js     ← Product CRUD
│       ├── payment.routes.js     ← ETH / Token / Hybrid payment
│       └── order.routes.js       ← Order history + blockchain logs
│
├── frontend/
│   └── src/
│       ├── context/AuthContext.jsx ← Global auth state
│       └── pages/Checkout.jsx      ← Hybrid payment UI
│
├── hardhat.config.js
└── package.json
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MySQL running locally
- MongoDB running locally

### 1 — Install dependencies

```bash
# Root (Hardhat + contracts)
npm install

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2 — Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set MySQL password, MongoDB URI, JWT secret
```

### 3 — Start the Hardhat blockchain node (Terminal 1)

```bash
npm run chain
# Starts local Ethereum node at http://127.0.0.1:8545
# Prints 20 test accounts with 10,000 ETH each
```

### 4 — Compile and deploy smart contracts (Terminal 2)

```bash
npm run compile    # compile Solidity → artifacts/
npm run deploy     # deploy to localhost, writes deployedAddresses.json
```

### 5 — Start the backend (Terminal 3)

```bash
npm run backend
# API running at http://localhost:5000
```

### 6 — Start the frontend (Terminal 4)

```bash
npm run frontend
# React app at http://localhost:3000
```

### 7 — Run tests

```bash
npm test
```

---

## Smart Contract Summary

### LoyaltyToken.sol (ERC-20 LYT)

| Function | Description |
|---|---|
| `issueTokensForPurchase(customer, ethAmount)` | Mint LYT tokens after purchase (1000 LYT per 1 ETH) |
| `issueTokensManual(customer, amount, reason)` | Admin: issue bonus tokens |
| `redeemTokens(customer, amount)` | Burn tokens when used as payment |
| `getTokenBalance(account)` | View LYT balance (whole units) |
| `previewTokenReward(ethAmount)` | Preview how many tokens a purchase earns |

### EcommercePayment.sol

| Function | Description |
|---|---|
| `payWithETH(seller, productRef)` | Pay 100% ETH → seller gets ETH minus 2% fee, buyer earns LYT |
| `payWithTokens(seller, tokenAmount, productRef)` | Burn LYT tokens, seller paid in ETH from reserve |
| `payHybrid(seller, totalPrice, tokenAmount, productRef)` | Mix ETH + LYT in one transaction |
| `previewHybridCost(totalPrice, tokenAmount)` | Preview ETH required after token deduction |
| `getOrder(orderId)` | Fetch full on-chain order record |
| `getBuyerOrders(address)` | All order IDs for a buyer |
| `getSellerOrders(address)` | All order IDs for a seller |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register customer or merchant |
| POST | `/api/auth/login` | Login, receive JWT |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Single product |
| POST | `/api/products` | Create product (merchant) |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Deactivate product |

### Payment
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payment/eth` | Pay with ETH |
| POST | `/api/payment/token` | Pay with LYT tokens |
| POST | `/api/payment/hybrid` | Hybrid payment |
| GET | `/api/payment/preview` | Preview hybrid cost |
| GET | `/api/payment/wallet` | Wallet balances |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/orders/my` | Customer's order history |
| GET | `/api/orders/merchant` | Merchant's sales |
| GET | `/api/orders/:id` | Order detail + blockchain log |
| GET | `/api/orders/blockchain/logs` | Full audit trail (admin) |

---

## Database Design

### Centralised (MySQL)

- **users** — authentication, wallet address, role
- **products** — merchant listings, price in ETH, stock
- **orders** — metadata linking on-chain orderId to MySQL records
- **carts** — temporary cart items

### Decentralised (MongoDB)

- **blockchainlogs** — append-only mirror of smart contract events
  - Never updated, only inserted (mirrors blockchain immutability)
  - Indexed by buyer/seller address, event type, timestamp

---

## Token Economy

- **Earn**: 1000 LYT per 1 ETH spent
- **Redeem**: 1 LYT = 0.001 ETH
- **No expiry**: tokens held in wallet forever
- **No central authority**: all minting/burning automated by smart contract

---

*SDG Goal 9: Build resilient infrastructure, promote inclusive and sustainable industrialization, and foster innovation*
