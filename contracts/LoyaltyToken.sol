// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LoyaltyToken (LYT)
 * @dev ERC-20 token used as loyalty rewards in the blockchain e-commerce platform.
 *      FYP: Chan Zean Yeet TP070394 — APD3F2601
 *
 * Token Economy:
 *  - Customers earn LYT tokens on every purchase (1 LYT per 0.001 ETH spent).
 *  - Tokens can be redeemed directly as payment (hybrid payment).
 *  - No expiry date — tokens are held in the customer's wallet forever.
 *  - All issuance and redemption is automated by smart contract (no central authority).
 */
contract LoyaltyToken is ERC20, Ownable, ReentrancyGuard {

    // ─── State ───────────────────────────────────────────────────────────────

    address public ecommerceContract;          // Primary e-commerce contract (mint/burn)

    // Additional contracts allowed to mint/burn (e.g. the escrow contract).
    // Additive to `ecommerceContract` so multiple payment flows can reward LYT.
    mapping(address => bool) public authorizedMinters;

    uint256 public constant TOKENS_PER_ETH = 1000; // 1000 LYT per 1 ETH spent
    uint256 public constant DECIMALS_FACTOR = 1e18;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TokensIssued(address indexed customer, uint256 amount, string reason);
    event TokensRedeemed(address indexed customer, uint256 amount);
    event EcommerceContractUpdated(address indexed newContract);
    event MinterUpdated(address indexed minter, bool allowed);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() ERC20("LoyaltyToken", "LYT") Ownable(msg.sender) {
        // Mint the initial supply to the owner (platform/admin reserve).
        // The admin acts as the Elixir treasury: 10,000,000 LYT.
        _mint(msg.sender, 10_000_000 * DECIMALS_FACTOR);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyEcommerce() {
        require(
            msg.sender == ecommerceContract ||
                authorizedMinters[msg.sender] ||
                msg.sender == owner(),
            "LoyaltyToken: caller is not an authorized minter"
        );
        _;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /**
     * @notice Link the deployed EcommercePayment contract so it can mint/burn tokens.
     */
    function setEcommerceContract(address _contract) external onlyOwner {
        require(_contract != address(0), "LoyaltyToken: zero address");
        ecommerceContract = _contract;
        authorizedMinters[_contract] = true;
        emit EcommerceContractUpdated(_contract);
        emit MinterUpdated(_contract, true);
    }

    /**
     * @notice Authorise (or revoke) an additional contract to mint/burn LYT.
     *         Used to let the escrow contract issue purchase rewards without
     *         replacing the primary e-commerce contract link.
     */
    function setMinter(address account, bool allowed) external onlyOwner {
        require(account != address(0), "LoyaltyToken: zero address");
        authorizedMinters[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

    // ─── Core Token Operations ───────────────────────────────────────────────

    /**
     * @notice Issue loyalty tokens to a customer after a purchase.
     * @param customer  Wallet address of the buyer.
     * @param ethAmount Amount of ETH (in wei) spent on the purchase.
     */
    function issueTokensForPurchase(address customer, uint256 ethAmount)
        external
        onlyEcommerce
        nonReentrant
    {
        require(customer != address(0), "LoyaltyToken: zero address");
        require(ethAmount > 0, "LoyaltyToken: zero ETH amount");

        uint256 tokensToIssue = (ethAmount * TOKENS_PER_ETH) / DECIMALS_FACTOR;
        if (tokensToIssue == 0) tokensToIssue = 1; // minimum 1 LYT per purchase

        _mint(customer, tokensToIssue * DECIMALS_FACTOR);
        emit TokensIssued(customer, tokensToIssue * DECIMALS_FACTOR, "Purchase reward");
    }

    /**
     * @notice Issue tokens manually (admin use — sign-up bonus, promotions, etc.).
     */
    function issueTokensManual(address customer, uint256 amount, string calldata reason)
        external
        onlyEcommerce
    {
        require(customer != address(0), "LoyaltyToken: zero address");
        require(amount > 0, "LoyaltyToken: zero amount");

        _mint(customer, amount);
        emit TokensIssued(customer, amount, reason);
    }

    /**
     * @notice Burn tokens from a customer's wallet (used during hybrid payment redemption).
     * @param customer   Wallet address of the buyer.
     * @param tokenAmount Amount of LYT tokens (in wei units) to burn.
     */
    function redeemTokens(address customer, uint256 tokenAmount)
        external
        onlyEcommerce
        nonReentrant
    {
        require(customer != address(0), "LoyaltyToken: zero address");
        require(tokenAmount > 0, "LoyaltyToken: zero amount");
        require(balanceOf(customer) >= tokenAmount, "LoyaltyToken: insufficient balance");

        _burn(customer, tokenAmount);
        emit TokensRedeemed(customer, tokenAmount);
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Get token balance of an address (in whole LYT, not wei units).
     */
    function getTokenBalance(address account) external view returns (uint256) {
        return balanceOf(account) / DECIMALS_FACTOR;
    }

    /**
     * @notice Preview how many LYT tokens a given ETH purchase would earn.
     */
    function previewTokenReward(uint256 ethAmount) external pure returns (uint256) {
        return (ethAmount * TOKENS_PER_ETH) / DECIMALS_FACTOR;
    }
}
