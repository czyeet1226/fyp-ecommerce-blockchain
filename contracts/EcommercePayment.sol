// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoyaltyToken.sol";

/**
 * @title EcommercePayment
 * @dev Handles all payment logic for the blockchain-integrated e-commerce platform.
 *      FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Payment Modes:
 *  1. ETH_ONLY     — buyer pays 100% in ETH; seller receives ETH minus platform fee.
 *  2. TOKEN_ONLY   — buyer pays 100% in LYT tokens; tokens burned, seller paid in ETH from reserve.
 *  3. HYBRID       — buyer pays part ETH + part LYT tokens in one transaction.
 *
 * Token Rewards:
 *  - After every ETH payment, LYT tokens are automatically issued to the buyer.
 *  - Tokens never expire and are held in the buyer's wallet.
 *
 * Seller Transfer:
 *  - After each purchase the seller's ETH portion is transferred on-chain immediately.
 *  - Platform collects a configurable fee (default 2%).
 */
contract EcommercePayment is Ownable, ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────────────

    enum PaymentMode { ETH_ONLY, TOKEN_ONLY, HYBRID }

    struct Order {
        uint256  orderId;
        address  buyer;
        address  seller;
        uint256  totalPriceWei;      // full price in ETH (wei)
        uint256  ethPaidWei;         // ETH actually sent by buyer
        uint256  tokensPaid;         // LYT tokens used (in LYT-wei units)
        uint256  ethTokenValue;      // ETH equivalent of tokens used (wei)
        PaymentMode mode;
        uint256  timestamp;
        bool     completed;
        uint256  tokensEarned;       // LYT tokens rewarded to buyer
        string   productRef;         // product ID from centralised DB
    }

    // ─── State ────────────────────────────────────────────────────────────────

    LoyaltyToken public loyaltyToken;

    uint256 public platformFeeBps = 200;       // 2.00% (basis points)
    uint256 public constant TOKEN_TO_ETH_RATE = 1e15; // 1 LYT = 0.001 ETH (wei)
    uint256 public orderCounter;

    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public buyerOrders;
    mapping(address => uint256[]) public sellerOrders;
    mapping(address => uint256) public sellerPendingWithdrawals; // pull pattern safety

    // ─── Events ───────────────────────────────────────────────────────────────

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 totalPriceWei,
        PaymentMode mode,
        string productRef
    );

    event PaymentCompleted(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 sellerReceivesWei,
        uint256 platformFeeWei,
        uint256 tokensEarned
    );

    event SellerWithdrawal(address indexed seller, uint256 amountWei);
    event PlatformFeeUpdated(uint256 newFeeBps);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _loyaltyToken) Ownable(msg.sender) {
        require(_loyaltyToken != address(0), "EcommercePayment: zero token address");
        loyaltyToken = LoyaltyToken(_loyaltyToken);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "EcommercePayment: fee too high (max 10%)");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    // Allow contract to receive ETH (platform fee reserve for token redemptions)
    receive() external payable {}

    // ─── Payment Functions ────────────────────────────────────────────────────

    /**
     * @notice Pay for an order entirely in ETH.
     *         Seller receives ETH minus platform fee. Buyer earns LYT tokens.
     *
     * @param seller      Seller's wallet address (Hardhat account).
     * @param productRef  Product ID from the centralised MySQL database.
     */
    function payWithETH(address payable seller, string calldata productRef)
        external
        payable
        nonReentrant
        returns (uint256 orderId)
    {
        require(msg.value > 0,                     "EcommercePayment: no ETH sent");
        require(seller != address(0),              "EcommercePayment: zero seller");
        require(seller != msg.sender,              "EcommercePayment: buyer == seller");

        orderId = _createOrder(msg.sender, seller, msg.value, msg.value, 0, 0, PaymentMode.ETH_ONLY, productRef);

        _settlePayment(orderId, seller, msg.value, msg.value);
        return orderId;
    }

    /**
     * @notice Pay for an order entirely using LYT loyalty tokens.
     *         Tokens are burned; seller is paid in ETH from the platform reserve.
     *
     * @param seller       Seller's wallet address.
     * @param tokenAmount  Amount of LYT tokens to spend (in full LYT units, NOT wei).
     * @param productRef   Product ID from centralised DB.
     */
    function payWithTokens(
        address payable seller,
        uint256 tokenAmount,
        string calldata productRef
    )
        external
        nonReentrant
        returns (uint256 orderId)
    {
        require(tokenAmount > 0,      "EcommercePayment: zero tokens");
        require(seller != address(0), "EcommercePayment: zero seller");
        require(seller != msg.sender, "EcommercePayment: buyer == seller");

        uint256 tokenAmountWei = tokenAmount * 1e18;
        uint256 ethValue       = tokenAmount * TOKEN_TO_ETH_RATE; // ETH equivalent

        require(
            loyaltyToken.balanceOf(msg.sender) >= tokenAmountWei,
            "EcommercePayment: insufficient LYT balance"
        );
        require(
            address(this).balance >= ethValue,
            "EcommercePayment: platform reserve insufficient"
        );

        // Burn buyer's tokens
        loyaltyToken.redeemTokens(msg.sender, tokenAmountWei);

        orderId = _createOrder(msg.sender, seller, ethValue, 0, tokenAmountWei, ethValue, PaymentMode.TOKEN_ONLY, productRef);

        _settlePayment(orderId, seller, ethValue, 0);
        return orderId;
    }

    /**
     * @notice Hybrid payment — part ETH + part LYT tokens in a single transaction.
     *         The ETH sent covers the remaining balance after token value is deducted.
     *
     * @param seller       Seller's wallet address.
     * @param totalPriceWei Full order price in wei.
     * @param tokenAmount   LYT tokens to apply (in full LYT units).
     * @param productRef    Product ID from centralised DB.
     */
    function payHybrid(
        address payable seller,
        uint256 totalPriceWei,
        uint256 tokenAmount,
        string calldata productRef
    )
        external
        payable
        nonReentrant
        returns (uint256 orderId)
    {
        require(totalPriceWei > 0,    "EcommercePayment: zero price");
        require(seller != address(0), "EcommercePayment: zero seller");
        require(seller != msg.sender, "EcommercePayment: buyer == seller");

        uint256 tokenAmountWei = tokenAmount * 1e18;
        uint256 tokenEthValue  = tokenAmount * TOKEN_TO_ETH_RATE;

        require(tokenEthValue < totalPriceWei, "EcommercePayment: tokens cover full price - use payWithTokens");
        uint256 ethRequired = totalPriceWei - tokenEthValue;
        require(msg.value >= ethRequired,       "EcommercePayment: insufficient ETH for hybrid payment");

        if (tokenAmount > 0) {
            require(
                loyaltyToken.balanceOf(msg.sender) >= tokenAmountWei,
                "EcommercePayment: insufficient LYT balance"
            );
            // Burn tokens
            loyaltyToken.redeemTokens(msg.sender, tokenAmountWei);
        }

        // Refund excess ETH if buyer overpaid
        if (msg.value > ethRequired) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - ethRequired}("");
            require(refunded, "EcommercePayment: refund failed");
        }

        orderId = _createOrder(
            msg.sender, seller, totalPriceWei,
            ethRequired, tokenAmountWei, tokenEthValue,
            PaymentMode.HYBRID, productRef
        );

        _settlePayment(orderId, seller, totalPriceWei, ethRequired);
        return orderId;
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _createOrder(
        address buyer,
        address seller,
        uint256 totalPriceWei,
        uint256 ethPaid,
        uint256 tokensPaid,
        uint256 ethTokenValue,
        PaymentMode mode,
        string memory productRef
    ) internal returns (uint256 orderId) {
        orderId = ++orderCounter;
        orders[orderId] = Order({
            orderId:       orderId,
            buyer:         buyer,
            seller:        seller,
            totalPriceWei: totalPriceWei,
            ethPaidWei:    ethPaid,
            tokensPaid:    tokensPaid,
            ethTokenValue: ethTokenValue,
            mode:          mode,
            timestamp:     block.timestamp,
            completed:     false,
            tokensEarned:  0,
            productRef:    productRef
        });
        buyerOrders[buyer].push(orderId);
        sellerOrders[seller].push(orderId);

        emit OrderCreated(orderId, buyer, seller, totalPriceWei, mode, productRef);
    }

    function _settlePayment(
        uint256 orderId,
        address payable seller,
        uint256 totalPriceWei,
        uint256 ethSentByBuyer
    ) internal {
        // Calculate platform fee
        uint256 platformFee    = (totalPriceWei * platformFeeBps) / 10_000;
        uint256 sellerReceives = totalPriceWei - platformFee;

        // Transfer ETH to seller immediately
        (bool sent, ) = seller.call{value: sellerReceives}("");
        require(sent, "EcommercePayment: seller transfer failed");

        // Issue loyalty tokens to buyer (only on ETH portion)
        uint256 tokensEarned = 0;
        if (ethSentByBuyer > 0) {
            loyaltyToken.issueTokensForPurchase(orders[orderId].buyer, ethSentByBuyer);
            tokensEarned = (ethSentByBuyer * loyaltyToken.TOKENS_PER_ETH()) / 1e18;
            if (tokensEarned == 0) tokensEarned = 1;
        }

        orders[orderId].completed   = true;
        orders[orderId].tokensEarned = tokensEarned;

        emit PaymentCompleted(orderId, orders[orderId].buyer, seller, sellerReceives, platformFee, tokensEarned);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getBuyerOrders(address buyer) external view returns (uint256[] memory) {
        return buyerOrders[buyer];
    }

    function getSellerOrders(address seller) external view returns (uint256[] memory) {
        return sellerOrders[seller];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Preview the ETH cost for a hybrid payment given token usage.
     */
    function previewHybridCost(uint256 totalPriceWei, uint256 tokenAmount)
        external
        pure
        returns (uint256 ethRequired, uint256 tokenEthValue)
    {
        tokenEthValue = tokenAmount * TOKEN_TO_ETH_RATE;
        if (tokenEthValue >= totalPriceWei) {
            ethRequired = 0;
        } else {
            ethRequired = totalPriceWei - tokenEthValue;
        }
    }
}
