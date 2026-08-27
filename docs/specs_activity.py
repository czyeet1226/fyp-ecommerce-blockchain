"""
Layout specs for all 16 activity diagrams.

Node placement is explicit -- (lane, row, col) -- so the result is
deterministic. Flow runs top to bottom, alternating lanes; branches and
loop-backs are routed through staggered side channels via the `hint` and
`chan` fields on each edge.

Edge tuple: (source, target, label, hint, chan)
    hint : "left" | "right"  -- which side channel to route around
    chan : 0,1,2...          -- stagger index so parallel channels separate
"""

from render_activity import N

CUST_SYS = ["Customer", "System"]

DIAGRAMS = []


def add(num, title, lanes, nodes, edges):
    DIAGRAMS.append({"num": num, "title": title, "lanes": lanes,
                     "nodes": nodes, "edges": edges})


# ------------------------------------------------------------------ 1. Cart --
add("01", "Manage Cart", CUST_SYS, [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Cart page"),
    N("B1", "action", 1, 2, "GET cart: list items with product and stock info"),
    N("A2", "action", 0, 3, "Choose action on cart"),
    N("A3", "action", 0, 4, "Change quantity of an item"),
    N("D1", "decision", 1, 5, "Quantity exceeds stock?"),
    N("B2", "action", 1, 6, "Cap quantity at available stock", col=-1),
    N("B3", "action", 1, 7, "PUT cart item: update quantity"),
    N("A4", "action", 0, 8, "Remove one item"),
    N("B4", "action", 1, 9, "DELETE cart item: remove one row"),
    N("A5", "action", 0, 10, "Clear entire cart"),
    N("B5", "action", 1, 11, "DELETE cart: remove all rows"),
    N("A7", "action", 0, 12, "See updated cart"),
    N("A6", "action", 0, 13, "Proceed to Checkout"),
    N("B6", "action", 1, 14, "Group items by seller and open checkout"),
    N("E", "end", 0, 15),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"),
    ("A2", "A3", "Adjust qty"),
    ("A3", "D1"),
    ("D1", "B2", "Yes"), ("B2", "B3"), ("D1", "B3", "No", "right", 0),
    ("B3", "A7", "", "right", 1),
    ("A2", "A4", "Remove item", "left", 0), ("A4", "B4"),
    ("B4", "A7", "", "right", 2),
    ("A2", "A5", "Clear cart", "left", 1), ("A5", "B5"), ("B5", "A7"),
    ("A7", "A2", "", "left", 3),
    ("A2", "A6", "Checkout", "left", 2), ("A6", "B6"), ("B6", "E"),
])

# -------------------------------------------------------------- 2. Browse ----
add("02", "Browse Products", CUST_SYS, [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Shop page"),
    N("B1", "action", 1, 2, "GET products: active products, paginated"),
    N("A2", "action", 0, 3, "Enter search term or pick category and seller"),
    N("B2", "action", 1, 4, "Apply category, merchant and name filters"),
    N("A3", "action", 0, 5, "Click a product card"),
    N("B3", "action", 1, 6, "GET product by id with merchant info"),
    N("D1", "decision", 1, 7, "Product found?"),
    N("B4", "action", 1, 8, "Return product not found", col=-1),
    N("A4", "action", 0, 9, "View product detail page"),
    N("E", "end", 0, 10),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "B2"), ("B2", "A3"),
    ("A3", "B3"), ("B3", "D1"),
    ("D1", "B4", "No"),
    ("B4", "A2", "", "left", 0),
    ("D1", "A4", "Yes", "right", 0),
    ("A4", "E"),
])

