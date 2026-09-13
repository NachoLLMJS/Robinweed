// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockUniswapV3Pool {
    function liquidity() external pure returns (uint128) { return 1; }
}

contract MockUniswapV3Factory {
    address internal constant POOL = 0x000000000000000000000000000000000000F001;
    function getPool(address, address, uint24 fee) external pure returns (address) {
        return fee == 123 ? address(0) : POOL;
    }
}