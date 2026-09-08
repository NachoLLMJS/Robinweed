// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAdapterForCaller {
    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256 minimumOut, uint256 deadline, address recipient) external returns (uint256);
}

contract MockAdapterCaller {
    function approve(address token, address spender, uint256 amount) external { IERC20(token).approve(spender, amount); }
    function swap(address adapter, address tokenIn, address tokenOut, uint256 amountIn, uint256 minimumOut, uint256 deadline, address recipient) external returns (uint256) {
        return IAdapterForCaller(adapter).swapExactInput(tokenIn, tokenOut, amountIn, minimumOut, deadline, recipient);
    }
}
