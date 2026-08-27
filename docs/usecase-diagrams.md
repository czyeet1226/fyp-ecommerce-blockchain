# Use Case Diagrams — Blockchain E-Commerce Platform

> **Note on Mermaid support:** Mermaid has no native `usecaseDiagram` type
> (unlike `classDiagram`, `sequenceDiagram`, or `erDiagram`). These diagrams
> are built using `flowchart` syntax as a standard workaround: actors are
> rectangles outside a system boundary, use cases are stadium-shaped nodes
> `([Text])` inside a `subgraph` boundary box, and `<<include>>`/`<<extend>>`
> relationships are dashed arrows between use cases. This is the same
> convention widely used when a tool lacks a dedicated use case renderer.

Because there's no dedicated Mermaid type, draw.io's Mermaid converter is
more likely to fall back to **Image** mode for these (same as the earlier
activity diagrams did). If a diagram renders as native shapes but drops the
system boundary title, use the Image insert option or the mermaid.live →
export SVG → drag-in method described in `activity-diagrams-drawio.md`.
Alternatively, draw.io also ships **native UML Use Case shapes** (actors,
ellipses, system boundary) in its left-hand shape library — search "UML" in
the shape search box — which you can use to redraw these manually with exact
visual UML notation if the Mermaid conversion isn't clean enough.

Each diagram is derived directly from the role-gated routes in
`backend/routes/*.routes.js` (via `requireRole`) and the corresponding
frontend pages, not a generic template.

---

## 1. Use Case Diagram — Customer

```mermaid
flowchart LR
    Customer[Customer]

    subgraph SystemLane["Blockchain E-Commerce Platform"]
        direction TB
        UC1(["Register Account"])
        UC2(["Login"])
        UC3(["Connect MetaMask Wallet"])
        UC4(["Browse Products"])
        UC5(["Manage Cart"])
        UC6(["Checkout with ETH"])
        UC7(["Checkout with Elixir"])
        UC8(["Checkout with ETH Escrow"])
        UC9(["Checkout with Elixir Escrow"])
        UC10(["Checkout with RM Ledger"])
        UC11(["Confirm Delivery"])
        UC12(["Raise Dispute"])
        UC13(["Track Order Status"])
        UC14(["View Order History"])
        UC15(["Stake Elixir"])
        UC16(["Unstake Elixir"])
        UC17(["Swap Currency"])
        UC18(["Deposit RM"])
        UC19(["Transfer Currency (P2P)"])
        UC20(["Update Profile"])
        UC21(["View NFT Receipts"])

        UCIncludeWallet(["Verify MetaMask Linked"])
        UCIncludeOnchain(["Verify On-chain Transaction"])
    end

    Customer --- UC1
    Customer --- UC2
    Customer --- UC3
    Customer --- UC4
    Customer --- UC5
    Customer --- UC6
    Customer --- UC7
    Customer --- UC8
    Customer --- UC9
    Customer --- UC10
    Customer --- UC11
    Customer --- UC12
    Customer --- UC13
    Customer --- UC14
    Customer --- UC15
    Customer --- UC16
    Customer --- UC17
    Customer --- UC18
    Customer --- UC19
    Customer --- UC20
    Customer --- UC21

    UC6 -.->|include| UCIncludeWallet
    UC7 -.->|include| UCIncludeWallet
    UC8 -.->|include| UCIncludeWallet
    UC9 -.->|include| UCIncludeWallet
    UC6 -.->|include| UCIncludeOnchain
    UC7 -.->|include| UCIncludeOnchain
    UC8 -.->|include| UCIncludeOnchain
    UC9 -.->|include| UCIncludeOnchain
    UC11 -.->|include| UCIncludeOnchain
    UC12 -.->|include| UCIncludeOnchain
    UC15 -.->|include| UCIncludeOnchain
    UC16 -.->|include| UCIncludeOnchain
    UC17 -.->|extend| UCIncludeOnchain
```

---

## 2. Use Case Diagram — Merchant (Seller)

