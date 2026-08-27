"""
UAT (User Acceptance Testing) preparation forms for each role in the Elixir
Commerce blockchain e-commerce platform.

Format mirrors the sample: a rating grid (Excellent 5 / Very Good 4 /
Fair 2-3 / Poor 1-0) across one row per testing category, followed by two
open feedback questions and a Developer Response line.

Testing categories are derived from the actual screens/use cases documented
in docs/usecase-specifications.md and docs/specs_wireframe.py, so each row
maps to a real, testable feature rather than a generic placeholder.
"""

FORMS = [
    {
        "section_no": "1",
        "role": "Customer",
        "title": "Customer UAT Preparation",
        "categories": [
            "Account Registration and Login",
            "Profile Management (Edit profile, Email, Password)",
            "Connect MetaMask Wallet (Link wallet, Live ETH balance)",
            "Browse and Search Products",
            "Manage Cart (Add, Adjust Quantity, Remove)",
            "Checkout with ETH / Elixir (Direct Payment)",
            "Checkout with ETH / Elixir Escrow (Multi-item Basket)",
            "Checkout with RM (Off-chain Ledger)",
            "Track Order and Delivery Progress",
            "Confirm Delivery and Raise Dispute",
            "Stake Elixir and View Compound Interest",
            "Unstake Elixir (Claim Matured Position)",
            "Wallet: Currency Swap (ETH / Elixir / RM)",
            "Wallet: Deposit RM and Transfer Currency (P2P)",
            "View Purchase and Transaction History",
            "View NFT Purchase Receipts",
            "Overall Ease of Use and User Interface",
        ],
    },
    {
        "section_no": "2",
        "role": "Merchant",
        "title": "Merchant (Seller) UAT Preparation",
        "categories": [
            "Account Registration and Login",
            "Profile Management (Edit profile, Email, Password)",
            "Connect MetaMask Wallet for Payments",
            "Create New Product Listing",
            "Edit Existing Product Details",
            "Deactivate / Reactivate a Product",
            "Plan Product Limit Enforcement (Starter / Pro / Enterprise)",
            "Track Purchase Order and Buyer Details",
            "Update Order Fulfillment Stage",
            "View Revenue Dashboard and Product Performance",
            "Manage Subscription Plan (Switch Plan)",
            "Pay Subscription Fee in ETH",
            "Overall Ease of Use and User Interface",
        ],
    },
    {
        "section_no": "3",
        "role": "Admin",
        "title": "Admin UAT Preparation",
        "categories": [
            "Account Login and Access Control",
            "View All Registered Users and Search",
            "View Platform Overview (User Counts by Role)",
            "View Platform Treasury Balance (ETH / Elixir)",
            "Manage Staking Tiers (Edit APY per Tier)",
            "View All Staking Positions Across Platform",
            "View and Resolve Escrow Disputes (Refund / Release)",
            "View Subscription Revenue and Payment Ledger",
            "View Blockchain Audit Log",
            "Overall Ease of Use and User Interface",
        ],
    },
]

FEEDBACK_QUESTIONS = [
    "What did you like the most about the app?",
    "What should be improved?",
]
