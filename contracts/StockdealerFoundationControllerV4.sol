// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IFoundationRouterV4 {
    function configureCurrency(address token) external;
    function configureRoute(bytes32 ticker, address rewardToken, address rewardVault, address adapter) external;
    function configureGameCore(address core) external;
    function activate() external;
    function pause() external;
    function paused() external view returns (bool);
}

interface IFoundationAdapterV4 {
    function ponsFactory() external view returns (IPonsFactoryV4);
    function configurePath(address tokenIn, address tokenOut, bytes calldata routeData) external;
    function freezeConfiguration() external;
}

interface IFoundationCoreV4 {
    function configureSeedSku(bytes32 ticker, uint256 packPrice, uint32 seedsPerPack, address rewardVault) external;
    function configureHouseBasket(bytes32[] calldata tickers, uint16[] calldata weightsBps) external;
    function configureHouse(uint32 houseId, uint256 price, uint8 capacity) external;
    function enablePurchases() external;
    function pausePurchases() external;
    function enableGameplay() external;
    function pauseGameplay() external;
    function enableClaims() external;
    function pauseClaims() external;
    function purchasesPaused() external view returns (bool);
    function gameplayPaused() external view returns (bool);
    function claimsPaused() external view returns (bool);
}

interface IFoundationVaultV4 {
    function asset() external view returns (address);
    function configureGameCore(address core) external;
    function withdrawProtocolReserve(address recipient, uint256 rawAssets) external;
    function recoverSurplus(address recipient, uint256 amount) external;
}

interface IPonsFactoryV4 {
    struct LaunchedToken {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        address pairToken;
        uint256 graduationThreshold;
        uint24 poolFee;
        int24 tickSpacing;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        uint8 phase;
        uint256 sweptQuote;
        uint256 sweptTokens;
        uint256 sweptAt;
        bool exists;
    }

    function getLaunchedToken(address token) external view returns (LaunchedToken memory);
}

