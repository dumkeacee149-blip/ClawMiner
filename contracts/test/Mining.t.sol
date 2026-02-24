// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/Mining.sol";

contract MiningTest is Test {
    function testSubmitReceiptRecordsCredits() public {
        Mining m = new Mining(address(0xBEEF));
        m.submitReceipt(0, address(this), 1, keccak256("r"));
        assertEq(m.credits(0, address(this)), 1);
        assertEq(m.totalCredits(0), 1);
    }
}