```mermaid
flowchart LR
    Merchant[Merchant]

    subgraph SystemLane["Blockchain E-Commerce Platform"]
        direction TB
        UC1(["Login"])
        UC2(["Connect MetaMask Wallet"])
        UC3(["Create Product"])
        UC4(["Edit Product"])
        UC5(["Deactivate / Reactivate Product"])
        UC6(["View Own Product Catalog"])
        UC7(["View Purchase Orders"])
        UC8(["Update Order Fulfillment Stage"])
        UC9(["View Revenue Dashboard"])
        UC10(["Change Subscription Plan"])
        UC11(["Pay Subscription Fee"])
        UC12(["Update Profile"])
        UC13(["Receive Sale Payout"])

        UCPlanLimit(["Check Plan Product Limit"])
        UCOwnership(["Verify Product/Order Ownership"])
        UCOnchainPay(["Verify On-chain Payment"])
    end

    Merchant --- UC1
    Merchant --- UC2
    Merchant --- UC3
    Merchant --- UC4
    Merchant --- UC5
    Merchant --- UC6
    Merchant --- UC7
    Merchant --- UC8
    Merchant --- UC9
    Merchant --- UC10
    Merchant --- UC11
    Merchant --- UC12

    UC3 -.->|include| UCPlanLimit
    UC5 -.->|extend| UCPlanLimit
    UC4 -.->|include| UCOwnership
    UC5 -.->|include| UCOwnership
    UC8 -.->|include| UCOwnership
    UC11 -.->|include| UCOnchainPay
    UC13 -.->|include| UCOnchainPay

    Customer[Customer] -.->|triggers| UC13
```

---

## 3. Use Case Diagram — Admin

```mermaid
flowchart LR
    Admin[Admin]

    subgraph SystemLane["Blockchain E-Commerce Platform"]
        direction TB
        UC1(["Login"])
        UC2(["View All Users"])
        UC3(["View Platform Treasury Balance"])
        UC4(["View Platform Overview"])
        UC5(["Manage Staking Tiers"])
        UC6(["View All Staking Positions"])
        UC7(["View Subscription Revenue"])
        UC8(["View Escrow Disputes"])
        UC9(["Resolve Escrow Dispute"])
        UC10(["View Blockchain Audit Logs"])

        UCOnchainResolve(["Call resolveDispute on-chain"])
        UCRestoreStock(["Restore Product Stock"])
    end

    Admin --- UC1
    Admin --- UC2
    Admin --- UC3
    Admin --- UC4
    Admin --- UC5
    Admin --- UC6
    Admin --- UC7
    Admin --- UC8
    Admin --- UC9
    Admin --- UC10

    UC9 -.->|include| UCOnchainResolve
    UC9 -.->|extend| UCRestoreStock

    Customer[Customer] -.->|raises dispute seen by| UC8
```

---

## 4. Combined Overview — All Roles

```mermaid
flowchart LR
    Customer[Customer]
    Merchant[Merchant]
    Admin[Admin]

    subgraph SystemLane["Blockchain E-Commerce Platform"]
        direction TB
        UCAuth(["Register / Login"])
        UCWallet(["Connect MetaMask Wallet"])
        UCShop(["Browse & Purchase Products"])
        UCEscrow(["Escrow Delivery & Dispute"])
        UCStaking(["Stake / Unstake Elixir"])
        UCWalletOps(["Swap / Deposit / Transfer Currency"])
        UCCatalog(["Manage Product Catalog"])
        UCFulfillment(["Manage Order Fulfillment"])
        UCRevenue(["View Revenue / Subscription"])
        UCPlatform(["Manage Platform (Users, Tiers, Disputes)"])
        UCAudit(["View Blockchain Audit Trail"])
    end

    Customer --- UCAuth
    Customer --- UCWallet
    Customer --- UCShop
    Customer --- UCEscrow
    Customer --- UCStaking
    Customer --- UCWalletOps

    Merchant --- UCAuth
    Merchant --- UCWallet
    Merchant --- UCCatalog
    Merchant --- UCFulfillment
    Merchant --- UCRevenue

    Admin --- UCAuth
    Admin --- UCPlatform
    Admin --- UCRevenue
    Admin --- UCAudit

    UCShop -.->|include| UCWallet
    UCEscrow -.->|extend| UCShop
    UCPlatform -.->|include| UCEscrow
```

---

## Getting these into draw.io or Figma

