import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import OraclesManager from './OraclesManager.js'

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let oraclesManager = new OraclesManager(web3, flightSuretyApp, flightSuretyData);
oraclesManager.initOracles();

let processedBlocks = new Set()

flightSuretyApp.events.OracleRequest({
  fromBlock: 'latest'
})
  .on('data', event => {
    try {
      if (!processedBlocks.has(event.blockNumber)) {
        processedBlocks.add(event.blockNumber);
        oraclesManager.manageOracleRequestEvent(event);
      } 

    } catch(e) {
      console.log(e);
    }
  })

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;