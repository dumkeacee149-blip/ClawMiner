// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Minimal BEP20-like token (placeholder). Replace with OpenZeppelin ERC20Capped in implementation.
contract ClawToken {
    string public name = "ClawMiner";
    string public symbol = "CLAW";
    uint8 public decimals = 18;

    uint256 public totalSupply;
    uint256 public immutable cap;
    address public immutable minter;

    mapping(address => uint256) public balanceOf;

    constructor(uint256 _cap, address _minter) {
        cap = _cap;
        minter = _minter;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "NOT_MINTER");
        require(totalSupply + amount <= cap, "CAP");
        totalSupply += amount;
        balanceOf[to] += amount;
    }
}
