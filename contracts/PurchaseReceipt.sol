// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PurchaseReceipt
 * @dev ERC-721 proof-of-purchase receipt for the blockchain e-commerce platform.
 *      FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Every completed purchase can mint one non-fungible receipt to the buyer.
 * The receipt is a verifiable, tamper-proof record of the order and doubles
 * as a warranty / proof-of-ownership certificate.
 *
 * Metadata is generated fully on-chain (base64-encoded JSON in `tokenURI`),
 * so the receipt renders in MetaMask / any NFT viewer with no external server.
 *
 * Minting is restricted to authorised minters (the escrow contract) and the
 * owner (the platform backend), so receipts can be issued for both escrow and
 * non-escrow orders.
 */
contract PurchaseReceipt is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;
    using Strings for address;

    // ─── Types ────────────────────────────────────────────────────────────────

    struct ReceiptData {
        string  orderRef;      // centralised DB order id
        string  productRef;    // centralised DB product id
        address buyer;
        address seller;
        uint256 pricePaidWei;  // amount paid, in wei
        uint256 issuedAt;      // block timestamp
    }

    // ─── State ──────────────────────────────────────────────────────────────

    uint256 public nextTokenId = 1;
    mapping(address => bool) public authorizedMinters;
    mapping(uint256 => ReceiptData) private _receipts;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MinterUpdated(address indexed minter, bool allowed);
    event ReceiptMinted(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        string orderRef,
        string productRef,
        uint256 pricePaidWei
    );

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor()
        ERC721("Elixir Purchase Receipt", "ELXR")
        Ownable(msg.sender)
    {}

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyMinter() {
        require(
            authorizedMinters[msg.sender] || msg.sender == owner(),
            "PurchaseReceipt: caller is not an authorized minter"
        );
        _;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Authorise (or revoke) a contract/address to mint receipts.
     *         The escrow contract is authorised here after deployment.
     */
    function setMinter(address account, bool allowed) external onlyOwner {
        require(account != address(0), "PurchaseReceipt: zero address");
        authorizedMinters[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint a purchase receipt NFT to the buyer.
     * @param to           Recipient (buyer) wallet.
     * @param orderRef     Centralised DB order id.
     * @param productRef   Centralised DB product id.
     * @param seller       Seller wallet.
     * @param pricePaidWei Amount paid in wei.
     * @return tokenId     The minted token id.
     */
    function mintReceipt(
        address to,
        string calldata orderRef,
        string calldata productRef,
        address seller,
        uint256 pricePaidWei
    ) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "PurchaseReceipt: zero recipient");

        tokenId = nextTokenId++;
        _receipts[tokenId] = ReceiptData({
            orderRef:     orderRef,
            productRef:   productRef,
            buyer:        to,
            seller:       seller,
            pricePaidWei: pricePaidWei,
            issuedAt:     block.timestamp
        });

        _safeMint(to, tokenId);

        emit ReceiptMinted(tokenId, to, seller, orderRef, productRef, pricePaidWei);
        return tokenId;
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /**
     * @notice Return the raw receipt record for a token.
     */
    function getReceipt(uint256 tokenId) external view returns (ReceiptData memory) {
        _requireOwned(tokenId);
        return _receipts[tokenId];
    }

    /**
     * @notice List all receipt token ids owned by an address.
     */
    function receiptsOf(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /**
     * @notice Fully on-chain token metadata (base64-encoded JSON data URI).
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        ReceiptData memory r = _receipts[tokenId];

        string memory json = string(
            abi.encodePacked(
                '{"name":"Purchase Receipt #', tokenId.toString(),
                '","description":"Verifiable proof-of-purchase receipt issued by the Elixir Commerce blockchain platform.",',
                '"attributes":[',
                    '{"trait_type":"Order Ref","value":"', r.orderRef, '"},',
                    '{"trait_type":"Product Ref","value":"', r.productRef, '"},',
                    '{"trait_type":"Buyer","value":"', r.buyer.toHexString(), '"},',
                    '{"trait_type":"Seller","value":"', r.seller.toHexString(), '"},',
                    '{"trait_type":"Price Paid (wei)","value":"', r.pricePaidWei.toString(), '"},',
                    '{"display_type":"date","trait_type":"Issued","value":', r.issuedAt.toString(), '}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    // ─── Required overrides (ERC721 + ERC721Enumerable) ───────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
