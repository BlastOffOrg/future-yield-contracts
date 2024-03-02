import * as dotenv from 'dotenv';
dotenv.config();

import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-solhint';

module.exports = {
  typechain: {
    outDir: './typechain',
    target: 'ethers-v5',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.20',
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        count: 10,
      },
      live: false,
      saveDeployments: false,
    },
    development: {
      url: 'http://127.0.0.1:8545', // Localhost (default: none)
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
      live: false,
      saveDeployments: true,
    },
    mumbai: {
      url: process.env.MUMBAI_POLYGON_PROVIDER,
      accounts: [process.env.TESTNET_DEPLOYER],
      timeout: 20000,
      gasMultiplier: 2,
      chainId: 80001,
    },
    blast_sepolia: {
      url: process.env.BLAST_SEPOLIA_PROVIDER,
      accounts: [process.env.TESTNET_DEPLOYER],
      gasMultiplier: 1.2,
      verify: {
        etherscan: {
          apiUrl:
            'https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan',
          apiKey: process.env.EXPLORER_API_KEY,
        },
      },
    },
    blast: {
      url: process.env.BLAST_PROVIDER,
      accounts: [process.env.MAINNET_DEPLOYER],
      gasMultiplier: 1.2,
      verify: {
        etherscan: {
          apiUrl: 'https://api.blastscan.io',
          apiKey: process.env.EXPLORER_API_KEY,
        },
      },
    },
  },

  paths: {
    sources: './contracts',
    tests: './test',
    cache: './build/cache',
    artifacts: './build/artifacts',
    deployments: './deployments',
  },

  verify: {
    etherscan: {
      apiKey: process.env.EXPLORER_API_KEY,
    },
  }
};