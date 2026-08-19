require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20,           // 20 simulated accounts
        accountsBalance: "10000000000000000000000", // 10,000 ETH each
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    ...(process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            chainId: 11155111,
            accounts: [process.env.SEPOLIA_PRIVATE_KEY],
          },
        }
      : {}),
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
