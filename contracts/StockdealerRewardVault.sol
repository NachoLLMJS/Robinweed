// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StockdealerRewardVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    IERC20 public immutable asset;
    address public gameCore;
    uint256 public totalLiability;
    uint256 public protocolReserve;

    mapping(address buyer => uint256 count) public remainingSeeds;
    mapping(address buyer => uint256 rawAssets) public unassignedCredit;
    mapping(bytes32 positionId => uint256 rawAssets) public positionEntitlement;

    error WrongChain();
    error InvalidContract();
    error InvalidInput();
    error UnauthorizedGameCore();
    error GameCoreAlreadyConfigured();
    error InsolventCredit();
    error PositionAlreadyAssigned();
    error NoFundedSeed();
    error NoEntitlement();
    error SurplusExceeded();

    event GameCoreConfigured(address indexed gameCore);
    event PackCredited(address indexed buyer, uint32 seeds, uint256 rawAssets);
    event ProtocolReserveCredited(uint256 rawAssets);
    event ProtocolReserveWithdrawn(address indexed recipient, uint256 rawAssets);
    event SeedConsumed(address indexed buyer, bytes32 indexed positionId, uint256 rawAssets);
    event RewardReleased(bytes32 indexed positionId, address indexed recipient, uint256 rawAssets);
    event SurplusRecovered(address indexed recipient, uint256 rawAssets);

    modifier onlyGameCore() {
        if (msg.sender != gameCore) revert UnauthorizedGameCore();
        _;
    }

    constructor(address initialOwner, address asset_) Ownable(initialOwner) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert WrongChain();
        if (asset_.code.length == 0) revert InvalidContract();
        asset = IERC20(asset_);
    }

    function configureGameCore(address core) external onlyOwner {
        if (gameCore != address(0)) revert GameCoreAlreadyConfigured();
        if (core.code.length == 0) revert InvalidContract();
        gameCore = core;
        emit GameCoreConfigured(core);
    }

    function creditPack(address buyer, uint32 seeds, uint256 rawAssets) external onlyGameCore {
        if (buyer == address(0) || seeds == 0 || rawAssets == 0) revert InvalidInput();
        uint256 nextLiability = totalLiability + rawAssets;
        if (asset.balanceOf(address(this)) < nextLiability + protocolReserve) revert InsolventCredit();
        totalLiability = nextLiability;
        remainingSeeds[buyer] += seeds;
        unassignedCredit[buyer] += rawAssets;
        emit PackCredited(buyer, seeds, rawAssets);
    }

    function creditReserve(uint256 rawAssets) external onlyGameCore {
        if (rawAssets == 0) revert InvalidInput();
        uint256 nextReserve = protocolReserve + rawAssets;
        if (asset.balanceOf(address(this)) < totalLiability + nextReserve) revert InsolventCredit();
        protocolReserve = nextReserve;
        emit ProtocolReserveCredited(rawAssets);
    }

    function withdrawProtocolReserve(address recipient, uint256 rawAssets) external onlyOwner {
        if (recipient == address(0) || rawAssets == 0) revert InvalidInput();
        if (rawAssets > protocolReserve) revert SurplusExceeded();
        protocolReserve -= rawAssets;
        asset.safeTransfer(recipient, rawAssets);
        emit ProtocolReserveWithdrawn(recipient, rawAssets);
    }

    function consumeSeed(address buyer, bytes32 positionId) external onlyGameCore returns (uint256 entitlement) {
        if (positionId == bytes32(0)) revert InvalidInput();
        if (positionEntitlement[positionId] != 0) revert PositionAlreadyAssigned();
        uint256 seeds = remainingSeeds[buyer];
        uint256 credit = unassignedCredit[buyer];
        if (seeds == 0 || credit == 0) revert NoFundedSeed();
        entitlement = seeds == 1 ? credit : credit / seeds;
        if (entitlement == 0) revert NoFundedSeed();
        remainingSeeds[buyer] = seeds - 1;
        unassignedCredit[buyer] = credit - entitlement;
        positionEntitlement[positionId] = entitlement;
        emit SeedConsumed(buyer, positionId, entitlement);
    }

    function release(bytes32 positionId, address recipient) external onlyGameCore nonReentrant returns (uint256 amount) {
        if (recipient == address(0)) revert InvalidInput();
        amount = positionEntitlement[positionId];
        if (amount == 0) revert NoEntitlement();
        delete positionEntitlement[positionId];
        totalLiability -= amount;
        asset.safeTransfer(recipient, amount);
        emit RewardReleased(positionId, recipient, amount);
    }

    function availableSurplus() public view returns (uint256) {
        uint256 balance = asset.balanceOf(address(this));
        uint256 reserved = totalLiability + protocolReserve;
        return balance > reserved ? balance - reserved : 0;
    }

    function recoverSurplus(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0) || amount == 0) revert InvalidInput();
        if (amount > availableSurplus()) revert SurplusExceeded();
        asset.safeTransfer(recipient, amount);
        emit SurplusRecovered(recipient, amount);
    }
}