# ------------------------------------------------------------ 3. Checkout ----
# The four crypto modes share one structure (sign -> verify -> create order);
# only escrow adds the amount check and defers seller payout. Collapsing them
# into direct vs escrow keeps the diagram readable while still naming all five
# modes on the branch labels.
add("03", "Checkout with All Payment Modes", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Checkout"),
    N("A2", "action", 0, 2, "Choose payment mode"),
    N("D1", "decision", 1, 3, "MetaMask linked?"),
    N("A3", "action", 0, 4, "Connect MetaMask wallet"),
    N("A4", "action", 0, 5, "Sign direct payment: ETH or Elixir"),
    N("B1", "action", 1, 6, "Verify PaymentCompleted event on chain"),
    N("A5", "action", 0, 7, "Sign escrow payment: ETH or Elixir"),
    N("B2", "action", 1, 8, "Verify EscrowCreated event on chain"),
    N("D2", "decision", 1, 9, "Escrowed amount covers total?"),
    N("A6", "action", 0, 10, "Confirm RM ledger checkout"),
    N("D3", "decision", 1, 11, "RM balance covers total?"),
    N("B7", "action", 1, 12, "Reject: insufficient balance", col=-1),
    N("B3", "action", 1, 13, "Deduct RM from wallet ledger"),
    N("B4", "action", 1, 14, "Create Order, decrement stock, clear cart"),
    N("B5", "action", 1, 15, "Write event to audit log"),
    N("B6", "action", 1, 16, "Mint NFT receipt, best effort"),
    N("A9", "action", 0, 17, "See order confirmation"),
    N("E", "end", 0, 18),
], [
    ("S", "A1"), ("A1", "A2"),
    ("A2", "D1", "Crypto"),
    ("D1", "A3", "No"), ("A3", "A2", "", "left", 0),
    ("D1", "A4", "Direct", "right", 0),
    ("A4", "B1"),
    ("B1", "B4", "", "right", 1),
    ("D1", "A5", "Escrow", "left", 1),
    ("A5", "B2"), ("B2", "D2"),
    ("D2", "B7", "No"), ("B7", "A2", "", "left", 2),
    ("D2", "B4", "Yes", "right", 2),
    ("A2", "A6", "RM", "left", 3),
    ("A6", "D3"), ("D3", "B7", "No"), ("D3", "B3", "Yes", "right", 3),
    ("B3", "B4"), ("B4", "B5"), ("B5", "B6"), ("B6", "A9"), ("A9", "E"),
])

# ------------------------------------------------------- 4. Raise Dispute ----
add("04", "Raise Dispute", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open funded escrow order"),
    N("A2", "action", 0, 2, "Click Raise Dispute"),
    N("A3", "action", 0, 3, "Sign raiseDispute transaction"),
    N("B1", "action", 1, 4, "Contract emits EscrowDisputed"),
    N("B2", "action", 1, 5, "Verify EscrowDisputed event"),
    N("D1", "decision", 1, 6, "Event verified?"),
    N("B6", "action", 1, 7, "Reject: verification failed", col=-1),
    N("B3", "action", 1, 8, "Update order: escrowStatus disputed"),
    N("B4", "action", 1, 9, "Log EscrowDisputed to audit log"),
    N("B5", "action", 1, 10, "Show order in admin dispute queue"),
    N("A4", "action", 0, 11, "See dispute submitted, awaiting review"),
    N("E", "end", 0, 12),
], [
    ("S", "A1"), ("A1", "A2"), ("A2", "A3"), ("A3", "B1"), ("B1", "B2"),
    ("B2", "D1"),
    ("D1", "B6", "No"), ("B6", "A2", "", "left", 0),
    ("D1", "B3", "Yes", "right", 0),
    ("B3", "B4"), ("B4", "B5"), ("B5", "A4"), ("A4", "E"),
])

# ---------------------------------------------------- 5. Confirm Delivery ----
add("05", "Confirm Delivery", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open funded escrow order"),
    N("A2", "action", 0, 2, "Click Confirm Delivery"),
    N("A3", "action", 0, 3, "Sign confirmDelivery transaction"),
    N("B1", "action", 1, 4, "Contract pays seller minus platform fee"),
    N("D1", "decision", 1, 5, "ETH escrow?"),
    N("B2", "action", 1, 6, "Issue Elixir loyalty reward to buyer", col=-1),
    N("B3", "action", 1, 7, "Mint NFT purchase receipt"),
    N("B4", "action", 1, 8, "Verify EscrowReleased event"),
    N("B5", "action", 1, 9, "Update order: released, delivered, receipt id"),
    N("B6", "action", 1, 10, "Log EscrowReleased to audit log"),
    N("A4", "action", 0, 11, "See order delivered with NFT receipt"),
    N("E", "end", 0, 12),
], [
    ("S", "A1"), ("A1", "A2"), ("A2", "A3"), ("A3", "B1"), ("B1", "D1"),
    ("D1", "B2", "Yes"), ("B2", "B3"), ("D1", "B3", "No", "right", 0),
    ("B3", "B4"), ("B4", "B5"), ("B5", "B6"), ("B6", "A4"), ("A4", "E"),
])