**draw.io:**
1. Open **Arrange → Insert → Mermaid**.
2. Paste one diagram's code, starting from `flowchart LR`.
3. Click **Insert**.
4. If the system boundary title or stadium shapes look wrong, switch the
   insert option to **Image**, or use the mermaid.live → export SVG →
   drag-in method.
5. Alternatively, use draw.io's built-in **UML → Use Case** shape library
   (search "UML" in the left shape panel) to manually place actor stick
   figures, ellipses, and a system boundary rectangle with exact UML
   notation — this avoids the Mermaid conversion step entirely.

**Figma:**
Paste into [mermaid.live](https://mermaid.live), export as SVG, and drag the
file onto your Figma canvas — same approach as the other diagrams, since I
don't have a tool that draws directly onto a Figma canvas.


---

## Relationship Reference — Include / Extend (draw.io version)

This table lists every `<<include>>` and `<<extend>>` relationship in the
draw.io diagram opened directly in your editor (the one styled after your
reference image), grouped by actor cluster. "Base" is the use case that owns
the relationship arrow; "Related" is the use case it points to.

### Customer

| Base use case | Relationship | Related use case |
|---|---|---|
| Browse Products | `<<include>>` | Search / Filter Products |
| Browse Products | `<<include>>` | View Product Details |
| Manage Cart | `<<extend>>` | Add to Cart |
| Checkout | `<<include>>` | Verify MetaMask Linked |
| Checkout with ETH | `<<extend>>` | Checkout |
| Checkout with Elixir | `<<extend>>` | Checkout |
| Checkout with ETH Escrow | `<<extend>>` | Checkout |
| Checkout with Elixir Escrow | `<<extend>>` | Checkout |
| Checkout with RM | `<<extend>>` | Checkout |
| Track Order Status | `<<include>>` | View Order History |
| Confirm Delivery | `<<include>>` | Verify On-chain Transaction |
| Raise Dispute | `<<include>>` | Verify On-chain Transaction |
| Manage Elixir Wallet | `<<include>>` | Stake Elixir |
| Manage Elixir Wallet | `<<include>>` | Unstake Elixir |

**How to read the checkout relationships:** "Checkout" is the base use case that
always requires MetaMask (`<<include>>`, mandatory). Each of the five payment
modes (ETH / Elixir / ETH Escrow / Elixir Escrow / RM) is drawn as
`<<extend>>` **into** Checkout — meaning Checkout is optionally extended by
whichever single payment mode the customer picks at that moment, not all
five at once.

### Merchant

| Base use case | Relationship | Related use case |
|---|---|---|
| Manage Product Catalog | `<<include>>` | Create Product |
| Manage Product Catalog | `<<include>>` | Edit Product |
| Manage Product Catalog | `<<extend>>` | Deactivate / Reactivate Product |
| Create Product | `<<include>>` | Check Plan Product Limit |
| Manage Purchase Orders | `<<include>>` | View Purchase Orders |
| Manage Purchase Orders | `<<extend>>` | Update Fulfillment Stage |
| Manage Subscription | `<<include>>` | View Revenue Dashboard |
| Manage Subscription | `<<include>>` | Pay Subscription Fee |
| Manage Subscription | `<<extend>>` | Change Subscription Plan |

### Admin

| Base use case | Relationship | Related use case |
|---|---|---|
| Manage Staking Tiers | `<<include>>` | View All Staking Positions |
| Resolve Escrow Dispute | `<<include>>` | View Escrow Disputes |

### Cross-actor (Admin ↔ Customer)

| Base use case | Relationship | Related use case |
|---|---|---|
| Resolve Escrow Dispute (Admin) | `<<extend>>` | Raise Dispute (Customer) |

This is the one relationship that crosses actor clusters — it shows that an
admin's dispute resolution is a follow-on action extending the customer's
original "Raise Dispute" use case, mirroring how the reference diagram had
Admin/Parent use cases reaching back into the Gamer cluster.

### Quick rule of thumb used across all of the above

- **`<<include>>`** — the related use case is a **mandatory step always
  performed** as part of the base use case (e.g. Checkout always includes
  verifying MetaMask is linked).
- **`<<extend>>`** — the related use case is an **optional/conditional
  variant** that only runs in specific circumstances (e.g. only one of the
  five payment-mode use cases extends Checkout per transaction; fulfillment
  update only extends order management when the merchant chooses to advance
  a stage).
