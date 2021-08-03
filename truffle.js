var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "leopard harbor cost goddess plug fit muscle retire bundle exact awake escape";

module.exports = {
  networks: {
    develop: {
      accounts: 50,
      defaultEtherBalance: 500,
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