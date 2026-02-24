// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/Mining.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address signer = vm.envAddress("COORDINATOR_SIGNER_ADDRESS");
        vm.startBroadcast(pk);
        Mining m = new Mining(signer);
        vm.stopBroadcast();
        console2.log("Mining deployed:", address(m));
        console2.log("Coordinator signer:", signer);
        console2.logBytes32(m.domainSeparator());
    }
}
