// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./LoyaltyToken.sol";
import "./PurchaseReceipt.sol";

/**
 * @title PurchaseEscrow
 * @dev Escrow-based delivery confirmation for the blockchain e-commerce platform.
 *      FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Both ETH and Elixir (LYT) purchases are escrowed here:
 *  1. Buyer funds an escrow at checkout.
 *       ETH   → createEscrow (payable) locks ETH in this contract.
 *       Elixir→ createTokenEscrow pulls LYT via transferFrom (buyer approves first).
 *     The seller is NOT paid yet.
 *  2. Seller ships the goods (tracked off-chain in the DB).
 *  3. Buyer confirms delivery (confirmDelivery):
 *        → seller receives the escrowed asset (minus platform fee),
 *        → for ETH escrows the buyer is rewarded LYT loyalty tokens,
 *        → buyer is minted an NFT purchase receipt.
 *  4. Safety valves:
 *        → autoRelease: after AUTO_RELEASE_PERIOD anyone can release to the
 *          seller, so funds are never stuck if the buyer disappears.
 *        → raiseDispute: buyer disputes before release.
 *        → resolveDispute: the platform owner (admin) refunds the buyer or
 *          releases to the seller.
 */
contract PurchaseEscrow is Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum EscrowStatus { None, Funded, Released, Refunded, Disputed }
    enum EscrowAsset  { ETH, TOKEN }

    struct Deal {
        address buyer;
        address seller;
        EscrowAsset asset;
        uint256 amount;        // wei for ETH, LYT-wei for TOKEN
        string  productRef;
        uint256 createdAt;
        uint256 autoReleaseAt;
        EscrowStatus status;
        uint256 receiptTokenId;
    }

    // ─── State ──────────────────────────────────────────────────────────────

    LoyaltyToken    public loyaltyToken;
    PurchaseReceipt public receipt;

    uint256 public platformFeeBps = 200;                 // 2.00%
    uint256 public constant AUTO_RELEASE_PERIOD = 14 days;
    uint256 public constant TOKEN_TO_ETH_RATE = 1e15;    // 1 LYT = 0.001 ETH (wei)

    uint256 public escrowCounter;
    mapping(uint256 => Deal) public deals;
    mapping(address => uint256[]) public buyerEscrows;
    mapping(address => uint256[]) public sellerEscrows;

    // ─── Events ───────────────────────────────────────────────────────────────

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint8   asset,
        uint256 amount,
        string  productRef,
        uint256 autoReleaseAt
    );
    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint8   asset,
        uint256 sellerReceives,
        uint256 platformFee,
        uint256 tokensEarned,
        uint256 receiptTokenId,
        bool    autoReleased
    );
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint8 asset, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, address indexed buyer, address indexed seller);
    event PlatformFeeUpdated(uint256 newFeeBps);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _loyaltyToken, address _receipt) Ownable(msg.sender) {
        require(_loyaltyToken != address(0), "PurchaseEscrow: zero token");
        require(_receipt != address(0),      "PurchaseEscrow: zero receipt");
        loyaltyToken = LoyaltyToken(_loyaltyToken);
        receipt      = PurchaseReceipt(_receipt);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "PurchaseEscrow: fee too high (max 10%)");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    // ─── Escrow creation ────────────────────────────────────────────────────────

    /**
     * @notice Fund a new ETH escrow. The ETH is held by this contract until the
     *         buyer confirms delivery (or a safety valve fires).
     */
    function createEscrow(address seller, string calldata productRef)
        external
        payable
        nonReentrant
        returns (uint256 escrowId)
    {
        require(msg.value > 0,        "PurchaseEscrow: no ETH sent");
        require(seller != address(0), "PurchaseEscrow: zero seller");
        require(seller != msg.sender, "PurchaseEscrow: buyer == seller");

        escrowId = _open(msg.sender, seller, EscrowAsset.ETH, msg.value, productRef);
    }

    /**
     * @notice Fund a new Elixir (LYT) escrow. The buyer must first approve this
     *         contract to spend `tokenAmount` LYT. Tokens are pulled in and held
     *         until the buyer confirms delivery.
     * @param seller      Seller wallet.
     * @param productRef  Product id from the centralised DB.
     * @param tokenAmount Amount of Elixir in whole units (NOT wei).
     */
    function createTokenEscrow(
        address seller,
        string calldata productRef,
        uint256 tokenAmount
    )
        external
        nonReentrant
        returns (uint256 escrowId)
    {
        require(tokenAmount > 0,      "PurchaseEscrow: zero tokens");
        require(seller != address(0), "PurchaseEscrow: zero seller");
        require(seller != msg.sender, "PurchaseEscrow: buyer == seller");

        uint256 tokenAmountWei = tokenAmount * 1e18;
        require(
            loyaltyToken.balanceOf(msg.sender) >= tokenAmountWei,
            "PurchaseEscrow: insufficient Elixir balance"
        );

        // Pull the buyer's tokens into escrow (requires prior approve()).
        bool ok = loyaltyToken.transferFrom(msg.sender, address(this), tokenAmountWei);
        require(ok, "PurchaseEscrow: token transfer failed");

        escrowId = _open(msg.sender, seller, EscrowAsset.TOKEN, tokenAmountWei, productRef);
    }

    function _open(
        address buyer,
        address seller,
        EscrowAsset asset,
        uint256 amount,
        string calldata productRef
    ) internal returns (uint256 escrowId) {
        escrowId = ++escrowCounter;
        uint256 releaseAt = block.timestamp + AUTO_RELEASE_PERIOD;

        deals[escrowId] = Deal({
            buyer:          buyer,
            seller:         seller,
            asset:          asset,
            amount:         amount,
            productRef:     productRef,
            createdAt:      block.timestamp,
            autoReleaseAt:  releaseAt,
            status:         EscrowStatus.Funded,
            receiptTokenId: 0
        });
        buyerEscrows[buyer].push(escrowId);
        sellerEscrows[seller].push(escrowId);

        emit EscrowCreated(escrowId, buyer, seller, uint8(asset), amount, productRef, releaseAt);
    }

    // ─── Escrow lifecycle ──────────────────────────────────────────────────────

    /**
     * @notice Buyer confirms delivery — releases the escrowed asset to the seller,
     *         rewards loyalty tokens (ETH escrows), and mints an NFT receipt.
     */
    function confirmDelivery(uint256 escrowId) external nonReentrant {
        Deal storage d = deals[escrowId];
        require(d.status == EscrowStatus.Funded, "PurchaseEscrow: not releasable");
        require(msg.sender == d.buyer,           "PurchaseEscrow: only buyer");
        _release(escrowId, false);
    }

    /**
     * @notice Release to the seller once the auto-release deadline passes.
     *         Callable by anyone so the seller is never stuck waiting.
     */
    function autoRelease(uint256 escrowId) external nonReentrant {
        Deal storage d = deals[escrowId];
        require(d.status == EscrowStatus.Funded,    "PurchaseEscrow: not releasable");
        require(block.timestamp >= d.autoReleaseAt, "PurchaseEscrow: too early");
        _release(escrowId, true);
    }

    /**
     * @notice Buyer raises a dispute before the funds are released.
     */
    function raiseDispute(uint256 escrowId) external {
        Deal storage d = deals[escrowId];
        require(d.status == EscrowStatus.Funded, "PurchaseEscrow: not disputable");
        require(msg.sender == d.buyer,           "PurchaseEscrow: only buyer");
        d.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, d.buyer, d.seller);
    }

    /**
     * @notice Platform owner (admin) resolves a dispute: refund the buyer or
     *         release the funds to the seller.
     */
    function resolveDispute(uint256 escrowId, bool refundBuyer)
        external
        onlyOwner
        nonReentrant
    {
        Deal storage d = deals[escrowId];
        require(d.status == EscrowStatus.Disputed, "PurchaseEscrow: not disputed");

        if (refundBuyer) {
            d.status = EscrowStatus.Refunded;
            _payout(d.asset, d.buyer, d.amount);
            emit EscrowRefunded(escrowId, d.buyer, uint8(d.asset), d.amount);
        } else {
            // Re-open as funded internally, then release to the seller.
            d.status = EscrowStatus.Funded;
            _release(escrowId, false);
        }
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _release(uint256 escrowId, bool autoReleased) internal {
        Deal storage d = deals[escrowId];

        // Effects before interactions (reentrancy-safe).
        d.status = EscrowStatus.Released;

        uint256 platformFee    = (d.amount * platformFeeBps) / 10_000;
        uint256 sellerReceives = d.amount - platformFee;

        // Pay the seller + platform fee in the escrowed asset.
        _payout(d.asset, d.seller, sellerReceives);
        if (platformFee > 0) {
            _payout(d.asset, owner(), platformFee);
        }

        // Loyalty reward — only for ETH escrows (paying with Elixir earns none).
        uint256 tokensEarned = 0;
        if (d.asset == EscrowAsset.ETH) {
            try loyaltyToken.issueTokensForPurchase(d.buyer, d.amount) {
                tokensEarned = loyaltyToken.previewTokenReward(d.amount);
                if (tokensEarned == 0) tokensEarned = 1;
            } catch {
                // Loyalty reward is non-critical — never block the release.
            }
        }

        // Receipt price shown in ETH-equivalent wei.
        uint256 pricePaidWei =
            d.asset == EscrowAsset.ETH ? d.amount : (d.amount * TOKEN_TO_ETH_RATE) / 1e18;

        // Mint an NFT purchase receipt to the buyer.
        uint256 tokenId = 0;
        try
            receipt.mintReceipt(
                d.buyer,
                escrowId.toString(),
                d.productRef,
                d.seller,
                pricePaidWei
            )
        returns (uint256 mintedId) {
            tokenId = mintedId;
            d.receiptTokenId = mintedId;
        } catch {
            // Receipt is non-critical — never block the release.
        }

        emit EscrowReleased(
            escrowId,
            d.buyer,
            d.seller,
            uint8(d.asset),
            sellerReceives,
            platformFee,
            tokensEarned,
            tokenId,
            autoReleased
        );
    }

    /**
     * @dev Send `amount` of the escrowed asset to `to`.
     */
    function _payout(EscrowAsset asset, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (asset == EscrowAsset.ETH) {
            (bool sent, ) = payable(to).call{value: amount}("");
            require(sent, "PurchaseEscrow: ETH transfer failed");
        } else {
            bool ok = loyaltyToken.transfer(to, amount);
            require(ok, "PurchaseEscrow: token transfer failed");
        }
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getEscrow(uint256 escrowId) external view returns (Deal memory) {
        return deals[escrowId];
    }

    function getBuyerEscrows(address buyer) external view returns (uint256[] memory) {
        return buyerEscrows[buyer];
    }

    function getSellerEscrows(address seller) external view returns (uint256[] memory) {
        return sellerEscrows[seller];
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
