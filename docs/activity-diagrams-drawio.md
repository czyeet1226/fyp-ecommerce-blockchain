# Draw.io Activity Diagrams with Vertical Swimlanes

These versions are formatted for draw.io Mermaid insertion.

Use each diagram separately:

1. Open draw.io.
2. Select **Arrange → Insert → Mermaid**.
3. Copy only the code beginning with `graph TD`.
4. Do not copy Markdown fences or headings.
5. Click **Insert**.

All diagrams use vertical flow (`graph TD`) and swimlane containers using
`subgraph`. Labels use `<br/>` instead of `\n` for draw.io compatibility.

---

## 1. Registration and Login

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

## 2. Connect and Link MetaMask

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

## 3. Browse and Checkout

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

## 4. Escrow Confirmation, Dispute, and Resolution

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
        SRelease[Mark order released]
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

## 5. Elixir Staking

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

## 6. Merchant Product Management

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

## 7. Merchant Order Fulfillment

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

## 8. Merchant Subscription Payment

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

## 9. Multi-Currency Swap

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

## Draw.io notes

- Use `graph TD` to keep the activity flow vertical.
- Keep the `subgraph UserLane[User]`, `subgraph SystemLane[System]`, and other role containers.
- Paste one diagram at a time.
- Do not paste the ` ```mermaid ` or closing ` ``` ` lines.
- If draw.io shows a parser error, remove `direction TB` lines first; the
  containers will still remain as swimlanes.
