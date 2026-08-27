# UML Diagrams — Blockchain E-Commerce Platform

These diagrams are generated directly from the actual codebase (Sequelize models,
Mongoose model, Express routes, and Solidity contracts), not a generic template.
They are written in [Mermaid](https://mermaid.js.org/) syntax so you can:

1. Preview them instantly in GitHub, VS Code (Markdown Preview Mermaid Support
   extension), or [mermaid.live](https://mermaid.live).
2. Import them into Figma as real, editable shapes using a plugin — see
   **"Getting these into Figma"** at the bottom of this file.

> Note on roles: this app does not use table-per-role inheritance. There is a
> single `users` table with a `role` ENUM(`customer`, `merchant`, `admin`).
> The three class diagrams below each show the **same `User` class** filtered
> to the fields/associations that matter for that role, plus the domain
> classes and smart contracts that role actually interacts with.

---

## 1. Class Diagram — Customer Role

```mermaid
classDiagram
    class User {
        +UUID id
        +string userCode
        +string name
        +string email
        +string passwordHash
        +role: "customer"
        +string walletAddress
        +string metamaskAddress
        +boolean isActive
        +register()
        +login()
        +linkMetamask(address)
        +updateProfile(updates)
    }

    class CustomerWallet {
        +UUID id
        +string userCode
        +decimal RM
        +decimal Elixir
        +decimal ETH
        +boolean hideBalance
        +string walletAddress
    }

    class Cart {
        +UUID id
        +UUID customerId
        +UUID productId
        +int quantity
        +addItem()
        +updateQuantity()
        +removeItem()
    }

    class Product {
        +UUID id
        +UUID merchantId
        +string name
        +decimal priceEth
        +decimal priceMyr
        +string category
        +int stock
        +boolean isActive
    }

    class Order {
        +UUID id
        +BIGINT onChainOrderId
        +UUID customerId
        +UUID merchantId
        +decimal totalPriceEth
        +paymentMode: ETH_ONLY|TOKEN_ONLY|HYBRID|RM_ONLY|ETH_ESCROW|TOKEN_ESCROW
        +decimal ethPaid
        +BIGINT tokensPaid
        +BIGINT tokensEarned
        +string txHash
        +status: pending|completed|cancelled
        +int fulfillmentStage
        +BIGINT escrowId
        +escrowStatus: none|funded|released|refunded|disputed
        +boolean deliveryConfirmed
        +BIGINT receiptTokenId
        +confirmDelivery()
        +raiseDispute()
    }

    class OrderItem {
        +UUID id
        +UUID orderId
        +UUID productId
        +string productName
        +int quantity
        +decimal unitPriceEth
    }

    class WalletTransaction {
        +UUID id
        +string userCode
        +type: SWAP|TRANSFER_OUT|TRANSFER_IN|DEPOSIT|STAKE|UNSTAKE
        +fromCurrency: ETH|ELIXIR|RM
        +toCurrency: ETH|ELIXIR|RM
        +decimal fromAmount
        +decimal toAmount
        +string txHash
        +status: pending|completed|failed
    }

    class StakePosition {
        +UUID id
        +string userCode
        +decimal amount
        +int tierDays
        +decimal apy
        +int compoundFrequency
        +datetime stakedAt
        +datetime maturityAt
        +decimal rewardPaid
        +status: active|completed
    }

    class LoyaltyToken_Contract {
        <<Smart Contract>>
        +string symbol = "LYT"
        +getTokenBalance(address)
        +transfer(to, amount)
        +previewTokenReward(ethAmount)
    }

    class EcommercePayment_Contract {
        <<Smart Contract>>
        +payWithETH(seller, productRef) payable
        +payWithTokens(seller, tokenAmount, productRef)
        +payHybrid(seller, totalPriceWei, tokenAmount, productRef) payable
        +getBuyerOrders(address)
    }

    class PurchaseEscrow_Contract {
        <<Smart Contract>>
        +createEscrow(seller, productRef) payable
        +createTokenEscrow(seller, productRef, tokenAmount)
        +confirmDelivery(escrowId)
        +raiseDispute(escrowId)
        +getBuyerEscrows(address)
    }

    class PurchaseReceipt_Contract {
        <<Smart Contract, ERC-721>>
        +symbol = "ELXR"
        +receiptsOf(owner)
        +getReceipt(tokenId)
    }

    User "1" --> "1" CustomerWallet : owns
    User "1" --> "*" Cart : has
    User "1" --> "*" Order : places (as buyer)
    Cart "*" --> "1" Product : references
    Order "*" --> "1" Product : primary item (nullable)
    Order "1" --> "*" OrderItem : basket line items
    OrderItem "*" --> "1" Product : references
    User "1" --> "*" WalletTransaction : logs
    User "1" --> "*" StakePosition : stakes
    User ..> LoyaltyToken_Contract : reads balance / stakes Elixir
    User ..> EcommercePayment_Contract : pays ETH_ONLY / TOKEN_ONLY / HYBRID
    User ..> PurchaseEscrow_Contract : funds escrow / confirms / disputes
    User ..> PurchaseReceipt_Contract : owns NFT receipts
```

---

## 2. Class Diagram — Merchant (Seller) Role

```mermaid
classDiagram
    class User {
        +UUID id
        +string userCode
        +string name
        +string email
        +role: "merchant"
        +string walletAddress
        +string metamaskAddress
        +plan: starter|pro|enterprise
        +plan pendingPlan
        +datetime planRenewsAt
        +register()
        +login()
        +linkMetamask(address)
    }

    class Product {
        +UUID id
        +UUID merchantId
        +string name
        +string description
        +decimal priceEth
        +decimal priceMyr
        +string category
        +int stock
        +string imageUrl
        +boolean isActive
        +create()
        +update()
        +deactivate()
    }

    class Order {
        +UUID id
        +UUID customerId
        +UUID merchantId
        +decimal totalPriceEth
        +paymentMode
        +status: pending|completed|cancelled
        +int fulfillmentStage
        +escrowStatus
        +advanceFulfillment(stage)
    }

    class OrderItem {
        +UUID id
        +UUID orderId
        +UUID productId
        +UUID merchantId
        +string productName
        +int quantity
        +decimal unitPriceEth
    }

    class SubscriptionPayment {
        +UUID id
        +UUID sellerId
        +string sellerCode
        +plan: starter|pro|enterprise
        +decimal amountEth
        +string txHash
        +datetime periodStart
        +datetime periodEnd
        +status: completed|failed
    }

    class SellerPlanConfig {
        <<Config>>
        +string label
        +int productLimit
        +decimal priceEth
        +canAddProduct(plan, activeCount)
    }

    class EcommercePayment_Contract {
        <<Smart Contract>>
        +receives ETH/LYT payouts as seller
    }

    class PurchaseEscrow_Contract {
        <<Smart Contract>>
        +getSellerEscrows(address)
        +receives payout on confirmDelivery()
    }

    User "1" --> "*" Product : lists (merchantId)
    User "1" --> "*" Order : receives (as seller)
    User "1" --> "*" SubscriptionPayment : pays
    User ..> SellerPlanConfig : constrained by plan.productLimit
    Order "1" --> "*" OrderItem : basket line items
    OrderItem "*" --> "1" Product : references
    User ..> EcommercePayment_Contract : paid out on direct sale
    User ..> PurchaseEscrow_Contract : paid out on delivery confirmation
```

---

## 3. Class Diagram — Admin Role

```mermaid
classDiagram
    class User {
        +UUID id
        +string userCode
        +string name
        +string email
        +role: "admin"
        +string walletAddress
        +getAllUsers()
        +getPlatformBalance()
    }

    class StakingTier {
        +UUID id
        +int days
        +decimal apy
        +string label
        +int sortOrder
        +updateApy(days, apy)
    }

    class StakePosition {
        +UUID id
        +string userCode
        +decimal amount
        +int tierDays
        +decimal apy
        +status: active|completed
    }

    class SubscriptionPayment {
        +UUID id
        +UUID sellerId
        +plan
        +decimal amountEth
        +datetime periodStart
        +datetime periodEnd
    }

    class Order {
        +UUID id
        +escrowStatus: none|funded|released|refunded|disputed
        +BIGINT escrowId
        +resolveDispute(refundBuyer)
    }

    class BlockchainLog {
        <<MongoDB Document>>
        +eventType: PaymentCompleted|TokensIssued|TokensRedeemed|OrderCreated|EscrowCreated|EscrowReleased|EscrowDisputed|EscrowRefunded|ReceiptMinted
        +string orderId
        +string buyerAddress
        +string sellerAddress
        +string txHash
        +int blockNumber
        +datetime createdAt
    }

    class PurchaseEscrow_Contract {
        <<Smart Contract>>
        +resolveDispute(escrowId, refundBuyer) onlyOwner
    }

    class LoyaltyToken_Contract {
        <<Smart Contract>>
        +owns treasury balance
    }

    User "1" --> "*" StakingTier : configures
    User "1" ..> StakePosition : oversees all
    User "1" ..> SubscriptionPayment : oversees revenue
    User "1" --> "*" Order : resolves disputes
    User "1" ..> BlockchainLog : audits
    User ..> PurchaseEscrow_Contract : calls resolveDispute() as owner
    User ..> LoyaltyToken_Contract : controls platform treasury
```

---

## 4. Activity Diagram — Registration & Login

```mermaid
graph TD
    subgraph UserLane[User]
        direction TB
        UStart([Start])
        UChoose{New or existing user?}
        URegister[Fill registration form]
        UShowValidation[Show validation error]
        UShowEmailError[Show email already registered]
        ULogin[Enter email and password]
        UShowCredentials[Show invalid credentials]
        UDashboard[Open dashboard or shop]
        UEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SRegister[POST register]
        SValidate{Required fields valid?}
        SCheckEmail{Email already registered?}
        SHash[Hash password]
        SWallet[Generate application wallet]
        SFund[Admin funds wallet with test ETH]
        SUser[Create User row]
        SCustomer{Role is customer?}
        SWalletRow[Create CustomerWallet row]
        SRegisterToken[Create JWT]
        SLogin[POST login]
        SFind{User found?}
        SCompare{Password matches?}
        SLoginToken[Create JWT]
    end

    UStart --> UChoose
    UChoose -->|New| URegister
    URegister --> SRegister
    SRegister --> SValidate
    SValidate -->|No| UShowValidation
    UShowValidation --> URegister
    SValidate -->|Yes| SCheckEmail
    SCheckEmail -->|Yes| UShowEmailError
    UShowEmailError --> URegister
    SCheckEmail -->|No| SHash
    SHash --> SWallet
    SWallet --> SFund
    SFund --> SUser
    SUser --> SCustomer
    SCustomer -->|Yes| SWalletRow
    SCustomer -->|No| SRegisterToken
    SWalletRow --> SRegisterToken
    SRegisterToken --> UDashboard

    UChoose -->|Existing| ULogin
    ULogin --> SLogin
    SLogin --> SFind
    SFind -->|No| UShowCredentials
    UShowCredentials --> ULogin
    SFind -->|Yes| SCompare
    SCompare -->|No| UShowCredentials
    SCompare -->|Yes| SLoginToken
    SLoginToken --> UDashboard
    UDashboard --> UEnd
```

---

## 5. Activity Diagram — Connect & Link MetaMask

```mermaid
graph TD
    subgraph CustomerLane[Customer]
        direction TB
        CStart([Start])
        CClick[Click Connect MetaMask]
        CInstall[Install MetaMask]
        CApprove{Approve connection?}
        CSwitch[Switch to Sepolia]
        CAddress[Receive wallet address]
        CLinked[Show wallet linked]
        CReject[Show wallet linking error]
        CEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SDetect{MetaMask detected?}
        SRequest[Request account access]
        SNetwork{Network is Sepolia?}
        SLink[POST link-metamask]
        SExisting{Account already has wallet?}
        SUsed{Address used by another account?}
        SSave[Save metamaskAddress in User row]
        SEnable[Enable ETH and Elixir payments]
    end

    CStart --> CClick
    CClick --> SDetect
    SDetect -->|No| CInstall
    CInstall --> CEnd
    SDetect -->|Yes| SRequest
    SRequest --> CApprove
    CApprove -->|No| CEnd
    CApprove -->|Yes| SNetwork
    SNetwork -->|No| CSwitch
    CSwitch --> SNetwork
    SNetwork -->|Yes| CAddress
    CAddress --> SLink
    SLink --> SExisting
    SExisting -->|Same address| CLinked
    SExisting -->|Different address| CReject
    SExisting -->|No wallet| SUsed
    SUsed -->|Yes| CReject
    SUsed -->|No| SSave
    SSave --> SEnable
    SEnable --> CLinked
    CLinked --> CEnd
    CReject --> CEnd
```

---

## 6. Activity Diagram — Browse & Checkout (all payment modes)

```mermaid
graph TD
    subgraph CustomerLane[Customer]
        direction TB
        CStart([Start])
        CBrowse[Browse products]
        CCart[Add product to cart]
        CCheckout[Open checkout]
        CMode{Choose payment mode}
        CConnect[Connect MetaMask]
        CSignEth[Sign ETH payment]
        CSignToken[Approve and sign Elixir payment]
        CSignEscrow[Sign ETH escrow payment]
        CSignTokenEscrow[Approve and sign Elixir escrow]
        CEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SProducts[GET products]
        SCart[POST cart item]
        SLoad[Load basket]
        SWallet{MetaMask linked?}
        SEth[Verify ETH transaction]
        STok[Verify Elixir transaction]
        SEscrow[Verify ETH escrow]
        STokEscrow[Verify Elixir escrow]
        SAmount{Amount sufficient?}
        SRm{RM balance sufficient?}
        SRmPay[Deduct RM ledger balance]
        SOrder[Create Order and OrderItems]
        SStock[Decrease stock and clear cart]
        SLog[Write blockchain audit log]
    end

    subgraph BlockchainLane[Blockchain]
        direction TB
        BEth[EcommercePayment payWithETH]
        BToken[EcommercePayment payWithTokens]
        BEscrow[PurchaseEscrow createEscrow]
        BTokenEscrow[PurchaseEscrow createTokenEscrow]
    end

    CStart --> CBrowse
    CBrowse --> SProducts
    SProducts --> CCart
    CCart --> SCart
    SCart --> CCheckout
    CCheckout --> SLoad
    SLoad --> CMode

    CMode -->|ETH| SWallet
    CMode -->|Elixir| SWallet
    CMode -->|ETH escrow| SWallet
    CMode -->|Elixir escrow| SWallet
    CMode -->|RM| SRm
    SWallet -->|No| CConnect
    CConnect --> CMode
    SWallet -->|Yes ETH| CSignEth
    CSignEth --> BEth
    BEth --> SEth
    SEth --> SOrder
    SWallet -->|Yes Elixir| CSignToken
    CSignToken --> BToken
    BToken --> STok
    STok --> SOrder
    SWallet -->|Yes ETH escrow| CSignEscrow
    CSignEscrow --> BEscrow
    BEscrow --> SEscrow
    SEscrow --> SAmount
    SWallet -->|Yes Elixir escrow| CSignTokenEscrow
    CSignTokenEscrow --> BTokenEscrow
    BTokenEscrow --> STokEscrow
    STokEscrow --> SAmount
    SAmount -->|Yes| SOrder
    SAmount -->|No| CEnd
    SRm -->|Yes| SRmPay
    SRm -->|No| CEnd
    SRmPay --> SOrder
    SOrder --> SStock
    SStock --> SLog
    SLog --> CEnd
```

---

## 7. Activity Diagram — Escrow Confirmation, Dispute & Admin Resolution

```mermaid
graph TD
    subgraph CustomerLane[Customer]
        direction TB
        CStart([Funded escrow])
        CDecision{Confirm delivery or dispute?}
        CConfirm[Sign confirm delivery]
        CDispute[Sign raise dispute]
        CEnd([End])
    end

    subgraph MerchantLane[Merchant]
        direction TB
        MShip[Ship order and update fulfillment stage]
        MWait[Wait for buyer decision]
        MPaid[Receive seller payout]
    end

    subgraph SystemLane[System]
        direction TB
        SConfirm[POST escrow confirm]
        SDispute[POST escrow dispute]
        SVerifyRelease[Verify EscrowReleased event]
        SVerifyDispute[Verify EscrowDisputed event]
        SReleased[Update order as released]
        SDisputed[Mark order as disputed]
        SAdminQueue[Show dispute in admin queue]
        SResolve[POST admin escrow resolve]
        SRefund[Cancel order and restore stock]
    end

    subgraph AdminLane[Admin]
        direction TB
        AReview[Review dispute]
        ADecision{Refund buyer or release seller?}
    end

    subgraph BlockchainLane[Blockchain]
        direction TB
        BConfirm[PurchaseEscrow confirmDelivery]
        BDispute[PurchaseEscrow raiseDispute]
        BResolve[PurchaseEscrow resolveDispute]
        BRefund[Return funds to buyer]
        BPay[Pay seller from escrow]
    end

    CStart --> MShip
    MShip --> MWait
    MWait --> CDecision
    CDecision -->|Confirm| CConfirm
    CConfirm --> BConfirm
    BConfirm --> SConfirm
    SConfirm --> SVerifyRelease
    SVerifyRelease --> SReleased
    SReleased --> BPay
    BPay --> MPaid
    MPaid --> CEnd

    CDecision -->|Dispute| CDispute
    CDispute --> BDispute
    BDispute --> SDispute
    SDispute --> SVerifyDispute
    SVerifyDispute --> SDisputed
    SDisputed --> SAdminQueue
    SAdminQueue --> AReview
    AReview --> ADecision
    ADecision -->|Refund| SResolve
    ADecision -->|Release| SResolve
    SResolve --> BResolve
    BResolve -->|Refund| BRefund
    BRefund --> SRefund
    SRefund --> CEnd
    BResolve -->|Release| BPay
```

---

## 8. Activity Diagram — Elixir Staking (Stake & Unstake)

```mermaid
graph TD
    subgraph CustomerLane[Customer]
        direction TB
        CStart([Start])
        COpen[Open staking page]
        CChoose[Choose tier and amount]
        CWallet{MetaMask linked?}
        CBalance{Enough Elixir?}
        CSend[Send Elixir to treasury]
        CWait[Wait until maturity]
        CUnstake[Request unstake]
        CEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        STiers[Load staking tiers]
        SVerify[Verify Elixir transfer]
        SCreate[Create StakePosition]
        SRecord[Record STAKE transaction]
        SInterest[Calculate compound interest]
        SMature{Maturity reached?}
        SUnstake[Process unstake request]
        SComplete[Mark position completed]
        SRecordOut[Record UNSTAKE transaction]
    end

    subgraph BlockchainLane[Blockchain]
        direction TB
        BSend[LYT transfer to admin treasury]
        BPayout[Admin sends principal and reward LYT]
    end

    CStart --> COpen
    COpen --> STiers
    STiers --> CChoose
    CChoose --> CWallet
    CWallet -->|No| CEnd
    CWallet -->|Yes| CBalance
    CBalance -->|No| CEnd
    CBalance -->|Yes| CSend
    CSend --> BSend
    BSend --> SVerify
    SVerify --> SCreate
    SCreate --> SRecord
    SRecord --> SInterest
    SInterest --> CWait
    CWait --> SMature
    SMature -->|No| CWait
    SMature -->|Yes| CUnstake
    CUnstake --> SUnstake
    SUnstake --> BPayout
    BPayout --> SComplete
    SComplete --> SRecordOut
    SRecordOut --> CEnd
```

---

## 9. Activity Diagram — Seller Product Management

```mermaid
graph TD
    subgraph MerchantLane[Merchant]
        direction TB
        MStart([Start])
        MOpen[Open product management]
        MAction{Create, edit, or deactivate?}
        MForm[Enter product details]
        MSelect[Select existing product]
        MEdit[Edit product details]
        MDelete[Deactivate product]
        MEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SPlan{Plan product limit available?}
        SCreate[Create Product row]
        SOwnership{Merchant owns product?}
        SUpdate[Update Product row]
        SDeactivate[Set isActive to false]
        SPublish[Show product in marketplace]
        SError[Show permission or plan error]
    end

    MStart --> MOpen
    MOpen --> MAction
    MAction -->|Create| MForm
    MForm --> SPlan
    SPlan -->|No| SError
    SPlan -->|Yes| SCreate
    SCreate --> SPublish
    MAction -->|Edit| MSelect
    MSelect --> MEdit
    MEdit --> SOwnership
    SOwnership -->|No| SError
    SOwnership -->|Yes| SUpdate
    SUpdate --> SPublish
    MAction -->|Deactivate| MSelect
    MSelect --> MDelete
    MDelete --> SOwnership
    SOwnership -->|Yes| SDeactivate
    SDeactivate --> MEnd
    SPublish --> MEnd
    SError --> MEnd
```

---

## 10. Activity Diagram — Seller Order Fulfillment

```mermaid
graph TD
    subgraph MerchantLane[Merchant]
        direction TB
        MStart([Start])
        MOpen[Open purchase orders]
        MSelect[Select order]
        MAdvance[Advance fulfillment stage]
        MEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SOrders[Load merchant orders]
        SOwnership{Merchant owns order?}
        SUpdate[Update fulfillmentStage]
        SEscrow{Order uses escrow?}
        SWait[Wait for buyer confirmation]
        SComplete[Show order completed]
        SError[Show permission error]
    end

    subgraph CustomerLane[Customer]
        direction TB
        CConfirm[Confirm delivery or dispute]
    end

    MStart --> MOpen
    MOpen --> SOrders
    SOrders --> MSelect
    MSelect --> MAdvance
    MAdvance --> SOwnership
    SOwnership -->|No| SError
    SOwnership -->|Yes| SUpdate
    SUpdate --> SEscrow
    SEscrow -->|Yes| SWait
    SWait --> CConfirm
    CConfirm --> SComplete
    SEscrow -->|No| SComplete
    SComplete --> MEnd
    SError --> MEnd
```

---

## 11. Activity Diagram — Seller Subscription Plan Change & Payment

```mermaid
graph TD
    subgraph MerchantLane[Merchant]
        direction TB
        MStart([Start])
        MOpen[Open subscription page]
        MChoose[Choose subscription plan]
        MPay[Send ETH payment with MetaMask]
        MEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SPlan[Load current plan and usage]
        SChange[Queue pending plan]
        SVerify[Verify incoming ETH]
        SAmount{Payment amount correct?}
        SApply[Apply plan and extend renewal]
        SRecord[Create SubscriptionPayment]
        SError[Show payment error]
    end

    subgraph BlockchainLane[Blockchain]
        direction TB
        BPay[Transfer ETH to admin wallet]
    end

    MStart --> MOpen
    MOpen --> SPlan
    SPlan --> MChoose
    MChoose --> SChange
    SChange --> MPay
    MPay --> BPay
    BPay --> SVerify
    SVerify --> SAmount
    SAmount -->|No| SError
    SAmount -->|Yes| SApply
    SApply --> SRecord
    SRecord --> MEnd
    SError --> MEnd
```

---

## 12. Activity Diagram — Multi-Currency Swap (ETH ⇄ Elixir ⇄ RM)

```mermaid
graph TD
    subgraph CustomerLane[Customer]
        direction TB
        CStart([Start])
        CChoose[Choose currencies and amount]
        CWallet{MetaMask linked?}
        CSign[Approve and sign transfer]
        CEnd([End])
    end

    subgraph SystemLane[System]
        direction TB
        SValidate{Different currencies and valid amount?}
        SBalance{Enough RM balance?}
        SVerifyEth[Verify incoming ETH]
        SVerifyLyt[Verify incoming Elixir]
        SCalculate[Calculate conversion]
        SUpdate[Update wallet mirror]
        SRecord[Record SWAP transaction]
        SError[Show swap error]
    end

    subgraph BlockchainLane[Blockchain]
        direction TB
        BInbound[Receive ETH or Elixir]
        BOutbound[Admin sends ETH or Elixir]
    end

    CStart --> CChoose
    CChoose --> SValidate
    SValidate -->|No| SError
    SValidate -->|Yes| CWallet
    CWallet -->|No, on-chain swap| SError
    CWallet -->|Yes| CSign
    CSign --> BInbound
    BInbound --> SCalculate
    SCalculate --> SBalance
    SBalance -->|No| SError
    SBalance -->|Yes| SVerifyEth
    SVerifyEth --> SVerifyLyt
    SVerifyLyt --> BOutbound
    BOutbound --> SUpdate
    SUpdate --> SRecord
    SRecord --> CEnd
    SError --> CEnd
```

---

## Getting these into Figma

I don't have a tool that draws directly onto a Figma canvas — my Figma access
is read-only (I can pull data from an existing file or export images from it).
Generating a token with broader API scopes doesn't add that capability; it's
a tooling limitation, not a permissions one. Here's how to bring these Mermaid
diagrams into Figma yourself, in order of how close they get to fully native,
editable shapes:

1. **Mermaid Figma plugins (best fidelity):** In Figma, open
   **Resources → Plugins → search "Mermaid"**. Plugins such as *Mermaid
   Charts* or *Mermaid to Figma* let you paste the Mermaid code from a code
   block above directly and generate native Figma frames, shapes, and text
   layers you can then restyle.
2. **Render then trace/paste as image:** Paste any code block into
   [mermaid.live](https://mermaid.live), export as SVG, then in Figma use
   **File → Import** or drag the SVG in. Figma will convert it into editable
   vector layers (ungroup to adjust individual boxes/arrows).
3. **VS Code preview:** Install the "Markdown Preview Mermaid Support"
   extension, open `docs/diagrams.md`, and use the preview's built-in export
   (right-click a diagram → "Export image") if you just need a picture for a
   report rather than an editable Figma file.

If you tell me a specific diagram to prioritize, I can also produce a version
tuned for one of the Mermaid-to-Figma plugins if its input format differs
slightly from vanilla Mermaid syntax.


> **Draw.io swimlane version:** For vertical activity diagrams with User/System and role-specific swimlanes, use [`activity-diagrams-drawio.md`](./activity-diagrams-drawio.md). The diagrams in that file use `graph TD`, `<br/>`, and draw.io-compatible Mermaid syntax.
