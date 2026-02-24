// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Placeholder. Production version should use EIP-712 typed receipts + OZ ECDSA.
contract Mining {
    address public coordinatorSigner;

    mapping(uint256 => mapping(address => uint256)) public credits;
    mapping(uint256 => uint256) public totalCredits;
    mapping(bytes32 => bool) public usedReceipts;

    constructor(address _signer) {
        coordinatorSigner = _signer;
    }

    function submitReceipt(
        uint256 epochId,
        address miner,
        uint256 credit,
        bytes32 receiptHash
    ) external {
        // TODO: verify coordinator signature over receipt fields
        require(!usedReceipts[receiptHash], "REPLAY");
        usedReceipts[receiptHash] = true;
        credits[epochId][miner] += credit;
        totalCredits[epochId] += credit;
    }
}
