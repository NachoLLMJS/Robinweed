// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGameEconomyRouter {
    struct BasketRequest {
        address payer;
        uint256 amount;
        bytes32[] tickers;
        uint16[] weightsBps;
        uint256[] minimumOuts;
        uint256 deadline;
    }

    function spendFrom(
        address payer,
        uint256 amount,
        bytes32 ticker,
        bytes32 purchaseType,
        uint256 minimumOut,
        uint256 deadline
    ) external returns (uint256 rewardOutput);

    function spendBasketFrom(BasketRequest calldata request) external returns (uint256[] memory outputs);
    function routes(bytes32 ticker) external view returns (address rewardToken, address rewardVault, address adapter, bool enabled);
}

interface IGameRewardVault {
    function creditPack(address buyer, uint32 seeds, uint256 rawAssets) external;
    function creditReserve(uint256 rawAssets) external;
    function consumeSeed(address buyer, bytes32 positionId) external returns (uint256 entitlement);
    function release(bytes32 positionId, address recipient) external returns (uint256 amount);
}

contract StockdealerGameCore is Ownable2Step, ReentrancyGuard {
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    bytes32 public constant PURCHASE_SEEDS = bytes32("SEEDS");
    uint32 public constant MAX_PACKS_PER_PURCHASE = 100;
    uint256 public constant GROWTH_INTERVAL = 2 hours;
    uint8 public constant MATURE_STAGE = 5;

    struct SeedSku {
        uint256 packPrice;
        uint32 seedsPerPack;
        address rewardVault;
        bool configured;
    }

    struct House {
        uint256 price;
        uint8 capacity;
        bool configured;
    }

    struct Plant {
        bytes32 ticker;
        uint64 plantedAt;
        uint64 wateredAt;
        bytes32 rewardPosition;
        address fundingVault;
    }

    IGameEconomyRouter public immutable economyRouter;
    bool public purchasesPaused = true;
    bool public gameplayPaused = true;
    bool public claimsPaused = true;
    mapping(bytes32 ticker => SeedSku sku) public seedSkus;
    mapping(uint32 houseId => House house) public houses;
    mapping(uint32 houseId => address owner) public houseOwner;
    mapping(uint32 houseId => mapping(uint8 plotId => Plant plant)) public plants;
    uint256 private nextPositionNonce;
    bytes32[] private houseBasketTickers;
    uint16[] private houseBasketWeights;

    error WrongChain();
    error InvalidContract();
    error InvalidConfiguration();
    error PurchasesArePaused();
    error SkuUnavailable();
    error InvalidPackCount();
    error PriceExceeded();
    error HouseUnavailable();
    error HouseAlreadyOwned();
    error InvalidBasket();
    error GameplayIsPaused();
    error ClaimsArePaused();
    error NotHouseOwner();
    error InvalidPlot();
    error PlotOccupied();
    error PlotEmpty();
    error AlreadyWatered();
    error NotMature();

    event SeedSkuConfigured(bytes32 indexed ticker, uint256 packPrice, uint32 seedsPerPack, address indexed rewardVault);
    event PurchasesEnabled();
    event PurchasesPaused();
    event SeedPacksPurchased(address indexed buyer, bytes32 indexed ticker, uint32 packs, uint32 seeds, uint256 paid, uint256 rawStockCredit);
    event HouseBasketConfigured(bytes32[] tickers, uint16[] weightsBps);
    event HouseConfigured(uint32 indexed houseId, uint256 price, uint8 capacity);
    event HousePurchased(address indexed buyer, uint32 indexed houseId, uint256 paid, uint8 capacity);
    event GameplayEnabled();
    event GameplayPaused();
    event ClaimsEnabled();
    event ClaimsPaused();
    event SeedPlanted(address indexed owner, uint32 indexed houseId, uint8 indexed plotId, bytes32 ticker, bytes32 rewardPosition);
    event PlantWatered(address indexed owner, uint32 indexed houseId, uint8 indexed plotId, uint64 wateredAt);
    event HarvestClaimed(address indexed owner, uint32 indexed houseId, uint8 indexed plotId, bytes32 ticker, uint256 rawAssets);

    constructor(address initialOwner, address economyRouter_) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if (economyRouter_.code.length == 0) revert InvalidContract();
        economyRouter = IGameEconomyRouter(economyRouter_);
    }

    function configureSeedSku(bytes32 ticker, uint256 packPrice, uint32 seedsPerPack, address rewardVault) external onlyOwner {
        if (!purchasesPaused) revert InvalidConfiguration();
        if (ticker == bytes32(0) || packPrice == 0 || packPrice % 5 != 0 || seedsPerPack == 0 || rewardVault.code.length == 0) {
            revert InvalidConfiguration();
        }
        (, address routeVault,, bool routeEnabled) = economyRouter.routes(ticker);
        if (!routeEnabled || routeVault != rewardVault) revert InvalidConfiguration();
        if (seedSkus[ticker].configured && seedSkus[ticker].rewardVault != rewardVault) revert InvalidConfiguration();
        seedSkus[ticker] = SeedSku(packPrice, seedsPerPack, rewardVault, true);
        emit SeedSkuConfigured(ticker, packPrice, seedsPerPack, rewardVault);
    }

    function configureHouseBasket(bytes32[] calldata tickers, uint16[] calldata weightsBps) external onlyOwner {
        if (!purchasesPaused || tickers.length == 0 || tickers.length > 8 || tickers.length != weightsBps.length) revert InvalidBasket();
        uint256 totalWeight;
        delete houseBasketTickers;
        delete houseBasketWeights;
        for (uint256 i; i < tickers.length; ++i) {
            if (tickers[i] == bytes32(0) || weightsBps[i] == 0) revert InvalidBasket();
            (, , , bool enabled) = economyRouter.routes(tickers[i]);
            if (!enabled) revert InvalidBasket();
            for (uint256 j; j < i; ++j) if (tickers[j] == tickers[i]) revert InvalidBasket();
            totalWeight += weightsBps[i];
            houseBasketTickers.push(tickers[i]);
            houseBasketWeights.push(weightsBps[i]);
        }
        if (totalWeight != 10_000) revert InvalidBasket();
        emit HouseBasketConfigured(tickers, weightsBps);
    }

    function houseBasket() external view returns (bytes32[] memory tickers, uint16[] memory weightsBps) {
        return (houseBasketTickers, houseBasketWeights);
    }

    function configureHouse(uint32 houseId, uint256 price, uint8 capacity) external onlyOwner {
        if (!purchasesPaused || houseId == 0 || price == 0 || price % 5 != 0 || (capacity != 4 && capacity != 8 && capacity != 15)) {
            revert InvalidConfiguration();
        }
        if (houseOwner[houseId] != address(0)) revert HouseAlreadyOwned();
        houses[houseId] = House(price, capacity, true);
        emit HouseConfigured(houseId, price, capacity);
    }

    function enablePurchases() external onlyOwner {
        purchasesPaused = false;
        emit PurchasesEnabled();
    }

    function pausePurchases() external onlyOwner {
        purchasesPaused = true;
        emit PurchasesPaused();
    }

    function buySeedPacks(
        bytes32 ticker,
        uint32 packs,
        uint256 maxTotalPrice,
        uint256 minimumStockOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 rawStockCredit) {
        if (purchasesPaused) revert PurchasesArePaused();
        SeedSku memory sku = seedSkus[ticker];
        if (!sku.configured) revert SkuUnavailable();
        if (packs == 0 || packs > MAX_PACKS_PER_PURCHASE) revert InvalidPackCount();
        uint256 totalPrice = sku.packPrice * packs;
        if (totalPrice > maxTotalPrice) revert PriceExceeded();
        rawStockCredit = economyRouter.spendFrom(msg.sender, totalPrice, ticker, PURCHASE_SEEDS, minimumStockOut, deadline);
        uint32 seedCount = sku.seedsPerPack * packs;
        IGameRewardVault(sku.rewardVault).creditPack(msg.sender, seedCount, rawStockCredit);
        emit SeedPacksPurchased(msg.sender, ticker, packs, seedCount, totalPrice, rawStockCredit);
    }

    function buyHouse(
        uint32 houseId,
        uint256 maxPrice,
        uint256[] calldata minimumOuts,
        uint256 deadline
    ) external nonReentrant returns (uint256[] memory outputs) {
        if (purchasesPaused) revert PurchasesArePaused();
        House memory house = houses[houseId];
        if (!house.configured || houseBasketTickers.length == 0) revert HouseUnavailable();
        if (houseOwner[houseId] != address(0)) revert HouseAlreadyOwned();
        if (house.price > maxPrice) revert PriceExceeded();
        if (minimumOuts.length != houseBasketTickers.length) revert InvalidBasket();
        bytes32[] memory tickers = houseBasketTickers;
        uint16[] memory weights = houseBasketWeights;
        outputs = economyRouter.spendBasketFrom(IGameEconomyRouter.BasketRequest({
            payer: msg.sender,
            amount: house.price,
            tickers: tickers,
            weightsBps: weights,
            minimumOuts: minimumOuts,
            deadline: deadline
        }));
        for (uint256 i; i < tickers.length; ++i) {
            (, address routeVault,,) = economyRouter.routes(tickers[i]);
            IGameRewardVault(routeVault).creditReserve(outputs[i]);
        }
        houseOwner[houseId] = msg.sender;
        emit HousePurchased(msg.sender, houseId, house.price, house.capacity);
    }

    function enableGameplay() external onlyOwner {
        gameplayPaused = false;
        emit GameplayEnabled();
    }

    function pauseGameplay() external onlyOwner {
        gameplayPaused = true;
        emit GameplayPaused();
    }

    function enableClaims() external onlyOwner {
        claimsPaused = false;
        emit ClaimsEnabled();
    }

    function pauseClaims() external onlyOwner {
        claimsPaused = true;
        emit ClaimsPaused();
    }

    function plant(uint32 houseId, uint8 plotId, bytes32 ticker) external nonReentrant returns (bytes32 positionId) {
        if (gameplayPaused) revert GameplayIsPaused();
        House memory house = houses[houseId];
        if (houseOwner[houseId] != msg.sender) revert NotHouseOwner();
        if (plotId >= house.capacity) revert InvalidPlot();
        if (plants[houseId][plotId].ticker != bytes32(0)) revert PlotOccupied();
        SeedSku memory sku = seedSkus[ticker];
        if (!sku.configured) revert SkuUnavailable();
        positionId = keccak256(abi.encode(block.chainid, address(this), msg.sender, houseId, plotId, ++nextPositionNonce));
        IGameRewardVault(sku.rewardVault).consumeSeed(msg.sender, positionId);
        plants[houseId][plotId] = Plant(ticker, uint64(block.timestamp), 0, positionId, sku.rewardVault);
        emit SeedPlanted(msg.sender, houseId, plotId, ticker, positionId);
    }

    function water(uint32 houseId, uint8 plotId) external {
        if (gameplayPaused) revert GameplayIsPaused();
        if (houseOwner[houseId] != msg.sender) revert NotHouseOwner();
        Plant storage crop = plants[houseId][plotId];
        if (crop.ticker == bytes32(0)) revert PlotEmpty();
        if (crop.wateredAt != 0) revert AlreadyWatered();
        crop.wateredAt = uint64(block.timestamp);
        emit PlantWatered(msg.sender, houseId, plotId, crop.wateredAt);
    }

    function plantStage(uint32 houseId, uint8 plotId) public view returns (uint8) {
        Plant memory crop = plants[houseId][plotId];
        if (crop.ticker == bytes32(0)) return 0;
        if (crop.wateredAt == 0) return 1;
        uint256 transitions = (block.timestamp - crop.wateredAt) / GROWTH_INTERVAL;
        return uint8(transitions >= 4 ? MATURE_STAGE : 1 + transitions);
    }

    function claimHarvest(uint32 houseId, uint8 plotId, address recipient) external nonReentrant returns (uint256 rawAssets) {
        if (claimsPaused) revert ClaimsArePaused();
        if (houseOwner[houseId] != msg.sender) revert NotHouseOwner();
        if (recipient == address(0)) revert InvalidConfiguration();
        Plant memory crop = plants[houseId][plotId];
        if (crop.ticker == bytes32(0)) revert PlotEmpty();
        if (plantStage(houseId, plotId) != MATURE_STAGE) revert NotMature();
        delete plants[houseId][plotId];
        rawAssets = IGameRewardVault(crop.fundingVault).release(crop.rewardPosition, recipient);
        emit HarvestClaimed(msg.sender, houseId, plotId, crop.ticker, rawAssets);
    }
}
