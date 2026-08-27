"""
Wireframe layout specifications for every screen in the Elixir Commerce
blockchain e-commerce platform.

Labels, field names, table columns, button text, tier values, payment modes and
plan limits are transcribed from the real frontend:
  frontend/src/customer/*.jsx, frontend/src/seller/SellerApp.jsx,
  frontend/src/admin/AdminApp.jsx, frontend/src/layouts/DashboardLayout.jsx,
  frontend/src/dashboard/dashboardData.js
"""

from render_wireframe import (BLACK, GREY_DARK, GREY_FILL, GREY_LINE, GREY_MID,
                              GREY_SOFT, GREY_TEXT, WHITE)

W = 960                 # canvas width
SB = 190                # sidebar width
CX = 206                # content left edge
CW = 738                # content width
TOPBAR_H = 60
BODY_Y = 76             # first row of page content

CUSTOMER_NAV = ["Shop", "Cart", "Wallet", "Staking", "Track Order",
                "History", "Profile"]
SELLER_NAV = ["Create Product", "Track Purchase Order", "Revenue", "Payments"]
ADMIN_NAV = ["Users", "Staking", "Revenue", "Disputes"]

ORDER_STEPS = ["Order placed", "Processing", "Packed", "Shipped", "Delivered"]

SIDEBAR_FILL = (248, 248, 248)


# ----------------------------------------------------------------- helpers ---

def card(x, y, w, h, title=None, *, sub=None, radius=6):
    """Bordered content card with an optional title and sub-line."""
    els = [("rect", x, y, w, h, {"fill": WHITE, "outline": GREY_LINE,
                                 "radius": radius})]
    if title:
        els.append(("text", x + 12, y + 10, title, {"size": 11, "bold": True}))
    if sub:
        els.append(("text", x + 12, y + 25, sub, {"size": 9,
                                                  "color": GREY_TEXT}))
    return els


def tile(x, y, w, label, value, sub):
    """Small KPI / balance tile."""
    return [
        ("rect", x, y, w, 68, {"fill": WHITE, "outline": GREY_LINE,
                               "radius": 6}),
        ("text", x + 12, y + 11, label.upper(), {"size": 8, "bold": True,
                                                 "color": GREY_TEXT}),
        ("text", x + 12, y + 26, value, {"size": 15, "bold": True}),
        ("text", x + 12, y + 48, sub, {"size": 8, "color": GREY_TEXT,
                                       "max_w": w - 24}),
    ]


def sidebar(h, kind, active, *, brand, kicker, extra_cards=None):
    """Shared left rail: brand block, nav list, context cards, sign-out."""
    nav = {"customer": CUSTOMER_NAV, "seller": SELLER_NAV,
           "admin": ADMIN_NAV}[kind]
    els = [
        ("rect", 1, 1, SB, h - 2, {"fill": SIDEBAR_FILL, "outline": BLACK}),
        ("text", 14, 14, brand, {"size": 11, "bold": True}),
        ("text", 14, 29, kicker, {"size": 8, "color": GREY_TEXT}),
        ("hline", 12, 44, SB - 24),
        ("nav", 12, 52, SB - 24, nav, {"active": active}),
    ]
    cy = 52 + len(nav) * 33 + 12
    for c in (extra_cards or []):
        title, lines, ch = c
        els.append(("rect", 12, cy, SB - 24, ch,
                    {"fill": WHITE, "outline": GREY_SOFT, "radius": 5}))
        els.append(("text", 20, cy + 8, title.upper(),
                    {"size": 8, "bold": True, "color": GREY_TEXT}))
        ly = cy + 22
        for ln in lines:
            els.append(("text", 20, ly, ln, {"size": 9, "max_w": SB - 44}))
            ly += 13
        cy += ch + 10
    els.append(("btn", 12, h - 38, SB - 24, 26, "Sign Out", {"variant": "ghost"}))
    return els


def topbar(kicker, title, *, right=None):
    """Top header strip with kicker/title and a right-hand element cluster."""
    els = [
        ("rect", SB + 1, 1, W - SB - 2, TOPBAR_H,
         {"fill": WHITE, "outline": BLACK}),
        ("text", CX, 14, kicker.upper(), {"size": 8, "bold": True,
                                          "color": GREY_TEXT}),
        ("text", CX, 28, title, {"size": 14, "bold": True}),
    ]
    els += (right or [])
    return els


def metamask_button(x=560):
    """Disconnected state: amber CTA in the real UI, greyscale here."""
    return [
        ("btn", x, 17, 172, 28, "Connect MetaMask", {"variant": "ghost",
                                                     "round": True}),
        ("circle", x + 14, 31, 5, {"fill": WHITE, "outline": GREY_DARK}),
    ]


def metamask_chip(x=520):
    """Connected state: live ETH balance + truncated address + disconnect."""
    return [
        ("rect", x, 15, 212, 32, {"fill": GREY_FILL, "outline": GREY_DARK,
                                  "radius": 16}),
        ("circle", x + 14, 31, 4, {"fill": GREY_DARK, "outline": GREY_DARK}),
        ("text", x + 26, 20, "2.4310 ETH", {"size": 10, "bold": True}),
        ("text", x + 26, 33, "0x71C7\u20269e3F", {"size": 8,
                                                  "color": GREY_TEXT}),
        ("text", x + 196, 25, "\u2715", {"size": 10, "color": GREY_TEXT}),
    ]


def profile_chip(role, line, x=756):
    return [
        ("rect", x, 15, W - x - 16, 32, {"fill": WHITE, "outline": GREY_SOFT,
                                         "radius": 16}),
        ("circle", x + 18, 31, 12, {"fill": GREY_MID, "outline": GREY_SOFT,
                                    "text": "A", "size": 10}),
        ("text", x + 34, 20, role, {"size": 9, "bold": True}),
        ("text", x + 34, 33, line, {"size": 8, "color": GREY_TEXT,
                                    "max_w": W - x - 56}),
    ]


def customer_snapshot(connected):
    return ("Live Balances", [
        "ETH        " + ("2.4310" if connected else "\u2014 not linked"),
        "Elixir     480 ELX",
        "RM         RM 320.00",
    ], 62)


def toast(y, text):
    return [
        ("rect", CX, y, CW, 26, {"fill": GREY_FILL, "outline": GREY_DARK,
                                 "radius": 5}),
        ("text", CX + 10, y + 8, text, {"size": 9, "max_w": CW - 20}),
    ]


def section_head(y, label, title, *, right_btn=None, right_w=90):
    els = [
        ("text", CX, y, label.upper(), {"size": 8, "bold": True,
                                        "color": GREY_TEXT}),
        ("text", CX, y + 13, title, {"size": 13, "bold": True}),
    ]
    if right_btn:
        els.append(("btn", CX + CW - right_w, y + 4, right_w, 24, right_btn,
                    {"variant": "ghost"}))
    return els


def product_card(x, y, w=172, h=150):
    """Shop grid card: image slot, category pill, prices, quantity + CTA."""
    return [
        ("rect", x, y, w, h, {"fill": WHITE, "outline": GREY_LINE,
                              "radius": 6}),
        ("box", x + 8, y + 8, w - 16, 44, "[ product image ]",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 8,
          "color": GREY_TEXT}),
        ("btn", x + 8, y + 57, 46, 14, "clothes", {"variant": "tag",
                                                   "size": 7, "round": True}),
        ("text", x + w - 52, y + 59, "12 left", {"size": 8,
                                                 "color": GREY_TEXT}),
        ("text", x + 8, y + 76, "Aurora Hoodie", {"size": 10, "bold": True}),
        ("text", x + 8, y + 89, "by Nova Store", {"size": 8,
                                                  "color": GREY_TEXT}),
        ("text", x + 8, y + 103, "0.0450 ETH  \u00b7  18 \u2726", {"size": 8}),
        ("text", x + 8, y + 114, "RM 215.00", {"size": 10, "bold": True}),
        ("btn", x + 8, y + 128, 60, 16, "\u2212  1  +", {"variant": "ghost",
                                                         "size": 8}),
        ("btn", x + 74, y + 128, w - 82, 16, "Add to Cart",
         {"variant": "primary", "size": 8}),
    ]


# =============================================================== 01 Login ====

def login():
    h = 470
    els = [("rect", 1, 1, W - 2, h - 2, {"fill": (250, 250, 250),
                                         "outline": BLACK})]
    cx, cw, cy = (W - 420) / 2, 420, 60
    els += card(cx, cy, cw, 330)
    els += [
        ("btn", cx + 28, cy + 26, 108, 20, "Customer Portal",
         {"variant": "tag", "size": 8, "round": True}),
        ("text", cx + 28, cy + 58, "Sign in to continue", {"size": 18,
                                                            "bold": True}),
        ("para", cx + 28, cy + 84, cw - 56,
         "Access your dashboard, track orders, and manage your wallet.",
         {"size": 9}),
        ("field", cx + 28, cy + 116, cw - 56, "Email",
         {"ph": "you@example.com"}),
        ("field", cx + 28, cy + 166, cw - 56, "Password",
         {"ph": "Enter your password"}),
        ("btn", cx + 28, cy + 216, cw - 56, 32, "Sign In",
         {"variant": "primary", "size": 11}),
        ("box", cx + 28, cy + 258, cw - 56, 26,
         "\u26a0  Login failed. Check your details and try again.",
         {"outline": GREY_DARK, "size": 9, "align": "left",
          "color": GREY_DARK, "dash": True}),
        ("text", cx + 28, cy + 296, "New here?  Create an account now.",
         {"size": 9, "color": GREY_TEXT}),
    ]
    els += [("note", cx, cy + 348, cw, 34,
             "On success: admin \u2192 admin console, merchant \u2192 seller "
             "portal, customer \u2192 /shop.")]
    return {"num": "01", "title": "Login", "group": "Authentication",
            "w": W, "h": h, "elements": els,
            "caption": "Route /login \u2014 shared entry point for all three roles."}


# ============================================================ 02 Register ====

def register():
    h = 500
    els = [("rect", 1, 1, W - 2, h - 2, {"fill": (250, 250, 250),
                                         "outline": BLACK})]
    cx, cw, cy = (W - 460) / 2, 460, 50
    els += card(cx, cy, cw, 390)
    half = (cw - 56 - 16) / 2
    els += [
        ("btn", cx + 28, cy + 26, 100, 20, "Create Account",
         {"variant": "tag", "size": 8, "round": True}),
        ("text", cx + 28, cy + 58, "Join the marketplace", {"size": 18,
                                                             "bold": True}),
        ("para", cx + 28, cy + 84, cw - 56,
         "Your account is saved in the MySQL user table through the backend "
         "registration endpoint.", {"size": 9}),
        ("field", cx + 28, cy + 120, half, "Full Name", {"ph": "Your name"}),
        ("field", cx + 28 + half + 16, cy + 120, half, "Account Type",
         {"ph": "Customer", "select": True}),
        ("text", cx + 28 + half + 16, cy + 162,
         "options: Customer | Merchant | Admin", {"size": 8,
                                                  "color": GREY_SOFT}),
        ("field", cx + 28, cy + 176, cw - 56, "Email",
         {"ph": "you@example.com"}),
        ("field", cx + 28, cy + 226, cw - 56, "Password",
         {"ph": "Create a password"}),
        ("btn", cx + 28, cy + 276, cw - 56, 32, "Register",
         {"variant": "primary", "size": 11}),
        ("text", cx + 28, cy + 322,
         "Already have an account?  Back to login", {"size": 9,
                                                     "color": GREY_TEXT}),
        ("note", cx + 28, cy + 344, cw - 56, 34,
         "Registering as Customer also creates the matching customer_wallet "
         "row (RM / Elixir / ETH) in the same transaction."),
    ]
    return {"num": "02", "title": "Register", "group": "Authentication",
            "w": W, "h": h, "elements": els,
            "caption": "Route /register \u2014 role is chosen at sign-up."}


