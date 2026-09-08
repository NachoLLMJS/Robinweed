// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

interface IStockdealerSwapAdapter {
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minimumOut,
        uint256 deadline,
        address recipient
    ) external returns (uint256 amountOut);
}

interface IRewardVaultAsset {
    function asset() external view returns (IERC20);
}

contract StockdealerEconomyRouter is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant BURN_BPS = 4_000;
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;

    struct Route {
        address rewardToken;
        address rewardVault;
        address adapter;
        bool enabled;
    }

    struct BasketRequest {
        address payer;
        uint256 amount;
        bytes32[] tickers;
        uint16[] weightsBps;
        uint256[] minimumOuts;
        uint256 deadline;
    }

    error CurrencyAlreadyConfigured();
    error InvalidContract();
    error InvalidAddress();
    error UnauthorizedSpender();
    error InvalidAmount();
    error CurrencyTransferMismatch();
    error RouteUnavailable();
    error InsufficientOutput();
    error ActivationIncomplete();
    error WrongChain();
    error GameCoreAlreadyConfigured();
    error InvalidBasket();
    error RouteAlreadyConfigured();
    error BurnInvariantFailed();

    address public currency;
    address public gameCore;
    mapping(bytes32 ticker => Route route) public routes;

    event CurrencyConfigured(address indexed currency);
    event RouteConfigured(bytes32 indexed ticker, address indexed rewardToken, address indexed rewardVault, address adapter);
    event GameCoreConfigured(address indexed gameCore);
    event EconomyActivated();
    event Spent(
        address indexed payer,
        bytes32 indexed ticker,
        bytes32 indexed purchaseType,
        uint256 amountIn,
        uint256 burned,
        uint256 rewardInput,
        uint256 rewardOutput
    );
    event BasketSpent(address indexed payer, uint256 amountIn, uint256 burned, uint256 rewardInput);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        _pause();
    }

    function configureCurrency(address token) external onlyOwner {
        if (currency != address(0)) revert CurrencyAlreadyConfigured();
        if (token.code.length == 0) revert InvalidContract();
        currency = token;
        emit CurrencyConfigured(token);
    }

    function configureRoute(bytes32 ticker, address rewardToken, address rewardVault, address adapter) external onlyOwner whenPaused {
        if (routes[ticker].enabled) revert RouteAlreadyConfigured();
        if (ticker == bytes32(0) || rewardToken.code.length == 0 || rewardVault.code.length == 0 || adapter.code.length == 0) revert InvalidContract();
        if (address(IRewardVaultAsset(rewardVault).asset()) != rewardToken) revert InvalidContract();
        routes[ticker] = Route(rewardToken, rewardVault, adapter, true);
        emit RouteConfigured(ticker, rewardToken, rewardVault, adapter);
    }

    function configureGameCore(address core) external onlyOwner whenPaused {
        if (gameCore != address(0)) revert GameCoreAlreadyConfigured();
        if (core.code.length == 0) revert InvalidContract();
        gameCore = core;
        emit GameCoreConfigured(core);
    }

    function activate() external onlyOwner whenPaused {
        if (currency == address(0) || gameCore == address(0)) revert ActivationIncomplete();
        _unpause();
        emit EconomyActivated();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function spendFrom(
        address payer,
        uint256 amount,
        bytes32 ticker,
        bytes32 purchaseType,
        uint256 minimumOut,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 rewardOutput) {
        if (msg.sender != gameCore) revert UnauthorizedSpender();
        if (payer == address(0) || amount == 0 || amount % 5 != 0) revert InvalidAmount();
        Route memory route = routes[ticker];
        if (!route.enabled) revert RouteUnavailable();

        IERC20 paymentToken = IERC20(currency);
        uint256 beforePayment = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(payer, address(this), amount);
        if (paymentToken.balanceOf(address(this)) - beforePayment != amount) revert CurrencyTransferMismatch();

        (uint256 burned, uint256 rewardInput) = _burnPayment(paymentToken, amount);

        rewardOutput = _swapReward(paymentToken, route, rewardInput, minimumOut, deadline);

        emit Spent(payer, ticker, purchaseType, amount, burned, rewardInput, rewardOutput);
    }

    function spendBasketFrom(BasketRequest calldata request) external whenNotPaused nonReentrant returns (uint256[] memory outputs) {
        if (msg.sender != gameCore) revert UnauthorizedSpender();
        if (request.payer == address(0) || request.amount == 0 || request.amount % 5 != 0) revert InvalidAmount();
        uint256 length = request.tickers.length;
        if (length == 0 || length > 8 || request.weightsBps.length != length || request.minimumOuts.length != length) revert InvalidBasket();
        uint256 totalWeight;
        for (uint256 i; i < length; ++i) {
            if (request.tickers[i] == bytes32(0) || request.weightsBps[i] == 0 || !routes[request.tickers[i]].enabled) revert InvalidBasket();
            for (uint256 j; j < i; ++j) if (request.tickers[j] == request.tickers[i]) revert InvalidBasket();
            totalWeight += request.weightsBps[i];
        }
        if (totalWeight != BPS) revert InvalidBasket();

        IERC20 paymentToken = IERC20(currency);
        uint256 beforePayment = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(request.payer, address(this), request.amount);
        if (paymentToken.balanceOf(address(this)) - beforePayment != request.amount) revert CurrencyTransferMismatch();
        (uint256 burned, uint256 rewardInput) = _burnPayment(paymentToken, request.amount);

        outputs = _executeBasketSwaps(paymentToken, request, rewardInput);
        emit BasketSpent(request.payer, request.amount, burned, rewardInput);
    }

    function _burnPayment(IERC20 paymentToken, uint256 amount) internal returns (uint256 burned, uint256 rewardInput) {
        burned = amount * BURN_BPS / BPS;
        rewardInput = amount - burned;
        uint256 supplyBefore = paymentToken.totalSupply();
        uint256 balanceBeforeBurn = paymentToken.balanceOf(address(this));
        IERC20Burnable(currency).burn(burned);
        if (paymentToken.totalSupply() != supplyBefore - burned || paymentToken.balanceOf(address(this)) != balanceBeforeBurn - burned) revert BurnInvariantFailed();
    }

    function _executeBasketSwaps(
        IERC20 paymentToken,
        BasketRequest calldata request,
        uint256 rewardInput
    ) internal returns (uint256[] memory outputs) {
        uint256 length = request.tickers.length;
        outputs = new uint256[](length);
        uint256 allocated;
        for (uint256 i; i < length; ++i) {
            uint256 routeInput = i + 1 == length ? rewardInput - allocated : rewardInput * request.weightsBps[i] / BPS;
            if (routeInput == 0) revert InvalidBasket();
            allocated += routeInput;
            outputs[i] = _swapReward(paymentToken, routes[request.tickers[i]], routeInput, request.minimumOuts[i], request.deadline);
        }
    }

    function _swapReward(
        IERC20 paymentToken,
        Route memory route,
        uint256 rewardInput,
        uint256 minimumOut,
        uint256 deadline
    ) internal returns (uint256 rewardOutput) {
        IERC20 rewardToken = IERC20(route.rewardToken);
        uint256 beforeReward = rewardToken.balanceOf(route.rewardVault);
        paymentToken.forceApprove(route.adapter, rewardInput);
        IStockdealerSwapAdapter(route.adapter).swapExactInput(
            currency,
            route.rewardToken,
            rewardInput,
            minimumOut,
            deadline,
            route.rewardVault
        );
        paymentToken.forceApprove(route.adapter, 0);
        rewardOutput = rewardToken.balanceOf(route.rewardVault) - beforeReward;
        if (rewardOutput < minimumOut) revert InsufficientOutput();
    }
}
