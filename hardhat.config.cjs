require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Подключаем .env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545", // стандартный RPC Ganache
      accounts: [process.env.PRIVATE_KEY], // ключ из MetaMask/Ganache
    },
  },
};