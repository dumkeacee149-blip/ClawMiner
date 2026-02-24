// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/Mining.sol";

contract MiningTest is Test {
    function testDomainSeparator() public {
        Mining m = new Mining(address(0xBEEF));
        bytes32 ds = m.domainSeparator();
        assertTrue(ds != bytes32(0));
    }
}