# ------------------------------------------------ 6. Resolve Escrow Dispute --
add("06", "Resolve Escrow Dispute", ["Admin", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Disputes tab"),
    N("B1", "action", 1, 2, "GET disputed orders"),
    N("A2", "action", 0, 3, "Review dispute details"),
    N("A3", "action", 0, 4, "Choose Refund Buyer", col=-1),
    N("A4", "action", 0, 4, "Choose Release to Seller", col=1),
    N("B2", "action", 1, 5, "POST resolve, refundBuyer true", col=-1),
    N("B3", "action", 1, 5, "POST resolve, refundBuyer false", col=1),
    N("B4", "action", 1, 6, "Admin wallet calls resolveDispute on chain"),
    N("D1", "decision", 1, 7, "Refund buyer?"),
    N("B5", "action", 1, 8, "Refund buyer, cancel order, restore stock", col=-1),
    N("B6", "action", 1, 8, "Pay seller, mark released and delivered", col=1),
    N("B7", "action", 1, 9, "Log resolution to audit log"),
    N("A5", "action", 0, 10, "See dispute resolved"),
    N("E", "end", 0, 11),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"),
    ("A2", "A3", "Refund"), ("A2", "A4", "Release"),
    ("A3", "B2"), ("A4", "B3"),
    ("B2", "B4"), ("B3", "B4"),
    ("B4", "D1"),
    ("D1", "B5", "Yes"), ("D1", "B6", "No"),
    ("B5", "B7"), ("B6", "B7"),
    ("B7", "A5"), ("A5", "E"),
])

# ------------------------------------------------------- 7. Unstake Elixir --
add("07", "Unstake Elixir", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Staking page"),
    N("B1", "action", 1, 2, "Load positions with accrued interest"),
    N("A2", "action", 0, 3, "Click Unstake on a position"),
    N("D1", "decision", 1, 4, "Maturity date reached?"),
    N("B2", "action", 1, 5, "Reject: position not yet matured", col=-1),
    N("A3", "action", 0, 6, "Wait until maturity date"),
    N("B3", "action", 1, 7, "Compute compound reward"),
    N("B4", "action", 1, 8, "Admin wallet sends principal plus reward"),
    N("B5", "action", 1, 9, "Update position: completed, reward paid"),
    N("B6", "action", 1, 10, "Record wallet transaction UNSTAKE"),
    N("A4", "action", 0, 11, "Receive principal plus reward Elixir"),
    N("E", "end", 0, 12),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "D1"),
    ("D1", "B2", "No"), ("B2", "A3"), ("A3", "A2", "", "left", 0),
    ("D1", "B3", "Yes", "right", 0),
    ("B3", "B4"), ("B4", "B5"), ("B5", "B6"), ("B6", "A4"), ("A4", "E"),
])

# --------------------------------------------------------- 8. Stake Elixir --
add("08", "Stake Elixir", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Staking page"),
    N("B1", "action", 1, 2, "Load staking tiers: 30, 90, 180, 365 days"),
    N("A2", "action", 0, 3, "Choose tier and amount"),
    N("D1", "decision", 1, 4, "MetaMask linked?"),
    N("A3", "action", 0, 5, "Connect MetaMask or top up Elixir"),
    N("D2", "decision", 1, 6, "Elixir balance covers amount?"),
    N("A4", "action", 0, 7, "Sign Elixir transfer to treasury"),
    N("B2", "action", 1, 8, "Verify Elixir transfer on chain"),
    N("B3", "action", 1, 9, "Create stake position with maturity date"),
    N("B4", "action", 1, 10, "Record wallet transaction STAKE"),
    N("B5", "action", 1, 11, "Mirror on chain Elixir balance"),
    N("A5", "action", 0, 12, "See active stake position"),
    N("E", "end", 0, 13),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "D1"),
    ("D1", "A3", "No"), ("A3", "A2", "", "left", 0),
    ("D1", "D2", "Yes"),
    ("D2", "A3", "No", "left", 1),
    ("D2", "A4", "Yes"),
    ("A4", "B2"), ("B2", "B3"), ("B3", "B4"), ("B4", "B5"), ("B5", "A5"),
    ("A5", "E"),
])

