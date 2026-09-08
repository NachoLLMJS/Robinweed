import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';

export default {
  defaultNetwork: 'robinhoodMainnetSimulation',
  plugins: [hardhatEthers, hardhatNodeTestRunner],
  networks: {
    robinhoodMainnetSimulation: { type: 'edr-simulated', chainType: 'l1', chainId: 4663 },
    wrongChainSimulation: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
  },
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 500 },
      evmVersion: 'cancun',
    },
  },
};