# ==================================== 03 Shop (MetaMask disconnected) =======

def shop_disconnected():
    h = 540
    els = sidebar(h, "customer", 0, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(False)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_button() + profile_chip("customer",
                                                         "Wallet pending"))
    els += section_head(BODY_Y, "Shop", "Browse & Buy Products")
    cats = ["Hot", "Clothes", "Toys", "Foods", "Electronics"]
    for i, c in enumerate(cats):
        els.append(("btn", CX + i * 96, BODY_Y + 36, 88, 24, c,
                    {"variant": "active" if i == 0 else "ghost",
                     "round": True, "size": 9}))
    for i in range(4):
        els += product_card(CX + i * 186, BODY_Y + 74)
    for i in range(4):
        els += product_card(CX + i * 186, BODY_Y + 234)
    els += [("note", CX, h - 76, CW, 44,
             "MetaMask is not connected: the ETH row in Live Balances shows "
             "\u201c\u2014 not linked\u201d and every crypto payment option "
             "stays locked at checkout. Only the RM ledger can be used.")]
    return {"num": "03", "title": "Shop \u2014 Wallet Disconnected",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /shop \u2014 category pills, product grid, "
                       "Connect MetaMask call to action."}


# ======================================= 04 Shop (MetaMask connected) =======

def shop_connected():
    h = 540
    els = sidebar(h, "customer", 0, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Shop", "Browse & Buy Products")
    cats = ["Hot", "Clothes", "Toys", "Foods", "Electronics"]
    for i, c in enumerate(cats):
        els.append(("btn", CX + i * 96, BODY_Y + 36, 88, 24, c,
                    {"variant": "active" if i == 1 else "ghost",
                     "round": True, "size": 9}))
    for i in range(4):
        els += product_card(CX + i * 186, BODY_Y + 74)
    for i in range(4):
        els += product_card(CX + i * 186, BODY_Y + 234)
    els += [("note", CX, h - 76, CW, 44,
             "Once MetaMask is connected the chip replaces the button, the ETH "
             "balance is read live from the wallet and mirrored into Live "
             "Balances, and ETH / Elixir checkout unlocks. The address is "
             "also linked to the account (one wallet per user).")]
    return {"num": "04", "title": "Shop \u2014 Wallet Connected (Live ETH)",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Connected state: address chip, live ETH balance, "
                       "crypto payments enabled."}


# ================================================ 05 Shop (seller filter) ===

def shop_seller():
    h = 430
    els = sidebar(h, "customer", 0, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Shop", "Browse & Buy Products")
    els += [
        ("rect", CX, BODY_Y + 36, CW, 42, {"fill": GREY_FILL,
                                           "outline": GREY_DARK,
                                           "radius": 6}),
        ("text", CX + 12, BODY_Y + 44, "VIEWING STORE", {"size": 8,
                                                          "bold": True,
                                                          "color": GREY_TEXT}),
        ("text", CX + 12, BODY_Y + 57, "Nova Store", {"size": 12,
                                                       "bold": True}),
        ("btn", CX + CW - 140, BODY_Y + 46, 128, 24, "\u2715 Show all sellers",
         {"variant": "ghost", "size": 9}),
    ]
    for i in range(4):
        els += product_card(CX + i * 186, BODY_Y + 90)
    els += [("note", CX, h - 74, CW, 42,
             "Clicking \u201cby {merchant}\u201d on any product card switches "
             "the grid into single-seller mode. Category pills are replaced by "
             "the store banner, and the sample-catalog fallback is disabled so "
             "no other seller's items leak in.")]
    return {"num": "05", "title": "Shop \u2014 Single Seller Store View",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Seller-filtered product grid."}


# ================================================== 06 Cart (empty state) ===

def cart_empty():
    h = 380
    els = sidebar(h, "customer", 1, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Cart", "Your Shopping Cart")
    els += card(CX, BODY_Y + 40, CW, 180)
    els += [
        ("circle", CX + CW / 2, BODY_Y + 92, 22, {"fill": GREY_FILL,
                                                  "outline": GREY_SOFT,
                                                  "text": "\u2205",
                                                  "size": 14}),
        ("text", CX, BODY_Y + 128, "Your cart is empty",
         {"size": 13, "bold": True, "align": "center", "box_w": CW}),
        ("text", CX, BODY_Y + 150,
         "Browse the Shop and add products \u2014 you can buy multiple items "
         "from a seller together in one order.",
         {"size": 9, "color": GREY_TEXT, "align": "center", "box_w": CW}),
    ]
    els += [("note", CX, BODY_Y + 240, CW, 40,
             "Cart rows are removed automatically once checkout completes and "
             "the matching orders / order_items records are created.")]
    return {"num": "06", "title": "Cart \u2014 Empty State",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /cart with no cart rows for the customer."}


# ================================================ 07 Cart (grouped items) ===

def cart_items():
    h = 580
    els = sidebar(h, "customer", 1, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Cart", "Your Shopping Cart")
    els += toast(BODY_Y + 38, "\u2713  Added to cart")

    def store(y, name, items, subtotal):
        e = card(CX, y, CW, 60 + len(items) * 34 + 62)
        e += [
            ("text", CX + 12, y + 12, name, {"size": 11, "bold": True}),
            ("text", CX + CW - 90, y + 14, f"{len(items)} item(s)",
             {"size": 9, "color": GREY_TEXT}),
            ("hline", CX + 12, y + 32, CW - 24),
        ]
        for i, (nm, price) in enumerate(items):
            ry = y + 40 + i * 34
            e += [
                ("circle", CX + 26, ry + 12, 11, {"fill": GREY_FILL,
                                                  "outline": GREY_SOFT,
                                                  "text": nm[0], "size": 9}),
                ("text", CX + 46, ry + 2, nm, {"size": 10, "bold": True}),
                ("text", CX + 46, ry + 15, price, {"size": 8,
                                                   "color": GREY_TEXT}),
                ("btn", CX + CW - 190, ry + 4, 62, 18, "\u2212  2  +",
                 {"variant": "ghost", "size": 8}),
                ("text", CX + CW - 110, ry + 8, "0.090000 ETH", {"size": 9}),
                ("text", CX + CW - 26, ry + 8, "\u2715", {"size": 10,
                                                          "color": GREY_TEXT}),
            ]
        by = y + 44 + len(items) * 34
        e += [
            ("hline", CX + 12, by, CW - 24),
            ("text", CX + 12, by + 10, "Subtotal", {"size": 10,
                                                     "bold": True}),
            ("text", CX + CW - 150, by + 8, subtotal, {"size": 11,
                                                        "bold": True,
                                                        "align": "right",
                                                        "box_w": 134}),
            ("btn", CX + 12, by + 30, CW - 24, 26,
             "Checkout this store \u2014 0.120000 ETH",
             {"variant": "primary", "size": 10}),
        ]
        return e

    els += store(BODY_Y + 76, "Nova Store",
                 [("Aurora Hoodie", "0.045000 ETH \u00b7 18 \u2726 \u00b7 RM 215.00"),
                  ("Orbit Speaker", "0.080000 ETH \u00b7 32 \u2726 \u00b7 RM 380.00")],
                 "0.125000 ETH")
    els += store(BODY_Y + 264, "Playbox Toys",
                 [("Mini Racer Set", "0.030000 ETH \u00b7 13 \u2726 \u00b7 RM 145.00")],
                 "0.030000 ETH")
    els += [("note", CX, h - 66, CW, 40,
             "Items are grouped per seller because each store is checked out "
             "as its own order. \u201cCheckout this store\u201d expands the "
             "inline Checkout panel shown in the next wireframes.")]
    return {"num": "07", "title": "Cart \u2014 Items Grouped by Seller",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Quantity steppers, per-store subtotal, per-store "
                       "checkout."}


# =========================================== 08 Checkout (crypto locked) ====

def checkout_locked():
    h = 610
    els = [("rect", 1, 1, W - 2, h - 2, {"fill": (250, 250, 250),
                                         "outline": BLACK})]
    x, w = 40, W - 80
    els += card(x, 24, w, h - 110, "Checkout")
    els += [
        ("text", x + 92, 37,
         "Inline panel inside the Cart page \u2014 MetaMask NOT connected",
         {"size": 9, "color": GREY_TEXT}),
        ("btn", x + w - 90, 30, 78, 22, "\u2715 Cancel", {"variant": "ghost",
                                                          "size": 9}),
        # order summary strip
        ("rect", x + 16, 52, w - 32, 46, {"fill": GREY_FILL,
                                          "outline": GREY_SOFT, "radius": 5}),
        ("circle", x + 40, 75, 12, {"fill": WHITE, "outline": GREY_SOFT,
                                    "text": "N", "size": 10}),
        ("text", x + 60, 62, "3 items \u00b7 2 products", {"size": 11,
                                                            "bold": True}),
        ("text", x + 60, 78, "from Nova Store", {"size": 8,
                                                 "color": GREY_TEXT}),
        ("text", x + w - 180, 60, "RM 687.00", {"size": 13, "bold": True,
                                                 "align": "right",
                                                 "box_w": 164}),
        ("text", x + w - 180, 78, "57 \u2726  \u00b7  0.057300 ETH",
         {"size": 9, "color": GREY_TEXT, "align": "right", "box_w": 164}),
        # line items
        ("text", x + 16, 108, "Aurora Hoodie  \u00d7 2", {"size": 9}),
        ("text", x + w - 140, 108, "0.090000 ETH", {"size": 9,
                                                     "align": "right",
                                                     "box_w": 124}),
        ("text", x + 16, 124, "Orbit Speaker  \u00d7 1", {"size": 9}),
        ("text", x + w - 140, 124, "0.080000 ETH", {"size": 9,
                                                     "align": "right",
                                                     "box_w": 124}),
        ("hline", x + 16, 142, w - 32),
    ]
    # wallet balance chips
    for i, (icon, lbl, val) in enumerate([("\u27e0", "ETH", "0.0000"),
                                          ("\u2726", "Elixir", "480"),
                                          ("RM", "RM value", "5,760.00")]):
        bx = x + 16 + i * ((w - 32) / 3 + 4)
        bw = (w - 32) / 3 - 4
        els += [("rect", bx, 152, bw, 40, {"fill": WHITE,
                                           "outline": GREY_SOFT,
                                           "radius": 5}),
                ("text", bx + 10, 160, lbl, {"size": 8,
                                             "color": GREY_TEXT}),
                ("text", bx + 10, 173, val, {"size": 11, "bold": True})]
    els += [("text", x + 16, 204, "CHOOSE PAYMENT METHOD",
             {"size": 8, "bold": True, "color": GREY_TEXT})]
    modes = [("ETH", "Escrow-protected ETH", "LOCKED"),
             ("Elixir", "Escrow-protected Elixir", "LOCKED"),
             ("RM", "Pay with Ringgit Malaysia", "SELECTED")]
    for i, (title, desc, state) in enumerate(modes):
        mx = x + 16 + i * ((w - 32) / 3 + 4)
        mw = (w - 32) / 3 - 4
        locked = state == "LOCKED"
        els += [
            ("rect", mx, 220, mw, 74,
             {"fill": GREY_FILL if locked else WHITE,
              "outline": GREY_SOFT if locked else BLACK,
              "width": 1 if locked else 2, "radius": 6, "dash": locked}),
            ("text", mx, 232, title, {"size": 12, "bold": True,
                                      "align": "center", "box_w": mw,
                                      "color": GREY_SOFT if locked else BLACK}),
            ("text", mx, 252, desc, {"size": 8, "align": "center",
                                     "box_w": mw, "color": GREY_TEXT}),
            ("text", mx, 272, state, {"size": 8, "bold": True,
                                      "align": "center", "box_w": mw,
                                      "color": GREY_DARK}),
        ]
    els += [
        ("rect", x + 16, 306, w - 32, 32, {"fill": GREY_FILL,
                                           "outline": GREY_DARK,
                                           "radius": 5}),
        ("text", x + 28, 316,
         "MetaMask wallet required for crypto payments.", {"size": 9,
                                                           "bold": True}),
        ("btn", x + w - 130, 310, 102, 24, "Connect Now",
         {"variant": "primary", "size": 9}),
        # cost summary
        ("rect", x + 16, 348, w - 32, 62, {"fill": WHITE,
                                           "outline": GREY_SOFT,
                                           "radius": 5}),
        ("text", x + 28, 358, "Items", {"size": 9, "color": GREY_TEXT}),
        ("text", x + w - 140, 358, "3", {"size": 9, "align": "right",
                                          "box_w": 124}),
        ("text", x + 28, 376, "Total", {"size": 10, "bold": True}),
        ("text", x + w - 140, 374, "RM 687.00", {"size": 11, "bold": True,
                                                  "align": "right",
                                                  "box_w": 124}),
        ("text", x + 28, 392,
         "\u2248 57 \u2726 Elixir \u00b7 0.057300 ETH", {"size": 8,
                                                         "color": GREY_TEXT}),
        ("field", x + 16, 420, w - 32, "\u25b8 Delivery Address",
         {"ph": "Enter your full delivery address...", "h": 40}),
        ("btn", x + 16, 486, w - 32, 34, "Confirm & Pay \u2014 RM 687.00",
         {"variant": "primary", "size": 11}),
    ]
    els += [("note", x, h - 74, w, 42,
             "Payment mode gating: ETH_ESCROW and TOKEN_ESCROW require a "
             "connected MetaMask wallet, so both cards are disabled and "
             "RM_ONLY is the only selectable option while disconnected.")]
    return {"num": "08", "title": "Checkout \u2014 Crypto Locked (No Wallet)",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "ETH / Elixir escrow disabled until MetaMask connects."}


# ========================================== 09 Checkout (ETH escrow ready) ==

def checkout_eth():
    h = 610
    els = [("rect", 1, 1, W - 2, h - 2, {"fill": (250, 250, 250),
                                         "outline": BLACK})]
    x, w = 40, W - 80
    els += card(x, 24, w, h - 110, "Checkout")
    els += [
        ("text", x + 92, 37,
         "Inline panel inside the Cart page \u2014 MetaMask connected",
         {"size": 9, "color": GREY_TEXT}),
        ("btn", x + w - 90, 30, 78, 22, "\u2715 Cancel", {"variant": "ghost",
                                                          "size": 9}),
        ("rect", x + 16, 52, w - 32, 46, {"fill": GREY_FILL,
                                          "outline": GREY_SOFT, "radius": 5}),
        ("circle", x + 40, 75, 12, {"fill": WHITE, "outline": GREY_SOFT,
                                    "text": "N", "size": 10}),
        ("text", x + 60, 62, "3 items \u00b7 2 products", {"size": 11,
                                                            "bold": True}),
        ("text", x + 60, 78, "from Nova Store", {"size": 8,
                                                 "color": GREY_TEXT}),
        ("text", x + w - 180, 60, "RM 687.00", {"size": 13, "bold": True,
                                                 "align": "right",
                                                 "box_w": 164}),
        ("text", x + w - 180, 78, "57 \u2726  \u00b7  0.057300 ETH",
         {"size": 9, "color": GREY_TEXT, "align": "right", "box_w": 164}),
        ("text", x + 16, 108, "Aurora Hoodie  \u00d7 2", {"size": 9}),
        ("text", x + w - 140, 108, "0.090000 ETH", {"size": 9,
                                                     "align": "right",
                                                     "box_w": 124}),
        ("text", x + 16, 124, "Orbit Speaker  \u00d7 1", {"size": 9}),
        ("text", x + w - 140, 124, "0.080000 ETH", {"size": 9,
                                                     "align": "right",
                                                     "box_w": 124}),
        ("hline", x + 16, 142, w - 32),
    ]
    for i, (icon, lbl, val) in enumerate([("\u27e0", "ETH", "2.4310"),
                                          ("\u2726", "Elixir", "480"),
                                          ("RM", "RM value", "5,760.00")]):
        bx = x + 16 + i * ((w - 32) / 3 + 4)
        bw = (w - 32) / 3 - 4
        els += [("rect", bx, 152, bw, 40, {"fill": WHITE,
                                           "outline": GREY_SOFT,
                                           "radius": 5}),
                ("text", bx + 10, 160, lbl, {"size": 8,
                                             "color": GREY_TEXT}),
                ("text", bx + 10, 173, val, {"size": 11, "bold": True})]
    els += [("text", x + 16, 204, "CHOOSE PAYMENT METHOD",
             {"size": 8, "bold": True, "color": GREY_TEXT})]
    modes = [("ETH", "Escrow-protected ETH", "SELECTED"),
             ("Elixir", "Escrow-protected Elixir", ""),
             ("RM", "Pay with Ringgit Malaysia", "")]
    for i, (title, desc, state) in enumerate(modes):
        mx = x + 16 + i * ((w - 32) / 3 + 4)
        mw = (w - 32) / 3 - 4
        sel = state == "SELECTED"
        els += [
            ("rect", mx, 220, mw, 74, {"fill": WHITE,
                                       "outline": BLACK if sel else GREY_SOFT,
                                       "width": 2 if sel else 1, "radius": 6}),
            ("text", mx, 232, title, {"size": 12, "bold": True,
                                      "align": "center", "box_w": mw}),
            ("text", mx, 252, desc, {"size": 8, "align": "center",
                                     "box_w": mw, "color": GREY_TEXT}),
            ("text", mx, 272, state, {"size": 8, "bold": True,
                                      "align": "center", "box_w": mw}),
        ]
    els += [
        ("rect", x + 16, 306, w - 32, 100, {"fill": WHITE,
                                            "outline": GREY_SOFT,
                                            "radius": 5}),
        ("text", x + 28, 316, "Items", {"size": 9, "color": GREY_TEXT}),
        ("text", x + w - 140, 316, "3", {"size": 9, "align": "right",
                                          "box_w": 124}),
        ("text", x + 28, 334, "Held in escrow", {"size": 10, "bold": True}),
        ("text", x + w - 140, 332, "0.057300 ETH", {"size": 11, "bold": True,
                                                     "align": "right",
                                                     "box_w": 124}),
        ("text", x + 28, 350, "\u2248 RM 687.60", {"size": 8,
                                                    "color": GREY_TEXT}),
        ("box", x + 28, 364, w - 56, 34,
         "Your ETH is locked in the escrow smart contract. The seller is paid "
         "only after you confirm delivery in Track Order. You can raise a "
         "dispute before releasing.",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 8,
          "color": GREY_DARK, "align": "left"}),
        ("field", x + 16, 416, w - 32, "\u25b8 Delivery Address",
         {"ph": "12 Jalan Ampang, 50450 Kuala Lumpur", "h": 36}),
        ("btn", x + 16, 476, w - 32, 32,
         "Confirm & Pay \u2014 0.057300 ETH to escrow",
         {"variant": "primary", "size": 11}),
        ("text", x + 16, 514,
         "You'll earn 57 Elixir loyalty tokens when you confirm delivery",
         {"size": 9, "color": GREY_TEXT, "align": "center", "box_w": w - 32}),
    ]
    els += [("note", x, h - 68, w, 36,
             "Elixir escrow behaves the same but needs two MetaMask signatures "
             "(approve, then lock) and warns when the balance is short.")]
    return {"num": "09", "title": "Checkout \u2014 ETH Escrow Selected",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Wallet connected: escrow summary and loyalty reward "
                       "preview."}


# ============================================= 10 Checkout success state ====

def checkout_success():
    h = 430
    els = [("rect", 1, 1, W - 2, h - 2, {"fill": (250, 250, 250),
                                         "outline": BLACK})]
    x, w = (W - 480) / 2, 480
    els += card(x, 40, w, 320)
    els += [
        ("circle", x + w / 2, 84, 22, {"fill": WHITE, "outline": GREY_DARK,
                                       "text": "\u2713", "size": 16}),
        ("text", x, 116, "Payment Successful!", {"size": 17, "bold": True,
                                                  "align": "center",
                                                  "box_w": w}),
        ("hline", x + 24, 146, w - 48),
    ]
    rows = [("Order ID", "3f9c1a4e\u20268b21"),
            ("Payment Mode", "ETH_ESCROW"),
            ("ETH Paid", "0.057300 ETH"),
            ("Elixir Spent", "\u2014")]
    for i, (k, v) in enumerate(rows):
        ry = 156 + i * 22
        els += [("text", x + 24, ry, k, {"size": 9, "color": GREY_TEXT}),
                ("text", x + w - 224, ry, v, {"size": 9, "bold": True,
                                               "align": "right",
                                               "box_w": 200})]
    els += [
        ("text", x + 24, 250, "TRANSACTION HASH", {"size": 8, "bold": True,
                                                    "color": GREY_TEXT}),
        ("box", x + 24, 262, w - 48, 24, "0x8d41\u2026e7ba",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 9,
          "align": "left"}),
        ("text", x, 294,
         "Elixir loyalty tokens have been added to your wallet",
         {"size": 9, "color": GREY_TEXT, "align": "center", "box_w": w}),
        ("btn", x + 24, 316, w - 48, 30, "Place Another Order",
         {"variant": "ghost", "size": 10}),
        ("note", x, 372, w, 40,
         "The success panel replaces the whole checkout form. The order is now "
         "visible under Track Order with escrow status \u201cIn escrow\u201d."),
    ]
    return {"num": "10", "title": "Checkout \u2014 Payment Successful",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Confirmation state with on-chain transaction hash."}


# ===================================================== 11 Wallet page =======

def wallet():
    h = 620
    els = sidebar(h, "customer", 2, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Wallet", "Balances, Swap & Transfers")
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y + 40, tw, "ETH Balance", "2.4310",
                "MetaMask \u00b7 \u2248 RM 29,172.00")
    els += tile(CX + tw + 12, BODY_Y + 40, tw, "Elixir Balance", "480 \u2726",
                "\u2248 RM 5,760.00")
    els += tile(CX + 2 * (tw + 12), BODY_Y + 40, tw, "RM Balance",
                "RM 320.00", "\u2248 27 \u2726 Elixir")

    sy = BODY_Y + 124
    els += card(CX, sy, CW, 168, "Currency Swap",
                sub="1 ETH = RM 12,000   |   1 \u2726 = RM 12")
    third = (CW - 60) / 3
    els += [
        ("field", CX + 16, sy + 46, third, "From", {"ph": "ETH",
                                                     "select": True}),
        ("btn", CX + 16 + third + 8, sy + 58, 28, 26, "<>",
         {"variant": "ghost", "size": 11}),
        ("field", CX + 16 + third + 44, sy + 46, third, "To",
         {"ph": "Elixir", "select": True}),
        ("field", CX + 16 + 2 * third + 52, sy + 46, third - 8, "ETH amount",
         {"ph": "0.5000"}),
        ("rect", CX + 16, sy + 98, CW - 32, 30, {"fill": GREY_FILL,
                                                  "outline": GREY_SOFT,
                                                  "radius": 5}),
        ("text", CX + 28, sy + 107, "You receive", {"size": 9,
                                                     "color": GREY_TEXT}),
        ("text", CX + CW - 200, sy + 105, "500.0000 Elixir",
         {"size": 11, "bold": True, "align": "right", "box_w": 184}),
        ("btn", CX + 16, sy + 134, CW - 32, 26,
         "\u21c4  Swap ETH \u2192 ELIXIR", {"variant": "primary", "size": 10}),
    ]

    ay = sy + 184
    half = (CW - 12) / 2
    els += card(CX, ay, half, 152, "Deposit RM")
    els += [
        ("field", CX + 16, ay + 40, half - 32, "Amount", {"ph": "Amount (RM)"}),
        ("btn", CX + 16, ay + 92, half - 32, 28, "Deposit",
         {"variant": "primary", "size": 10}),
        ("text", CX + 16, ay + 128, "Off-chain ledger top-up (no gas fee)",
         {"size": 8, "color": GREY_TEXT}),
    ]
    els += card(CX + half + 12, ay, half, 152, "Transfer Funds")
    tx = CX + half + 28
    els += [
        ("field", tx, ay + 40, half - 32, "Currency", {"ph": "Elixir",
                                                        "select": True}),
        ("field", tx, ay + 84, (half - 40) / 2, "Recipient",
         {"ph": "Recipient wallet address"}),
        ("field", tx + (half - 40) / 2 + 8, ay + 84, (half - 40) / 2,
         "Amount", {"ph": "Elixir amount"}),
        ("btn", tx, ay + 122, half - 32, 22, "Transfer Elixir",
         {"variant": "primary", "size": 10}),
    ]
    els += [("note", CX, h - 70, CW, 42,
             "ETH and Elixir legs of a swap or transfer move real assets and "
             "therefore require MetaMask; the button is replaced with a "
             "\u201cConnect MetaMask\u201d prompt while disconnected. RM stays "
             "off-chain in the customer_wallet ledger.")]
    return {"num": "11", "title": "Wallet \u2014 Balances, Swap & Transfers",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /wallet \u2014 three-currency balances, swap "
                       "widget, RM deposit and peer transfer."}


# ================================================ 12 Staking (main page) ====

def staking():
    h = 660
    els = sidebar(h, "customer", 3, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Staking",
                        "Stake Elixir & Earn Compound Rewards")
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y + 40, tw, "Available Elixir", "480 \u2726",
                "\u2248 RM 5,760.00")
    els += tile(CX + tw + 12, BODY_Y + 40, tw, "Total Staked", "1,200 \u2726",
                "\u2248 RM 14,400.00")
    els += tile(CX + 2 * (tw + 12), BODY_Y + 40, tw, "Total Earned",
                "+63.40 \u2726", "Compound interest")

    ty = BODY_Y + 124
    els += [("text", CX, ty, "Select Staking Period", {"size": 12,
                                                        "bold": True})]
    tiers = [("8%", "30 Days", "Flexible short-term"),
             ("14%", "90 Days", "Balanced returns"),
             ("22%", "180 Days", "High yield"),
             ("35%", "365 Days", "Maximum rewards")]
    cw4 = (CW - 36) / 4
    for i, (apy, label, desc) in enumerate(tiers):
        tx = CX + i * (cw4 + 12)
        sel = i == 1
        els += [
            ("rect", tx, ty + 22, cw4, 78,
             {"fill": WHITE, "outline": BLACK if sel else GREY_SOFT,
              "width": 2 if sel else 1, "radius": 6}),
            ("text", tx, ty + 32, apy, {"size": 20, "bold": True,
                                         "align": "center", "box_w": cw4}),
            ("text", tx, ty + 56, "APY", {"size": 7, "bold": True,
                                           "align": "center", "box_w": cw4,
                                           "color": GREY_TEXT}),
            ("text", tx, ty + 68, label, {"size": 10, "bold": True,
                                           "align": "center", "box_w": cw4}),
            ("text", tx, ty + 82, desc, {"size": 8, "align": "center",
                                          "box_w": cw4, "color": GREY_TEXT}),
        ]

    cy = ty + 116
    els += card(CX, cy, CW, 214, "Stake Elixir")
    els += [
        ("btn", CX + CW - 220, cy + 8, 208, 22,
         "Compounds Monthly (12x/year)", {"variant": "tag", "size": 8,
                                          "round": True}),
        ("field", CX + 16, cy + 38, CW - 96, "Amount to Stake (Elixir)",
         {"ph": "500"}),
        ("btn", CX + CW - 70, cy + 50, 54, 26, "MAX", {"variant": "ghost",
                                                        "size": 9}),
        ("rect", CX + 16, cy + 84, CW - 32, 76, {"fill": GREY_FILL,
                                                  "outline": GREY_SOFT,
                                                  "radius": 5}),
        ("text", CX + 28, cy + 92, "PROJECTED RETURNS (90 DAYS)",
         {"size": 8, "bold": True, "color": GREY_TEXT}),
    ]
    proj = [("Staked", "500 \u2726"), ("Interest Earned", "+16.10 \u2726"),
            ("Total After 90 Days", "516.10 \u2726"),
            ("Effective Rate", "3.22%")]
    for i, (k, v) in enumerate(proj):
        px = CX + 28 + (i % 2) * ((CW - 72) / 2)
        py = cy + 110 + (i // 2) * 26
        els += [("text", px, py, k, {"size": 8, "color": GREY_TEXT}),
                ("text", px, py + 11, v, {"size": 11, "bold": True})]
    els += [("btn", CX + 16, cy + 170, CW - 32, 32,
             "Stake 500 ELX for 90 Days at 14% APY",
             {"variant": "primary", "size": 11})]

    py = cy + 236
    els += [("text", CX, py, "Active Staking Positions", {"size": 12,
                                                           "bold": True})]
    els += card(CX, py + 20, CW, 86)
    els += [
        ("text", CX + 14, py + 30, "1,200 ELX staked", {"size": 12,
                                                        "bold": True}),
        ("text", CX + 14, py + 46,
         "90 Days  |  14% APY  |  Started 10 Apr 2026", {"size": 9,
                                                          "color": GREY_TEXT}),
        ("text", CX + CW - 150, py + 28, "EARNED", {"size": 7, "bold": True,
                                                     "color": GREY_TEXT,
                                                     "align": "right",
                                                     "box_w": 136}),
        ("text", CX + CW - 150, py + 40, "+42.30 \u2726", {"size": 12,
                                                            "bold": True,
                                                            "align": "right",
                                                            "box_w": 136}),
        ("progress", CX + 14, py + 66, CW - 28, 87),
        ("text", CX + 14, py + 80, "78 days elapsed", {"size": 8,
                                                        "color": GREY_TEXT}),
        ("text", CX + CW - 150, py + 80, "12 days remaining",
         {"size": 8, "color": GREY_TEXT, "align": "right", "box_w": 136}),
    ]
    return {"num": "12", "title": "Staking \u2014 Tiers, Calculator & Positions",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /staking \u2014 the new sidebar section: staking "
                       "performance, APY tiers and compound-interest "
                       "projection."}


# ==================================== 13 Staking (matured / claim state) ====

def staking_matured():
    h = 460
    els = sidebar(h, "customer", 3, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Staking",
                        "Stake Elixir & Earn Compound Rewards")
    els += [("text", CX, BODY_Y + 42, "Active Staking Positions",
             {"size": 12, "bold": True})]

    els += card(CX, BODY_Y + 64, CW, 118)
    els += [
        ("text", CX + 14, BODY_Y + 74, "1,200 ELX staked", {"size": 12,
                                                            "bold": True}),
        ("text", CX + 14, BODY_Y + 90,
         "90 Days  |  14% APY  |  Started 10 Jan 2026", {"size": 9,
                                                          "color": GREY_TEXT}),
        ("text", CX + CW - 150, BODY_Y + 72, "EARNED",
         {"size": 7, "bold": True, "color": GREY_TEXT, "align": "right",
          "box_w": 136}),
        ("text", CX + CW - 150, BODY_Y + 84, "+42.30 \u2726",
         {"size": 12, "bold": True, "align": "right", "box_w": 136}),
        ("progress", CX + 14, BODY_Y + 110, CW - 28, 100),
        ("text", CX + 14, BODY_Y + 124, "90 days elapsed", {"size": 8,
                                                             "color": GREY_TEXT}),
        ("text", CX + CW - 150, BODY_Y + 124, "Mature!",
         {"size": 8, "bold": True, "align": "right", "box_w": 136}),
        ("btn", CX + 14, BODY_Y + 144, CW - 28, 26,
         "Claim & Unstake (1,242.30 \u2726)", {"variant": "primary",
                                               "size": 10}),
    ]
    els += card(CX, BODY_Y + 196, CW, 96, "How Compound Interest Works")
    els += [
        ("para", CX + 14, BODY_Y + 226, CW - 28,
         "Your staked Elixir earns interest that compounds monthly. Rewards "
         "are added to your principal each month, so you earn interest on "
         "your interest.", {"size": 9}),
        ("box", CX + 14, BODY_Y + 254, CW - 28, 30,
         "Formula:  A = P(1 + r/n)^(nt)      "
         "P = Principal | r = Annual rate | n = Compounds per year (12) | "
         "t = Time in years",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 8,
          "align": "left"}),
    ]
    els += [("note", CX, h - 62, CW, 38,
             "The Claim & Unstake button only appears once maturityAt has "
             "passed. Before that the position shows the days remaining and "
             "no action.")]
    return {"num": "13", "title": "Staking \u2014 Matured Position (Unstake)",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Mature position with claim action and the compound "
                       "interest formula."}


# ============================================== 14 Track Order (list) =======

def track_list():
    h = 470
    els = sidebar(h, "customer", 4, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Track Order",
                        "Your Orders & Delivery Progress")
    els += [
        ("btn", CX, BODY_Y + 38, 150, 28, "On-going   3", {"variant": "active",
                                                            "size": 10}),
        ("btn", CX + 158, BODY_Y + 38, 150, 28, "Completed   7",
         {"variant": "ghost", "size": 10}),
        ("btn", CX + CW - 96, BODY_Y + 38, 96, 28, "\u21bb Refresh",
         {"variant": "ghost", "size": 10}),
    ]
    rows = [("Aurora Hoodie", "ETH_ESCROW \u00b7 qty 2 \u00b7 12 Jun 2026",
             "Shipped"),
            ("3 products", "TOKEN_ESCROW \u00b7 qty 4 \u00b7 08 Jun 2026",
             "Packed"),
            ("Snack Box", "RM_ONLY \u00b7 qty 1 \u00b7 02 Jun 2026",
             "Processing")]
    for i, (name, meta, stage) in enumerate(rows):
        ry = BODY_Y + 80 + i * 58
        els += card(CX, ry, CW, 50)
        els += [
            ("circle", CX + 26, ry + 25, 12, {"fill": GREY_FILL,
                                              "outline": GREY_SOFT,
                                              "text": name[0], "size": 10}),
            ("text", CX + 48, ry + 12, name, {"size": 11, "bold": True}),
            ("text", CX + 48, ry + 28, meta, {"size": 8,
                                              "color": GREY_TEXT}),
            ("btn", CX + CW - 140, ry + 15, 100, 20, stage,
             {"variant": "tag", "size": 9, "round": True}),
            ("text", CX + CW - 28, ry + 20, "\u25be", {"size": 9,
                                                       "color": GREY_TEXT}),
        ]
    els += [("note", CX, h - 96, CW, 66,
             "Tab split rule: an order moves to Completed when the "
             "fulfillment stage reaches Delivered (4), when escrow is released "
             "or refunded, or when the order is cancelled. Everything else "
             "stays under On-going. Clicking a row expands the detail panel in "
             "the next wireframe.")]
    return {"num": "14", "title": "Track Order \u2014 On-going / Completed",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /track-order \u2014 collapsed order list with "
                       "stage badges."}


# ======================================= 15 Track Order (expanded escrow) ===

def track_expanded():
    h = 700
    els = sidebar(h, "customer", 4, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Track Order",
                        "Your Orders & Delivery Progress")
    ry = BODY_Y + 40
    els += card(CX, ry, CW, 496)
    els += [
        ("circle", CX + 26, ry + 25, 12, {"fill": GREY_FILL,
                                          "outline": GREY_SOFT, "text": "A",
                                          "size": 10}),
        ("text", CX + 48, ry + 12, "Aurora Hoodie", {"size": 11,
                                                      "bold": True}),
        ("text", CX + 48, ry + 28,
         "ETH_ESCROW \u00b7 qty 2 \u00b7 12 Jun 2026", {"size": 8,
                                                         "color": GREY_TEXT}),
        ("btn", CX + CW - 140, ry + 15, 100, 20, "Shipped",
         {"variant": "tag", "size": 9, "round": True}),
        ("text", CX + CW - 28, ry + 20, "\u25b4", {"size": 9,
                                                   "color": GREY_TEXT}),
        ("hline", CX + 12, ry + 52, CW - 24),
        ("steps", CX + 40, ry + 66, CW - 80, ORDER_STEPS, {"done": 3}),
    ]
    summary = [("Order ID", "3f9c1a4e\u20268b21"), ("Seller", "Nova Store"),
               ("Payment Mode", "ETH_ESCROW"), ("Quantity", "2"),
               ("Total", "0.090000 ETH"),
               ("Delivery", "12 Jalan Ampang, 50450 KL")]
    for i, (k, v) in enumerate(summary):
        sx = CX + 16 + (i % 3) * ((CW - 32) / 3)
        sy = ry + 116 + (i // 3) * 34
        els += [("text", sx, sy, k.upper(), {"size": 7, "bold": True,
                                             "color": GREY_TEXT}),
                ("text", sx, sy + 11, v, {"size": 10,
                                          "max_w": (CW - 32) / 3 - 10})]
    iy = ry + 190
    els += [
        ("rect", CX + 16, iy, CW - 32, 46, {"fill": GREY_FILL,
                                            "outline": GREY_SOFT,
                                            "radius": 4}),
        ("text", CX + 28, iy + 8, "ITEMS (2)", {"size": 7, "bold": True,
                                                "color": GREY_TEXT}),
        ("text", CX + 28, iy + 24, "Aurora Hoodie  \u00d7 2", {"size": 9}),
        ("text", CX + CW - 160, iy + 24, "0.090000 ETH",
         {"size": 9, "align": "right", "box_w": 132}),
        ("text", CX + 16, iy + 58, "TRANSACTION HASH", {"size": 7,
                                                         "bold": True,
                                                         "color": GREY_TEXT}),
        ("box", CX + 16, iy + 70, (CW - 44) / 2, 24, "0x8d41\u2026e7ba",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 9,
          "align": "left"}),
        ("rect", CX + 16 + (CW - 44) / 2 + 12, iy + 70, (CW - 44) / 2, 24,
         {"fill": WHITE, "outline": GREY_SOFT, "radius": 4}),
        ("text", CX + 28 + (CW - 44) / 2 + 12, iy + 77, "Elixir Earned",
         {"size": 9, "color": GREY_TEXT}),
        ("text", CX + CW - 160, iy + 77, "90 ELX", {"size": 9, "bold": True,
                                                    "align": "right",
                                                    "box_w": 132}),
    ]
    ey = iy + 108
    els += [
        ("rect", CX + 16, ey, CW - 32, 116, {"fill": WHITE,
                                             "outline": GREY_DARK,
                                             "radius": 6}),
        ("text", CX + 28, ey + 10, "Escrow Protection", {"size": 11,
                                                          "bold": True}),
        ("btn", CX + CW - 130, ey + 8, 102, 20, "In escrow",
         {"variant": "tag", "size": 9, "round": True}),
        ("para", CX + 28, ey + 32, CW - 56,
         "Your payment is locked in the escrow contract. Once you've received "
         "the item, confirm delivery to release the funds to the seller \u2014 "
         "you'll earn your Elixir rewards and an NFT receipt. If something's "
         "wrong, raise a dispute instead.", {"size": 9}),
        ("btn", CX + 28, ey + 80, (CW - 68) / 2, 26,
         "Confirm Delivery & Release", {"variant": "primary", "size": 10}),
        ("btn", CX + 28 + (CW - 68) / 2 + 12, ey + 80, (CW - 68) / 2, 26,
         "Raise Dispute", {"variant": "ghost", "size": 10}),
    ]
    ly = ey + 128
    els += [
        ("text", CX + 16, ly, "BLOCKCHAIN AUDIT LOG", {"size": 7,
                                                        "bold": True,
                                                        "color": GREY_TEXT}),
        ("table", CX + 16, ly + 12, CW - 32,
         ["Event", "Buyer", "Seller", "Block #"],
         [["EscrowCreated", "0x71C7\u20269e3F", "0xA43b\u20261c07", "6421887"]],
         {"colw": [2, 2.4, 2.4, 1.4], "rh": 20, "hh": 22}),
    ]
    els += [("note", CX, h - 74, CW, 44,
             "Escrow status drives this panel: funded shows the two action "
             "buttons (or a Connect MetaMask prompt when disconnected), "
             "disputed shows an \u201cadmin will review\u201d message, "
             "released and refunded show a closing message with the NFT "
             "receipt strip.")]
    return {"num": "15", "title": "Track Order \u2014 Expanded Order + Escrow",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Delivery timeline, order summary, escrow actions and "
                       "on-chain audit log."}


# ============================================ 16 Track Order (disputed) =====

def track_disputed():
    h = 440
    els = sidebar(h, "customer", 4, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Track Order",
                        "Your Orders & Delivery Progress")
    els += toast(BODY_Y + 38,
                 "\u2713  Dispute raised. The platform will review it.")
    y = BODY_Y + 76
    for i, (status, text) in enumerate([
        ("Under dispute",
         "You've disputed this order. The platform admin will review it and "
         "either refund you or release the funds."),
        ("Released to seller",
         "Funds released to the seller. Thanks for confirming!"),
        ("Refunded to you",
         "This order was refunded to your wallet."),
    ]):
        by = y + i * 74
        els += [
            ("rect", CX, by, CW, 62, {"fill": WHITE, "outline": GREY_DARK,
                                      "radius": 6}),
            ("text", CX + 14, by + 10, "Escrow Protection", {"size": 10,
                                                              "bold": True}),
            ("btn", CX + CW - 150, by + 8, 136, 20, status,
             {"variant": "tag", "size": 9, "round": True}),
            ("para", CX + 14, by + 30, CW - 170, text, {"size": 9}),
        ]
    els += [
        ("rect", CX, y + 224, CW, 40, {"fill": GREY_FILL,
                                       "outline": GREY_SOFT, "radius": 6}),
        ("text", CX + 14, y + 232, "NFT Purchase Receipt", {"size": 10,
                                                             "bold": True}),
        ("text", CX + 14, y + 246,
         "Token #17 \u00b7 verifiable proof of purchase in your wallet",
         {"size": 8, "color": GREY_TEXT}),
    ]
    return {"num": "16",
            "title": "Track Order \u2014 Escrow Outcome States",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Disputed, released and refunded escrow panels plus the "
                       "minted NFT receipt strip."}


# ===================================================== 17 History page ======

def history():
    h = 500
    els = sidebar(h, "customer", 5, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "History",
                        "Purchases, Swaps, Staking & Transfers")
    for i, f in enumerate(["All", "Orders", "Swaps", "Staking", "Transfers"]):
        els.append(("btn", CX + i * 96, BODY_Y + 36, 88, 24, f,
                    {"variant": "active" if i == 0 else "ghost",
                     "round": True, "size": 9}))
    feed = [
        ("Aurora Hoodie", "ETH_ESCROW \u00b7 qty 2 \u00b7 12 Jun 2026",
         "completed", "View \u2192"),
        ("Swap ETH \u2192 ELIXIR", "0.5000 ETH \u2192 500 \u2726 \u00b7 10 Jun 2026",
         "completed", ""),
        ("Staked Elixir", "1,200 \u2726 \u00b7 90 days \u00b7 10 Apr 2026",
         "completed", ""),
        ("Elixir Sent", "120 \u2726 to 0xA43b\u2026 \u00b7 04 Jun 2026",
         "completed", ""),
        ("RM Deposit", "+RM 500.00 \u00b7 01 Jun 2026", "completed", ""),
    ]
    for i, (title, meta, status, action) in enumerate(feed):
        ry = BODY_Y + 74 + i * 56
        els += card(CX, ry, CW, 48)
        els += [
            ("circle", CX + 26, ry + 24, 11, {"fill": GREY_FILL,
                                              "outline": GREY_SOFT,
                                              "text": title[0], "size": 9}),
            ("text", CX + 46, ry + 10, title, {"size": 10, "bold": True}),
            ("text", CX + 46, ry + 26, meta, {"size": 8,
                                              "color": GREY_TEXT}),
            ("btn", CX + CW - 190, ry + 14, 88, 20, status,
             {"variant": "tag", "size": 8, "round": True}),
        ]
        if action:
            els.append(("btn", CX + CW - 92, ry + 14, 78, 20, action,
                        {"variant": "ghost", "size": 8}))
    els += [("note", CX, h - 72, CW, 44,
             "The feed merges orders with wallet_transactions rows (SWAP, "
             "TRANSFER_IN / OUT, DEPOSIT, STAKE, UNSTAKE) newest first. "
             "\u201cView\u201d jumps to the matching order on Track Order.")]
    return {"num": "17", "title": "History \u2014 Unified Activity Feed",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /history \u2014 filter pills over a merged order "
                       "and wallet-transaction feed."}


# ================================================= 18 Profile (view) =======

def profile_view():
    h = 430
    els = sidebar(h, "customer", 6, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Profile", "Your Account & Identity",
                        right_btn="\u270e Edit Profile", right_w=120)
    half = (CW - 12) / 2
    els += card(CX, BODY_Y + 44, half, 236, "Account Details")
    rows = [("Name", "Ali Rahman"), ("Account Number", "U0001"),
            ("Email", "ali@example.com"), ("Phone", "012-3456789"),
            ("Delivery Address", "12 Jalan Ampang, 50450 KL"),
            ("Role", "customer"), ("Member Since", "14 Feb 2026")]
    for i, (k, v) in enumerate(rows):
        ry = BODY_Y + 74 + i * 28
        els += [("text", CX + 14, ry, k.upper(), {"size": 7, "bold": True,
                                                  "color": GREY_TEXT}),
                ("text", CX + 14, ry + 10, v, {"size": 10,
                                               "max_w": half - 28}),
                ("hline", CX + 14, ry + 24, half - 28)]
    els += card(CX + half + 12, BODY_Y + 44, half, 236, "Wallet Identity")
    wx = CX + half + 26
    wrows = [("Wallet Address", "0x9F12\u20264dA8"),
             ("MetaMask Address", "0x71C7\u20269e3F"),
             ("Live Elixir", "480 \u2726"),
             ("RM Equivalent", "RM 5,760.00"),
             ("ETH Balance", "2.4310 ETH")]
    for i, (k, v) in enumerate(wrows):
        ry = BODY_Y + 74 + i * 28
        els += [("text", wx, ry, k.upper(), {"size": 7, "bold": True,
                                             "color": GREY_TEXT}),
                ("text", wx, ry + 10, v, {"size": 10, "max_w": half - 28}),
                ("hline", wx, ry + 24, half - 28)]
    els += [("note", CX, BODY_Y + 296, CW, 44,
             "Read-only view. Wallet Address is generated by the platform and "
             "MetaMask Address is filled the first time a wallet is linked; "
             "neither can be edited by the customer.")]
    return {"num": "18", "title": "Profile \u2014 View Mode",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Route /profile \u2014 account details beside wallet "
                       "identity."}


# ================================================= 19 Profile (edit) =======

def profile_edit():
    h = 530
    els = sidebar(h, "customer", 6, brand="Elixir Commerce",
                  kicker="Customer Portal",
                  extra_cards=[customer_snapshot(True)])
    els += topbar("Customer Dashboard", "Welcome back, Ali",
                  right=metamask_chip() + profile_chip("customer",
                                                       "0x71C7\u20269e3F"))
    els += section_head(BODY_Y, "Profile", "Your Account & Identity")
    els += toast(BODY_Y + 38, "\u2713  Profile updated successfully.")
    half = (CW - 12) / 2
    els += card(CX, BODY_Y + 76, half, 268, "Account Details")
    fx = CX + 14
    fw = half - 28
    els += [
        ("field", fx, BODY_Y + 106, fw, "Full Name", {"ph": "Your name"}),
        ("field", fx, BODY_Y + 150, fw, "Email", {"ph": "you@example.com"}),
        ("field", fx, BODY_Y + 194, fw, "Phone", {"ph": "e.g. 012-3456789"}),
        ("field", fx, BODY_Y + 238, fw, "Delivery Address",
         {"ph": "Street, city, postcode", "h": 34}),
        ("field", fx, BODY_Y + 290, fw, "Account Number",
         {"ph": "U0001", "disabled": True}),
    ]
    els += card(CX + half + 12, BODY_Y + 76, half, 268, "Security")
    sx = CX + half + 26
    els += [
        ("field", sx, BODY_Y + 106, fw, "Current Password",
         {"ph": "Enter current password"}),
        ("field", sx, BODY_Y + 150, fw, "New Password",
         {"ph": "At least 6 characters"}),
        ("field", sx, BODY_Y + 194, fw, "Confirm New Password",
         {"ph": "Re-enter new password"}),
        ("text", sx, BODY_Y + 236, "Cancel password change",
         {"size": 9, "color": GREY_TEXT}),
        ("hline", sx, BODY_Y + 252, fw),
        ("text", sx, BODY_Y + 260, "Wallet Identity", {"size": 10,
                                                        "bold": True}),
        ("para", sx, BODY_Y + 276, fw,
         "Wallet addresses are managed automatically and cannot be edited "
         "here.", {"size": 8}),
    ]
    els += [
        ("btn", CX, BODY_Y + 358, 160, 30, "Save Changes",
         {"variant": "primary", "size": 10}),
        ("btn", CX + 172, BODY_Y + 358, 120, 30, "Cancel",
         {"variant": "ghost", "size": 10}),
        ("note", CX, BODY_Y + 400, CW, 30,
         "Validation messages: name required, valid email, new password min 6 "
         "characters, confirmation must match."),
    ]
    return {"num": "19", "title": "Profile \u2014 Edit Mode & Password Change",
            "group": "Customer", "w": W, "h": h, "elements": els,
            "caption": "Editable account fields with an optional password "
                       "change block."}


# =============================================== 20 Seller create product ===

def seller_create():
    h = 716
    els = sidebar(h, "seller", 0, brand="\u2302 Elixir Commerce",
                  kicker="Seller Portal",
                  extra_cards=[("Your Store", ["Nova Store",
                                               "6 product(s) listed"], 50),
                               ("Payments Wallet", ["0xA43b\u20261c07",
                                                    "2.4310 ETH"], 50)])
    els += topbar("Seller Dashboard", "Create Product",
                  right=profile_chip("merchant", "U0007"))
    els += card(CX, BODY_Y, CW, 296, "\uff0b New Product")
    fw = (CW - 44) / 2
    els += [
        ("field", CX + 16, BODY_Y + 36, fw, "Product Name",
         {"ph": "e.g. Aurora Hoodie"}),
        ("field", CX + 28 + fw, BODY_Y + 36, fw, "Category",
         {"ph": "clothes", "select": True}),
        ("field", CX + 16, BODY_Y + 84, fw, "Price (RM)", {"ph": "0.00"}),
        ("text", CX + 16, BODY_Y + 124, "\u2248 0.017917 ETH",
         {"size": 8, "color": GREY_TEXT}),
        ("field", CX + 28 + fw, BODY_Y + 84, fw, "Stock", {"ph": "0"}),
        ("field", CX + 16, BODY_Y + 140, CW - 32, "Image URL (optional)",
         {"ph": "https://\u2026"}),
        ("field", CX + 16, BODY_Y + 184, CW - 32, "Description",
         {"ph": "Describe your product\u2026", "h": 34}),
    ]
    els += [
        ("btn", CX + 16, BODY_Y + 252, 160, 28, "\uff0b Create Product",
         {"variant": "primary", "size": 10}),
    ]
    py = BODY_Y + 310
    els += card(CX, py, CW, 262, "Your Products (6)")
    for i in range(3):
        px = CX + 16 + i * ((CW - 44) / 3 + 6)
        pw = (CW - 44) / 3 - 6
        live = i != 2
        els += [
            ("rect", px, py + 34, pw, 208, {"fill": WHITE,
                                            "outline": GREY_SOFT if live
                                            else GREY_MID, "radius": 6}),
            ("btn", px + 8, py + 44, 52, 15, "clothes", {"variant": "tag",
                                                          "size": 7,
                                                          "round": True}),
            ("btn", px + pw - 54, py + 44, 46, 15, "Live" if live else "Hidden",
             {"variant": "tag", "size": 7, "round": True}),
            ("text", px + 8, py + 68, "Aurora Hoodie", {"size": 10,
                                                         "bold": True}),
            ("para", px + 8, py + 84, pw - 16,
             "Soft everyday hoodie with a clean storefront finish.",
             {"size": 8}),
            ("hline", px + 8, py + 122, pw - 16),
            ("text", px + 8, py + 130, "RM 215.00", {"size": 11,
                                                      "bold": True}),
            ("text", px + 8, py + 146, "0.0450 ETH", {"size": 8,
                                                       "color": GREY_TEXT}),
            ("text", px + 8, py + 162, "12 in stock" if live
             else "Out of stock", {"size": 8, "color": GREY_TEXT}),
            ("btn", px + 8, py + 180, (pw - 24) / 2, 22, "\u270e Edit",
             {"variant": "ghost", "size": 9}),
            ("btn", px + 16 + (pw - 24) / 2, py + 180, (pw - 24) / 2, 22,
             "Deactivate" if live else "Reactivate", {"variant": "ghost",
                                                      "size": 9}),
        ]
    els += [("note", CX, h - 74, CW, 44,
             "Creating or reactivating a product is checked against the "
             "seller's subscription plan limit (Starter 3, Pro 10, Enterprise "
             "unlimited). Exceeding it returns \u201cYour {Plan} plan allows "
             "up to N active products. Upgrade your plan to list more.\u201d")]
    return {"num": "20", "title": "Seller \u2014 Create / Manage Products",
            "group": "Seller (Merchant)", "w": W, "h": h, "elements": els,
            "caption": "Product form plus the seller's catalogue with "
                       "Live / Hidden status."}


# ================================================ 21 Seller order tracking ==

def seller_orders():
    h = 578
    els = sidebar(h, "seller", 1, brand="\u2302 Elixir Commerce",
                  kicker="Seller Portal",
                  extra_cards=[("Your Store", ["Nova Store",
                                               "6 product(s) listed"], 50),
                               ("Payments Wallet", ["0xA43b\u20261c07",
                                                    "2.4310 ETH"], 50)])
    els += topbar("Seller Dashboard", "Track Purchase Order",
                  right=profile_chip("merchant", "U0007"))
    for i, (title, stage, done) in enumerate([
            ("Aurora Hoodie  \u00b7 2 item(s)", "Shipped", 3),
            ("3 products  \u00b7 4 item(s)", "Processing", 1)]):
        oy = BODY_Y + i * 208
        els += card(CX, oy, CW, 192)
        els += [
            ("text", CX + 16, oy + 12, title, {"size": 11, "bold": True}),
            ("text", CX + 16, oy + 30,
             "Buyer: Ali Rahman \u00b7 0x71C7\u20269e3F", {"size": 8,
                                                            "color": GREY_TEXT}),
            ("text", CX + 16, oy + 44,
             "ETH_ESCROW \u00b7 0.0900 ETH \u00b7 12 Jun 2026",
             {"size": 8, "color": GREY_TEXT}),
            ("text", CX + 16, oy + 58,
             "\u25b8 12 Jalan Ampang, 50450 Kuala Lumpur", {"size": 8,
                                                             "color": GREY_TEXT}),
            ("btn", CX + CW - 130, oy + 12, 114, 20, stage,
             {"variant": "tag", "size": 9, "round": True}),
            ("steps", CX + 40, oy + 84, CW - 80, ORDER_STEPS, {"done": done}),
            ("btn", CX + 16, oy + 148, 220, 28,
             f"Advance \u2192 {ORDER_STEPS[done + 1]}",
             {"variant": "primary", "size": 10}),
            ("field", CX + 250, oy + 136, 220, "Set stage",
             {"ph": f"{done}. {ORDER_STEPS[done]}", "select": True}),
        ]
    els += [("note", CX, h - 90, CW, 60,
             "The seller only controls fulfillment stage (0 Order placed \u2192 "
             "4 Delivered). Money movement is separate: escrowed ETH or Elixir "
             "is released by the buyer confirming delivery, or by an admin "
             "resolving a dispute.")]
    return {"num": "21", "title": "Seller \u2014 Update Fulfillment Stage",
            "group": "Seller (Merchant)", "w": W, "h": h, "elements": els,
            "caption": "Per-order delivery timeline with Advance and direct "
                       "stage selection."}


# ===================================================== 22 Seller revenue ====

def seller_revenue():
    h = 530
    els = sidebar(h, "seller", 2, brand="\u2302 Elixir Commerce",
                  kicker="Seller Portal",
                  extra_cards=[("Your Store", ["Nova Store",
                                               "6 product(s) listed"], 50),
                               ("Payments Wallet", ["0xA43b\u20261c07",
                                                    "2.4310 ETH"], 50)])
    els += topbar("Seller Dashboard", "Revenue",
                  right=profile_chip("merchant", "U0007"))
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y, tw, "Total Revenue", "1.8420 ETH",
                "\u2248 RM 22,104.00")
    els += tile(CX + tw + 12, BODY_Y, tw, "Total Orders", "34",
                "78 items sold")
    els += tile(CX + 2 * (tw + 12), BODY_Y, tw, "In Progress", "6",
                "28 delivered")
    els += card(CX, BODY_Y + 88, CW, 176, "Product Performance")
    els += [("table", CX + 16, BODY_Y + 118, CW - 32,
             ["Product", "Category", "Orders", "Units Sold",
              "Revenue (ETH)", "Revenue (RM)"],
             [["Aurora Hoodie", "clothes", "14", "31", "0.9300", "RM 11,160.00"],
              ["Orbit Speaker", "electronics", "11", "22", "0.6600", "RM 7,920.00"],
              ["Mini Racer Set", "toys", "9", "25", "0.2520", "RM 3,024.00"]],
             {"colw": [2.4, 1.6, 1, 1.2, 1.6, 1.7]})]
    py = BODY_Y + 280
    els += card(CX, py, CW, 100, "Delivery Pipeline")
    for i, step in enumerate(ORDER_STEPS):
        px = CX + 16 + i * ((CW - 32) / 5)
        pw = (CW - 32) / 5 - 8
        els += [
            ("rect", px, py + 32, pw, 54, {"fill": WHITE,
                                           "outline": GREY_SOFT,
                                           "radius": 5}),
            ("text", px, py + 40, str([2, 4, 3, 6, 28][i]),
             {"size": 16, "bold": True, "align": "center", "box_w": pw}),
            ("text", px, py + 66, step, {"size": 8, "align": "center",
                                          "box_w": pw, "color": GREY_TEXT}),
        ]
    els += [("note", CX, h - 66, CW, 40,
             "Revenue is aggregated from order_items for this merchant, so "
             "multi-seller baskets are attributed to the correct store.")]
    return {"num": "22", "title": "Seller \u2014 Revenue & Product Performance",
            "group": "Seller (Merchant)", "w": W, "h": h, "elements": els,
            "caption": "Revenue tiles, per-product performance table and the "
                       "delivery pipeline counters."}


# =============================================== 23 Seller subscription =====

def seller_payments():
    h = 660
    els = sidebar(h, "seller", 3, brand="\u2302 Elixir Commerce",
                  kicker="Seller Portal",
                  extra_cards=[("Your Store", ["Nova Store",
                                               "6 product(s) listed"], 50),
                               ("Payments Wallet", ["0xA43b\u20261c07",
                                                    "2.4310 ETH"], 50)])
    els += topbar("Seller Dashboard", "Payments",
                  right=profile_chip("merchant", "U0007"))
    els += card(CX, BODY_Y, CW, 150)
    els += [
        ("text", CX + 16, BODY_Y + 12, "CURRENT PLAN", {"size": 8,
                                                         "bold": True,
                                                         "color": GREY_TEXT}),
        ("text", CX + 16, BODY_Y + 26, "Pro", {"size": 18, "bold": True}),
        ("text", CX + 16, BODY_Y + 52,
         "0.0300 ETH billed monthly \u00b7 renews 03 Aug 2026",
         {"size": 9, "color": GREY_TEXT}),
        ("btn", CX + CW - 90, BODY_Y + 14, 74, 22, "pro",
         {"variant": "tag", "size": 9, "round": True}),
        ("hline", CX + 16, BODY_Y + 76, CW - 32),
        ("text", CX + 16, BODY_Y + 86, "Product listings", {"size": 9,
                                                             "color": GREY_TEXT}),
        ("text", CX + CW - 116, BODY_Y + 86, "6 / 10", {"size": 10,
                                                         "bold": True,
                                                         "align": "right",
                                                         "box_w": 100}),
        ("progress", CX + 16, BODY_Y + 104, CW - 32, 60),
        ("box", CX + 16, BODY_Y + 118, CW - 32, 24,
         "\u23f3 Scheduled change to Enterprise \u2014 applies on your next "
         "billing cycle (03 Aug 2026) once payment is made.",
         {"fill": GREY_FILL, "outline": GREY_SOFT, "size": 8,
          "align": "left"}),
    ]
    py = BODY_Y + 164
    els += card(CX, py, CW, 206, "Available Plans",
                sub="Switching plans takes effect on your next billing cycle "
                    "\u2014 your current plan stays active until then.")
    plans = [("Starter", "0.0100", "Up to 3 products", "Switch to Starter"),
             ("Pro", "0.0300", "Up to 10 products", "\u2713 Current plan"),
             ("Enterprise", "0.0600", "Unlimited products", "\u23f3 Scheduled")]
    for i, (name, price, limit, action) in enumerate(plans):
        px = CX + 16 + i * ((CW - 44) / 3 + 6)
        pw = (CW - 44) / 3 - 6
        cur = i == 1
        els += [
            ("rect", px, py + 52, pw, 138,
             {"fill": WHITE, "outline": BLACK if cur else GREY_SOFT,
              "width": 2 if cur else 1, "radius": 6}),
            ("text", px + 10, py + 62, name, {"size": 12, "bold": True}),
            ("text", px + 10, py + 84, price, {"size": 18, "bold": True}),
            ("text", px + 10, py + 106, "ETH/mo", {"size": 8,
                                                    "color": GREY_TEXT}),
            ("text", px + 10, py + 122, limit, {"size": 9}),
            ("btn", px + 10, py + 152, pw - 20, 26, action,
             {"variant": "tag" if cur or i == 2 else "primary", "size": 9}),
        ]
    by = py + 220
    els += card(CX, by, CW, 130, "Billing")
    els += [
        ("text", CX + 16, by + 34, "Next charge (new plan)", {"size": 9,
                                                               "color": GREY_TEXT}),
        ("text", CX + 16, by + 48, "0.0600 ETH", {"size": 18, "bold": True}),
        ("text", CX + 16, by + 74, "Payment is due now.", {"size": 9,
                                                            "color": GREY_TEXT}),
        ("btn", CX + CW - 216, by + 44, 200, 32, "Pay & Apply Plan",
         {"variant": "primary", "size": 11}),
        ("para", CX + 16, by + 94, CW - 32,
         "Payments settle in ETH from your connected MetaMask wallet to the "
         "platform. MetaMask cannot auto-debit, so each monthly renewal is "
         "confirmed by you here.", {"size": 8}),
    ]
    els += [("note", CX, h - 56, CW, 34,
             "While MetaMask is disconnected the pay button is replaced by "
             "\u201c\ud83e\udd8a Connect MetaMask to Pay\u201d.")]
    return {"num": "23", "title": "Seller \u2014 Subscription & Plan Payment",
            "group": "Seller (Merchant)", "w": W, "h": h, "elements": els,
            "caption": "Current plan usage, plan switching and the monthly ETH "
                       "renewal charge."}


# ======================================================= 24 Admin users =====

def admin_users():
    h = 538
    els = sidebar(h, "admin", 0, brand="\u2699 Elixir Commerce",
                  kicker="Admin Console",
                  extra_cards=[("Platform Treasury",
                                ["ETH        84.2100",
                                 "Elixir     1,250,000",
                                 "* Chain connected"], 74)])
    els += topbar("Administration", "Users",
                  right=profile_chip("admin", "0x5FbDB2\u2026aa3"))
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y, tw, "Admin ETH Balance", "84.2100",
                "On-chain reserve")
    els += tile(CX + tw + 12, BODY_Y, tw, "Admin Elixir Balance", "1,250,000",
                "LYT treasury supply")
    els += tile(CX + 2 * (tw + 12), BODY_Y, tw, "Registered Users", "42",
                "31 customers \u00b7 9 sellers")
    sy = BODY_Y + 92
    els += card(CX, sy, CW, 268)
    els += section_head(sy + 12, "User Management", "All Registered Users")
    els += [
        ("rect", CX + CW - 250, sy + 16, 234, 28, {"fill": WHITE,
                                                    "outline": GREY_SOFT,
                                                    "radius": 14}),
        ("text", CX + CW - 236, sy + 25,
         "Search name, email, code or wallet\u2026", {"size": 9,
                                                       "color": GREY_SOFT}),
        ("table", CX + 16, sy + 58, CW - 32,
         ["Code", "Name", "Email", "Role", "MetaMask", "RM", "Elixir"],
         [["U0001", "Ali Rahman", "ali@example.com", "customer",
           "0x71C7\u20269e3F", "320.00", "480 \u2726"],
          ["U0007", "Nova Store", "nova@example.com", "merchant",
           "0xA43b\u20261c07", "\u2014", "\u2014"],
          ["U0002", "Siti Aminah", "siti@example.com", "customer",
           "Not linked", "80.00", "126 \u2726"],
          ["U0003", "Playbox Toys", "play@example.com", "merchant",
           "0x3C2d\u20268fB1", "\u2014", "\u2014"],
          ["U0000", "Platform Admin", "admin@example.com", "admin",
           "0x5FbD\u2026Aa3", "\u2014", "\u2014"]],
         {"colw": [1, 1.8, 2.4, 1.2, 1.7, 1, 1.1]}),
        ("text", CX + 16, sy + 240, "5 user(s) shown", {"size": 8,
                                                         "color": GREY_TEXT}),
    ]
    els += [("note", CX, h - 90, CW, 60,
             "One users table with a role column (customer | merchant | "
             "admin) backs all three portals, so this list is the single "
             "registry. RM and Elixir columns only apply to customers, since "
             "only they own a customer_wallet row.")]
    return {"num": "24", "title": "Admin \u2014 User Management",
            "group": "Administrator", "w": W, "h": h, "elements": els,
            "caption": "Treasury tiles plus the searchable registry of every "
                       "account."}


# ===================================================== 25 Admin staking =====

def admin_staking():
    h = 690
    els = sidebar(h, "admin", 1, brand="\u2699 Elixir Commerce",
                  kicker="Admin Console",
                  extra_cards=[("Platform Treasury",
                                ["ETH        84.2100",
                                 "Elixir     1,250,000",
                                 "* Chain connected"], 74)])
    els += topbar("Administration", "Staking",
                  right=profile_chip("admin", "0x5FbDB2\u2026aa3"))
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y, tw, "Total Staked", "18,420 \u2726",
                "12 active position(s)")
    els += tile(CX + tw + 12, BODY_Y, tw, "Interest Accrued", "742.18 \u2726",
                "Across active stakes")
    els += tile(CX + 2 * (tw + 12), BODY_Y, tw, "Tiers", "4",
                "Editable APY below")
    cy = BODY_Y + 92
    els += card(CX, cy, CW, 174)
    els += section_head(cy + 12, "Configuration", "Staking APY by Tier")
    for i, (label, apy) in enumerate([("30 Days", "8"), ("90 Days", "14"),
                                      ("180 Days", "22"), ("365 Days", "35")]):
        px = CX + 16 + i * ((CW - 44) / 4 + 4)
        pw = (CW - 44) / 4 - 4
        els += [
            ("rect", px, cy + 54, pw, 100, {"fill": WHITE,
                                            "outline": GREY_SOFT,
                                            "radius": 6}),
            ("text", px + 10, cy + 64, label, {"size": 10, "bold": True}),
            ("rect", px + 10, cy + 82, pw - 60, 26, {"fill": WHITE,
                                                      "outline": GREY_SOFT,
                                                      "radius": 4}),
            ("text", px + 18, cy + 90, apy, {"size": 11, "bold": True}),
            ("text", px + pw - 44, cy + 90, "% APY", {"size": 9,
                                                       "color": GREY_TEXT}),
            ("btn", px + 10, cy + 118, pw - 20, 24, "Save",
             {"variant": "primary", "size": 9}),
        ]
    py = cy + 186
    els += card(CX, py, CW, 246)
    els += section_head(py + 12, "Positions", "All Stakers",
                        right_btn="\u21bb Refresh")
    els += [
        ("table", CX + 16, py + 54, CW - 32,
         ["User", "Wallet", "Amount", "Tier", "APY", "Earned", "Status"],
         [["Ali Rahman  U0001", "0x71C7\u20269e3F", "1,200.00 \u2726", "90d",
           "14.00%", "+42.30 \u2726", "active"],
          ["Siti Aminah  U0002", "0x3C2d\u20268fB1", "600.00 \u2726", "30d",
           "8.00%", "+3.92 \u2726", "active"],
          ["Lim Wei  U0004", "0x9F12\u20264dA8", "5,000.00 \u2726", "365d",
           "35.00%", "+412.60 \u2726", "active"],
          ["Kumar S  U0005", "0x77Ae\u2026B2c9", "2,400.00 \u2726", "180d",
           "22.00%", "+188.05 \u2726", "completed"]],
         {"colw": [2, 1.7, 1.4, 0.8, 1, 1.4, 1.1]}),
        ("text", CX + 16, py + 216, "4 position(s)", {"size": 8,
                                                       "color": GREY_TEXT}),
    ]
    els += [("note", CX, h - 76, CW, 46,
             "Changing a tier's APY affects new stakes only \u2014 existing "
             "positions keep the rate they were opened at, because each "
             "stake_position row copies apy and compoundFrequency at creation "
             "time.")]
    return {"num": "25", "title": "Admin \u2014 Staking Tiers & All Stakers",
            "group": "Administrator", "w": W, "h": h, "elements": els,
            "caption": "Editable APY per tier and the full staking position "
                       "table."}


# ===================================================== 26 Admin revenue =====

def admin_revenue():
    h = 560
    els = sidebar(h, "admin", 2, brand="\u2699 Elixir Commerce",
                  kicker="Admin Console",
                  extra_cards=[("Platform Treasury",
                                ["ETH        84.2100",
                                 "Elixir     1,250,000",
                                 "* Chain connected"], 74)])
    els += topbar("Administration", "Revenue",
                  right=profile_chip("admin", "0x5FbDB2\u2026aa3"))
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y, tw, "Total Subscription Revenue", "1.4200 ETH",
                "\u2248 RM 17,040.00")
    els += tile(CX + tw + 12, BODY_Y, tw, "Payments Received", "48",
                "Completed charges")
    els += tile(CX + 2 * (tw + 12), BODY_Y, tw, "By Plan (ETH)", "1.4200",
                "S 0.14 \u00b7 P 0.72 \u00b7 E 0.56")
    my = BODY_Y + 92
    els += card(CX, my, CW, 110)
    els += section_head(my + 12, "Trend", "Monthly Revenue")
    for i, (m, v) in enumerate([("2026-02", "0.190"), ("2026-03", "0.220"),
                                ("2026-04", "0.280"), ("2026-05", "0.310"),
                                ("2026-06", "0.420")]):
        px = CX + 16 + i * ((CW - 32) / 5)
        pw = (CW - 32) / 5 - 8
        els += [
            ("rect", px, my + 52, pw, 44, {"fill": WHITE,
                                           "outline": GREY_SOFT,
                                           "radius": 5}),
            ("text", px, my + 60, f"{v} ETH", {"size": 11, "bold": True,
                                                "align": "center",
                                                "box_w": pw}),
            ("text", px, my + 78, m, {"size": 8, "align": "center",
                                       "box_w": pw, "color": GREY_TEXT}),
        ]
    ly = my + 124
    els += card(CX, ly, CW, 230)
    els += section_head(ly + 12, "Ledger", "Subscription Payments",
                        right_btn="\u21bb Refresh")
    els += [
        ("table", CX + 16, ly + 54, CW - 32,
         ["Seller", "Plan", "Amount", "Date", "Tx"],
         [["Nova Store  U0007", "pro", "0.0300 ETH", "03 Jul 2026",
           "0x8d41\u2026e7ba"],
          ["Playbox Toys  U0003", "starter", "0.0100 ETH", "02 Jul 2026",
           "0x21bc\u20264f0d"],
          ["Metro Foods  U0009", "enterprise", "0.0600 ETH", "01 Jul 2026",
           "0x9ae7\u2026c318"],
          ["Gadget Hub  U0011", "pro", "0.0300 ETH", "28 Jun 2026",
           "0x4f0a\u2026d7e2"],
          ["Nova Store  U0007", "pro", "0.0300 ETH", "03 Jun 2026",
           "0x6c19\u2026a845"]],
         {"colw": [2.4, 1.2, 1.4, 1.5, 1.8]}),
        ("text", CX + 16, ly + 200, "5 payment(s)", {"size": 8,
                                                      "color": GREY_TEXT}),
    ]
    return {"num": "26", "title": "Admin \u2014 Subscription Revenue",
            "group": "Administrator", "w": W, "h": h, "elements": els,
            "caption": "Platform income from seller subscription plans, with a "
                       "monthly trend and full payment ledger."}


