// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IEconomyRouter {
    struct BasketRequest {
        address payer;
        uint256 amount;
        bytes32[] tickers;
        uint16[] weightsBps;
        uint256[] minimumOuts;
        uint256 deadline;
    }

    function spendFrom(address payer, uint256 amount, bytes32 ticker, bytes32 purchaseType, uint256 minimumOut, uint256 deadline) external returns (uint256);
    function spendBasketFrom(BasketRequest calldata request) external returns (uint256[] memory);
}

contract MockGameCore {
    IEconomyRouter public immutable router;

    constructor(address router_) {
        router = IEconomyRouter(router_);
    }

    function spend(address payer, uint256 amount, bytes32 ticker, bytes32 purchaseType, uint256 minimumOut, uint256 deadline) external returns (uint256) {
        return router.spendFrom(payer, amount, ticker, purchaseType, minimumOut, deadline);
    }

    function spendBasket(address payer, uint256 amount, bytes32[] calldata tickers, uint16[] calldata weightsBps, uint256[] calldata minimumOuts, uint256 deadline) external returns (uint256[] memory) {
        return router.spendBasketFrom(IEconomyRouter.BasketRequest(payer, amount, tickers, weightsBps, minimumOuts, deadline));
    }
}
