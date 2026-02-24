// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal EIP-712 receipt verifier + credit accounting (MVP).
contract Mining {
    // --- EIP-712 domain ---
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant RECEIPT_TYPEHASH = keccak256(
        "Receipt(uint256 chainId,uint256 epochId,address miner,bytes32 challengeId,bytes32 nonceHash,uint256 creditsAmount,bytes32 artifactHash,uint256 issuedAt)"
    );

    string public constant NAME = "ClawMiner";
    string public constant VERSION = "1";

    address public immutable coordinatorSigner;

    mapping(uint256 => mapping(address => uint256)) public credits;
    mapping(uint256 => uint256) public totalCredits;
    mapping(bytes32 => bool) public usedReceiptHash;

    event ReceiptAccepted(uint256 indexed epochId, address indexed miner, uint256 credits, bytes32 receiptHash);

    constructor(address _coordinatorSigner) {
        coordinatorSigner = _coordinatorSigner;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes(NAME)), keccak256(bytes(VERSION)), block.chainid, address(this)
            )
        );
    }

    struct Receipt {
        uint256 chainId;
        uint256 epochId;
        address miner;
        bytes32 challengeId;
        bytes32 nonceHash;
        uint256 creditsAmount;
        bytes32 artifactHash;
        uint256 issuedAt;
    }

    function hashReceipt(Receipt memory r) public view returns (bytes32) {
        // Note: include chainId in struct too, to prevent cross-chain replay.
        bytes32 structHash = keccak256(
            abi.encode(
                RECEIPT_TYPEHASH,
                r.chainId,
                r.epochId,
                r.miner,
                r.challengeId,
                r.nonceHash,
                r.creditsAmount,
                r.artifactHash,
                r.issuedAt
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function submitReceipt(Receipt calldata r, bytes calldata sig) external {
        require(r.chainId == block.chainid, "CHAIN_ID");
        require(r.miner != address(0), "MINER_ZERO");
        require(r.creditsAmount > 0, "CREDITS_ZERO");

        bytes32 digest = hashReceipt(r);
        require(!usedReceiptHash[digest], "REPLAY");

        address recovered = _recover(digest, sig);
        require(recovered == coordinatorSigner, "BAD_SIG");

        usedReceiptHash[digest] = true;
        credits[r.epochId][r.miner] += r.creditsAmount;
        totalCredits[r.epochId] += r.creditsAmount;

        emit ReceiptAccepted(r.epochId, r.miner, r.creditsAmount, digest);
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
