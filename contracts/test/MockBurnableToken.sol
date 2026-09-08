// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MockBurnableToken is ERC20, ERC20Burnable {
    constructor() ERC20("Mock Stockdealer", "MOCK") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}
