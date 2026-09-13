// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockPonsBondingCurve {
    using SafeERC20 for IERC20;
    address public immutable token;
    address public immutable pairToken;
    bool public graduated;
    bool public readyToGraduate;

    constructor(address token_, address pairToken_) { token = token_; pairToken = pairToken_; }
    function setGraduated(bool value) external { graduated = value; }
    function setReadyToGraduate(bool value) external { readyToGraduate = value; }
    function sell(uint256 amountIn, uint256 minimumOut, address recipient) external returns (uint256 amountOut) {
        require(!graduated, "GRADUATED");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn;
        require(amountOut >= minimumOut, "MIN_OUT");
        IERC20(pairToken).safeTransfer(recipient, amountOut);
    }
}