# --------------------------------------------- 9. Manage Product Catalog ----
add("09", "Manage Product Catalog", ["Merchant", "System"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open product management"),
    N("B1", "action", 1, 2, "GET own products including deactivated"),
    N("A2", "action", 0, 3, "Choose create, edit or deactivate"),
    N("A3", "action", 0, 4, "Enter name, price, category, stock, image"),
    N("D1", "decision", 1, 5, "Active products below plan limit?"),
    N("B5", "action", 1, 6, "Reject: plan limit reached", col=-1),
    N("A5", "action", 0, 7, "Upgrade subscription plan"),
    N("B2", "action", 1, 8, "Create product row, set active"),
    N("A4", "action", 0, 9, "Select an existing product"),
    N("D2", "decision", 1, 10, "Merchant owns this product?"),
    N("B6", "action", 1, 11, "Reject: not your product", col=-1),
    N("B3", "action", 1, 12, "Update product fields"),
    N("B4", "action", 1, 13, "Set product inactive, hide from shop"),
    N("A6", "action", 0, 14, "See updated catalog"),
    N("E", "end", 0, 15),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"),
    ("A2", "A3", "Create"),
    ("A3", "D1"),
    ("D1", "B5", "No"), ("B5", "A5"), ("A5", "A2", "", "left", 0),
    ("D1", "B2", "Yes", "right", 0),
    ("B2", "A6", "", "right", 1),
    ("A2", "A4", "Edit or deactivate", "left", 1),
    ("A4", "D2"),
    ("D2", "B6", "No"), ("B6", "A2", "", "left", 2),
    ("D2", "B3", "Edit", "right", 2),
    ("D2", "B4", "Deactivate", "right", 3),
    ("B3", "A6"), ("B4", "A6"), ("A6", "E"),
])

# --------------------------------------------- 10. Update Fulfillment Stage --
add("10", "Update Fulfillment Stage", ["Merchant", "System"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Track Purchase Order"),
    N("B1", "action", 1, 2, "GET merchant orders with buyer and product info"),
    N("A2", "action", 0, 3, "Select an order"),
    N("A3", "action", 0, 4, "Advance fulfillment stage"),
    N("D1", "decision", 1, 5, "Merchant owns this order?"),
    N("B2", "action", 1, 6, "Reject: not your order", col=-1),
    N("B3", "action", 1, 7, "Update order fulfillment stage"),
    N("D2", "decision", 1, 8, "Order uses escrow?"),
    N("B4", "action", 1, 9, "Payout waits for buyer confirmation", col=-1),
    N("B5", "action", 1, 9, "Seller already paid at purchase", col=1),
    N("A4", "action", 0, 10, "See updated delivery stage"),
    N("E", "end", 0, 11),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "A3"), ("A3", "D1"),
    ("D1", "B2", "No"), ("B2", "A2", "", "left", 0),
    ("D1", "B3", "Yes", "right", 0),
    ("B3", "D2"),
    ("D2", "B4", "Yes"), ("D2", "B5", "No"),
    ("B4", "A4"), ("B5", "A4"), ("A4", "E"),
])

# ------------------------------------------------ 11. Manage Staking Tiers --
add("11", "Manage Staking Tiers", ["Admin", "System"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Staking tab"),
    N("B1", "action", 1, 2, "GET staking tiers: 30, 90, 180, 365 days"),
    N("A2", "action", 0, 3, "Edit annual percentage yield for a tier"),
    N("B2", "action", 1, 4, "PUT staking tier by days"),
    N("D1", "decision", 1, 5, "Valid yield value?"),
    N("B3", "action", 1, 6, "Reject: invalid yield value", col=-1),
    N("B4", "action", 1, 7, "Update staking tier row"),
    N("B5", "action", 1, 8, "Existing positions keep locked in yield"),
    N("B6", "action", 1, 9, "GET all staking positions with summary"),
    N("A3", "action", 0, 10, "See updated tier and staker positions"),
    N("E", "end", 0, 11),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "B2"), ("B2", "D1"),
    ("D1", "B3", "No"), ("B3", "A2", "", "left", 0),
    ("D1", "B4", "Yes", "right", 0),
    ("B4", "B5"), ("B5", "B6"), ("B6", "A3"), ("A3", "E"),
])