contract StockdealerFoundationControllerV4 is Ownable2Step, ReentrancyGuard {
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    uint256 public constant REQUIRED_TICKERS = 7;
    uint256 public constant REQUIRED_HOUSES = 35;

    struct HouseConfig {
        uint32 houseId;
        uint256 price;
        uint8 capacity;
    }

    struct ActivationConfig {
        address token;
        bytes[] routeData;
        uint256 seedPackPrice;
        uint32 seedsPerPack;
        uint16[] basketWeightsBps;
        HouseConfig[] houses;
    }

    IPonsFactoryV4 public immutable ponsFactory;
    IFoundationRouterV4 public economyRouter;
    IFoundationAdapterV4 public ponsAdapter;
    IFoundationCoreV4 public gameCore;
    bool public foundationConfigured;
    bool public activated;
    address public stockdealerToken;
    bytes32[] private foundationTickers;
    address[] private stockTokens;
    address[] private rewardVaults;

    error WrongChain();
    error InvalidContract();
    error InvalidConfiguration();
    error FoundationAlreadyConfigured();
    error FoundationNotConfigured();
    error EconomyAlreadyActivated();
    error InvalidPonsLaunch();
    error InvalidRoute();

    event FoundationConfigured(address indexed economyRouter, address indexed ponsAdapter, address indexed gameCore);
    event StockdealerEconomyActivated(address indexed token);
    event EconomyPaused();
    event EconomyResumed();


    constructor(address initialOwner, address ponsFactory_) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if (ponsFactory_.code.length == 0) revert InvalidContract();
        ponsFactory = IPonsFactoryV4(ponsFactory_);
    }

    function configureFoundation(
        address router,
        address adapter,
        address core,
        bytes32[] calldata tickers,
        address[] calldata rewardTokens,
        address[] calldata vaults
    ) external onlyOwner nonReentrant {
        if (foundationConfigured) revert FoundationAlreadyConfigured();
        if (router.code.length == 0 || adapter.code.length == 0 || core.code.length == 0) revert InvalidContract();
        if (address(IFoundationAdapterV4(adapter).ponsFactory()) != address(ponsFactory)) revert InvalidContract();
        if (tickers.length != REQUIRED_TICKERS || rewardTokens.length != REQUIRED_TICKERS || vaults.length != REQUIRED_TICKERS) {
            revert InvalidConfiguration();
        }

        economyRouter = IFoundationRouterV4(router);
        ponsAdapter = IFoundationAdapterV4(adapter);
        gameCore = IFoundationCoreV4(core);
        economyRouter.configureGameCore(core);

        for (uint256 i; i < REQUIRED_TICKERS; ++i) {
            if (tickers[i] == bytes32(0) || rewardTokens[i].code.length == 0 || vaults[i].code.length == 0) revert InvalidContract();
            if (IFoundationVaultV4(vaults[i]).asset() != rewardTokens[i]) revert InvalidConfiguration();
            for (uint256 j; j < i; ++j) {
                if (tickers[j] == tickers[i] || rewardTokens[j] == rewardTokens[i] || vaults[j] == vaults[i]) {
                    revert InvalidConfiguration();
                }
            }
            foundationTickers.push(tickers[i]);
            stockTokens.push(rewardTokens[i]);
            rewardVaults.push(vaults[i]);
            IFoundationVaultV4(vaults[i]).configureGameCore(core);
            economyRouter.configureRoute(tickers[i], rewardTokens[i], vaults[i], adapter);
        }

        foundationConfigured = true;
        emit FoundationConfigured(router, adapter, core);
    }

    function activateStockdealerEconomy(ActivationConfig calldata config) external onlyOwner nonReentrant {
        if (!foundationConfigured) revert FoundationNotConfigured();
        if (activated || stockdealerToken != address(0)) revert EconomyAlreadyActivated();
        if (
            config.token.code.length == 0 || config.routeData.length != REQUIRED_TICKERS ||
            config.seedPackPrice == 0 || config.seedsPerPack == 0 ||
            config.basketWeightsBps.length != REQUIRED_TICKERS || config.houses.length != REQUIRED_HOUSES
        ) revert InvalidConfiguration();
        for (uint256 i; i < REQUIRED_HOUSES; ++i) {
            if (config.houses[i].houseId != i + 1) revert InvalidConfiguration();
        }

        IPonsFactoryV4.LaunchedToken memory launch = ponsFactory.getLaunchedToken(config.token);
        if (
            !launch.exists || launch.token != config.token || launch.curve.code.length == 0 ||
            (launch.pairToken != address(0) && launch.pairToken.code.length == 0) ||
            launch.phase != 0 || IERC20(config.token).totalSupply() == 0
        ) revert InvalidPonsLaunch();
        // A bounded decimals call rejects malformed ERC-20 metadata before any module is opened.
        if (IERC20Metadata(config.token).decimals() > 36) revert InvalidPonsLaunch();

        economyRouter.configureCurrency(config.token);
        for (uint256 i; i < REQUIRED_TICKERS; ++i) {
            (address curve, address pairToken,) = abi.decode(config.routeData[i], (address, address, bytes));
            if (curve != launch.curve || pairToken != launch.pairToken) revert InvalidRoute();
            ponsAdapter.configurePath(config.token, stockTokens[i], config.routeData[i]);
            gameCore.configureSeedSku(foundationTickers[i], config.seedPackPrice, config.seedsPerPack, rewardVaults[i]);
        }
        gameCore.configureHouseBasket(foundationTickers, config.basketWeightsBps);
        for (uint256 i; i < REQUIRED_HOUSES; ++i) {
            gameCore.configureHouse(config.houses[i].houseId, config.houses[i].price, config.houses[i].capacity);
        }

        ponsAdapter.freezeConfiguration();
        gameCore.enableClaims();
        gameCore.enableGameplay();
        economyRouter.activate();
        gameCore.enablePurchases();

        stockdealerToken = config.token;
        activated = true;
        emit StockdealerEconomyActivated(config.token);
    }

    function pauseEconomy() external onlyOwner nonReentrant {
        if (!foundationConfigured) revert FoundationNotConfigured();
        if (!gameCore.purchasesPaused()) gameCore.pausePurchases();
        if (!gameCore.gameplayPaused()) gameCore.pauseGameplay();
        if (!gameCore.claimsPaused()) gameCore.pauseClaims();
        if (!economyRouter.paused()) economyRouter.pause();
        emit EconomyPaused();
    }

    function resumeEconomy() external onlyOwner nonReentrant {
        if (!activated) revert FoundationNotConfigured();
        if (gameCore.claimsPaused()) gameCore.enableClaims();
        if (gameCore.gameplayPaused()) gameCore.enableGameplay();
        if (economyRouter.paused()) economyRouter.activate();
        if (gameCore.purchasesPaused()) gameCore.enablePurchases();
        emit EconomyResumed();
    }


    function withdrawProtocolReserve(uint256 tickerIndex, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (tickerIndex >= REQUIRED_TICKERS) revert InvalidConfiguration();
        IFoundationVaultV4(rewardVaults[tickerIndex]).withdrawProtocolReserve(recipient, amount);
    }

    function recoverVaultSurplus(uint256 tickerIndex, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (tickerIndex >= REQUIRED_TICKERS) revert InvalidConfiguration();
        IFoundationVaultV4(rewardVaults[tickerIndex]).recoverSurplus(recipient, amount);
    }

    function tickerCount() external view returns (uint256) { return foundationTickers.length; }
    function tickerAt(uint256 index) external view returns (bytes32 ticker, address rewardToken, address rewardVault) {
        return (foundationTickers[index], stockTokens[index], rewardVaults[index]);
    }
}
