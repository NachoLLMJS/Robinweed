// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockUniswapV3Router {
    using SafeERC20 for IERC20;
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        address tokenIn;
        address tokenOut;
        bytes calldata path = params.path;
        assembly {
            tokenIn := shr(96, calldataload(path.offset))
            tokenOut := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        amountOut = params.amountIn;
        require(amountOut >= params.amountOutMinimum, "MIN_OUT");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(tokenOut).safeTransfer(params.recipient, amountOut);
    }
}
