var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "leopard harbor cost goddess plug fit muscle retire bundle exact awake escape";

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    ganache: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
      },
      network_id: '*',
      gas: 5999999
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};