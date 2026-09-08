// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IRewardVault {
    function creditPack(address buyer, uint32 seeds, uint256 rawAssets) external;
    function creditReserve(uint256 rawAssets) external;
    function consumeSeed(address buyer, bytes32 positionId) external returns (uint256);
    function release(bytes32 positionId, address recipient) external returns (uint256);
}

contract MockVaultCore {
    IRewardVault public immutable vault;
    constructor(address vault_) { vault = IRewardVault(vault_); }
    function creditPack(address buyer, uint32 seeds, uint256 rawAssets) external { vault.creditPack(buyer, seeds, rawAssets); }
    function creditReserve(uint256 rawAssets) external { vault.creditReserve(rawAssets); }
    function consumeSeed(address buyer, bytes32 positionId) external returns (uint256) { return vault.consumeSeed(buyer, positionId); }
    function release(bytes32 positionId, address recipient) external returns (uint256) { return vault.release(positionId, recipient); }
}