# ------------------------------------------------- 12. Manage Subscription --
add("12", "Manage Subscription and Pay Fee", ["Merchant", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Payments tab"),
    N("B1", "action", 1, 2, "GET plan, pending plan and product usage"),
    N("A2", "action", 0, 3, "Select a subscription plan"),
    N("D1", "decision", 1, 4, "Same as active plan?"),
    N("B2", "action", 1, 5, "Cancel any pending plan change", col=-1),
    N("B3", "action", 1, 6, "Queue pending plan for next cycle"),
    N("A3", "action", 0, 7, "Click Pay Subscription"),
    N("A4", "action", 0, 8, "Sign ETH transfer to platform admin"),
    N("B4", "action", 1, 9, "Verify incoming ETH for plan price"),
    N("D2", "decision", 1, 10, "Payment amount correct?"),
    N("B5", "action", 1, 11, "Reject: incorrect amount", col=-1),
    N("B6", "action", 1, 12, "Apply plan, extend renewal by 30 days"),
    N("B7", "action", 1, 13, "Create subscription payment record"),
    N("A5", "action", 0, 14, "See plan active and renewal extended"),
    N("E", "end", 0, 15),
], [
    ("S", "A1"), ("A1", "B1"), ("B1", "A2"), ("A2", "D1"),
    ("D1", "B2", "Yes"), ("B2", "E", "", "right", 0),
    ("D1", "B3", "No", "right", 1),
    ("B3", "A3"), ("A3", "A4"), ("A4", "B4"), ("B4", "D2"),
    ("D2", "B5", "No"), ("B5", "A3", "", "left", 0),
    ("D2", "B6", "Yes", "right", 2),
    ("B6", "B7"), ("B7", "A5"), ("A5", "E"),
])

# --------------------------------------------------- 13. Transfer Currency --
add("13", "Transfer Currency P2P", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Enter recipient, currency and amount"),
    N("D1", "decision", 1, 2, "Currency is ETH or Elixir?"),
    N("A2", "action", 0, 3, "Sign transfer in MetaMask"),
    N("B1", "action", 1, 4, "Verify on chain transfer hash"),
    N("D2", "decision", 1, 5, "Sender has sufficient balance?"),
    N("B3", "action", 1, 6, "Reject: insufficient balance", col=-1),
    N("B2", "action", 1, 7, "Deduct sender and credit recipient ledger"),
    N("B4", "action", 1, 8, "Record wallet transactions out and in"),
    N("A3", "action", 0, 9, "See balances updated for both parties"),
    N("E", "end", 0, 10),
], [
    ("S", "A1"), ("A1", "D1"),
    ("D1", "A2", "Yes"), ("A2", "B1"),
    ("B1", "B4", "", "right", 0),
    ("D1", "D2", "No, RM", "right", 1),
    ("D2", "B3", "No"), ("B3", "A1", "", "left", 0),
    ("D2", "B2", "Yes", "right", 2),
    ("B2", "B4"), ("B4", "A3"), ("A3", "E"),
])

