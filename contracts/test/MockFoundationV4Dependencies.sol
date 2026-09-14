// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockPonsFactoryV4 {
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

    mapping(address => LaunchedToken) private launches;

    function setLaunch(address token, address curve, address pairToken, uint8 phase) external {
        launches[token] = LaunchedToken(token, curve, msg.sender, msg.sender, pairToken, 1, 3000, 60, 0, false, phase, 0, 0, 0, true);
    }

    function getLaunchedToken(address token) external view returns (LaunchedToken memory) {
        return launches[token];
    }
}

contract MockFoundationAdapterV4 {
    address public immutable ponsFactory;
    bool public configurationFrozen;
    uint256 public configuredPaths;
    uint256 public failAt;

    constructor(address ponsFactory_) { ponsFactory = ponsFactory_; }
    function setFailAt(uint256 index) external { failAt = index; }

    function configurePath(address, address, bytes calldata) external {
        uint256 next = configuredPaths + 1;
        if (failAt != 0 && next == failAt) revert("MOCK_PATH_FAILURE");
        configuredPaths = next;
    }

    function freezeConfiguration() external { configurationFrozen = true; }
}
