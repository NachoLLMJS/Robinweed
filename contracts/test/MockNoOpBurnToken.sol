// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockNoOpBurnToken is ERC20 {
    constructor() ERC20("No-op Burn", "NOOP") {}
    function mint(address recipient, uint256 amount) external { _mint(recipient, amount); }
    function burn(uint256) external pure {}
}