# ==================================================== 27 Admin disputes =====

def admin_disputes():
    h = 500
    els = sidebar(h, "admin", 3, brand="\u2699 Elixir Commerce",
                  kicker="Admin Console",
                  extra_cards=[("Platform Treasury",
                                ["ETH        84.2100",
                                 "Elixir     1,250,000",
                                 "* Chain connected"], 74)])
    els += topbar("Administration", "Disputes",
                  right=profile_chip("admin", "0x5FbDB2\u2026aa3"))
    tw = (CW - 24) / 3
    els += tile(CX, BODY_Y, tw, "Open Disputes", "3",
                "Awaiting your decision")
    els += tile(CX + tw + 12, BODY_Y, tw, "How it works", "Buyer \u2192 Admin",
                "Buyers raise, you resolve")
    els += tile(CX + 2 * (tw + 12), BODY_Y, tw, "Resolution", "On-chain",
                "Refund or release via contract")
    dy = BODY_Y + 92
    els += card(CX, dy, CW, 234)
    els += section_head(dy + 12, "Escrow", "Disputes to Resolve",
                        right_btn="\u21bb Refresh")
    els += [
        ("para", CX + 16, dy + 50, CW - 32,
         "When a buyer raises a dispute, the escrowed funds are frozen in the "
         "smart contract until you decide. Choose Refund Buyer to return the "
         "escrowed asset to the buyer (order cancelled, stock restored), or "
         "Release to Seller to pay the seller as normal.", {"size": 9}),
        ("table", CX + 16, dy + 92, CW - 32,
         ["Product", "Buyer", "Seller", "Asset", "Value", "Raised", "Action"],
         [["Aurora Hoodie \u00d72", "Ali Rahman U0001", "Nova Store", "ETH",
           "0.0900 ETH", "28 Jun 2026", "Release  /  Refund"],
          ["Orbit Speaker \u00d71", "Siti Aminah U0002", "Gadget Hub",
           "Elixir", "32 \u2726", "01 Jul 2026", "Release  /  Refund"],
          ["Snack Box \u00d73", "Lim Wei U0004", "Metro Foods", "ETH",
           "0.0660 ETH", "03 Jul 2026", "Release  /  Refund"]],
         {"colw": [1.9, 1.9, 1.5, 0.9, 1.3, 1.4, 2]}),
        ("text", CX + 16, dy + 196, "3 open dispute(s)", {"size": 8,
                                                           "color": GREY_TEXT}),
    ]
    els += [("note", CX, h - 84, CW, 54,
             "Both actions ask for confirmation first: \u201cAre you sure you "
             "want to refund the buyer / release funds to the seller? This "
             "runs an on-chain transaction and cannot be undone.\u201d The "
             "resolution is written to the escrow contract and the blockchain "
             "log.")]
    return {"num": "27", "title": "Admin \u2014 Resolve Escrow Disputes",
            "group": "Administrator", "w": W, "h": h, "elements": els,
            "caption": "Open disputes with the on-chain refund / release "
                       "decision."}


SCREENS = [
    login(), register(),
    shop_disconnected(), shop_connected(), shop_seller(),
    cart_empty(), cart_items(),
    checkout_locked(), checkout_eth(), checkout_success(),
    wallet(), staking(), staking_matured(),
    track_list(), track_expanded(), track_disputed(),
    history(), profile_view(), profile_edit(),
    seller_create(), seller_orders(), seller_revenue(), seller_payments(),
    admin_users(), admin_staking(), admin_revenue(), admin_disputes(),
]