# ------------------------------------------------------- 14. Update Profile --
add("14", "Update Profile", ["Customer, Merchant or Admin", "System"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Edit name, email, phone or address"),
    N("D1", "decision", 1, 2, "New email valid and unused?"),
    N("B1", "action", 1, 3, "Reject: invalid or duplicate email", col=-1),
    N("A3", "action", 0, 4, "Correct the invalid field"),
    N("A2", "action", 0, 5, "Enter current and new password, optional"),
    N("D2", "decision", 1, 6, "Current password correct and new one valid?"),
    N("B2", "action", 1, 7, "Reject: wrong password or too short", col=-1),
    N("B3", "action", 1, 8, "Hash new password"),
    N("B4", "action", 1, 9, "Apply profile field updates"),
    N("A4", "action", 0, 10, "See updated profile"),
    N("E", "end", 0, 11),
], [
    ("S", "A1"), ("A1", "D1"),
    ("D1", "B1", "No"), ("B1", "A3"), ("A3", "A1", "", "left", 0),
    ("D1", "A2", "Yes", "right", 0),
    ("A2", "D2"),
    ("D2", "B2", "No"), ("B2", "A3", "", "left", 1),
    ("D2", "B3", "Yes", "right", 1),
    ("B3", "B4"), ("B4", "A4"), ("A4", "E"),
])

# ----------------------------------------------------------- 15. Deposit RM --
add("15", "Deposit RM", CUST_SYS, [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Open Wallet page"),
    N("A2", "action", 0, 2, "Enter RM deposit amount"),
    N("D1", "decision", 1, 3, "Amount greater than zero?"),
    N("B1", "action", 1, 4, "Reject: invalid deposit amount", col=-1),
    N("A3", "action", 0, 5, "Enter a valid amount"),
    N("D2", "decision", 1, 6, "Requester role is customer?"),
    N("B2", "action", 1, 7, "Reject: only customers can deposit", col=-1),
    N("B3", "action", 1, 8, "Increment wallet RM balance"),
    N("B4", "action", 1, 9, "Record wallet transaction DEPOSIT"),
    N("A4", "action", 0, 10, "See RM balance increased"),
    N("E", "end", 0, 11),
], [
    ("S", "A1"), ("A1", "A2"), ("A2", "D1"),
    ("D1", "B1", "No"), ("B1", "A3"), ("A3", "A2", "", "left", 0),
    ("D1", "D2", "Yes", "right", 0),
    ("D2", "B2", "No"), ("B2", "E", "", "right", 1),
    ("D2", "B3", "Yes", "right", 2),
    ("B3", "B4"), ("B4", "A4"), ("A4", "E"),
])

# --------------------------------------------------------- 16. Swap Currency --
add("16", "Swap Currency", ["Customer", "System and Blockchain"], [
    N("S", "start", 0, 0),
    N("A1", "action", 0, 1, "Choose from and to currency and amount"),
    N("D1", "decision", 1, 2, "Currencies differ and amount valid?"),
    N("A2", "action", 0, 3, "Pick two different currencies"),
    N("D2", "decision", 1, 4, "Inbound leg is ETH or Elixir?"),
    N("D3", "decision", 1, 5, "MetaMask linked?"),
    N("A3", "action", 0, 6, "Connect MetaMask wallet"),
    N("A4", "action", 0, 7, "Sign transfer to admin address"),
    N("B1", "action", 1, 8, "Verify incoming ETH or Elixir"),
    N("B2", "action", 1, 9, "Check RM ledger balance", col=-1),
    N("D4", "decision", 1, 10, "Outbound leg is ETH or Elixir?"),
    N("B3", "action", 1, 11, "Admin wallet sends ETH or Elixir", col=-1),
    N("B4", "action", 1, 11, "Credit RM ledger balance", col=1),
    N("B5", "action", 1, 12, "Update wallet mirror balances"),
    N("B6", "action", 1, 13, "Record wallet transaction SWAP"),
    N("A5", "action", 0, 14, "See updated wallet balances"),
    N("E", "end", 0, 15),
], [
    ("S", "A1"), ("A1", "D1"),
    ("D1", "A2", "No"), ("A2", "A1", "", "left", 0),
    ("D1", "D2", "Yes"),
    ("D2", "D3", "Yes"),
    ("D3", "A3", "No"), ("A3", "A4"),
    ("D3", "A4", "Yes", "left", 1),
    ("A4", "B1"),
    ("D2", "B2", "No, RM", "right", 0),
    ("B1", "D4"), ("B2", "D4"),
    ("D4", "B3", "Yes"), ("D4", "B4", "No, RM"),
    ("B3", "B5"), ("B4", "B5"),
    ("B5", "B6"), ("B6", "A5"), ("A5", "E"),
])
