// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSwapAdapter {
    using SafeERC20 for IERC20;

    error DeadlineExpired();
    error InsufficientOutput();

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minimumOut,
        uint256 deadline,
        address recipient
    ) external returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        amountOut = amountIn;
        if (amountOut < minimumOut) revert InsufficientOutput();
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
