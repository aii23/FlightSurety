import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
// import OracleData from './oracles.js'
// import OraclesData from './OraclesData.json';
// let OracleData = require('./OraclesData.json');
// console.log(OraclesData);

let config = Config['localhost'];
let oraclesPrivateKeys = Config['oraclesPrivateKeys'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
// console.log('Accounts');
// console.log(web3.eth.accounts);
// console.log(web3.eth.accounts[0]);
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let oracles = oraclesPrivateKeys.map((pKey) => web3.eth.accounts.privateKeyToAccount('0x' + pKey));
oracles.forEach(oracle => web3.eth.accounts.wallet.add(oracle));
// console.log('Ok')
// console.log(flightSuretyData);
getOracles(oracles, flightSuretyData, flightSuretyApp).then((e) => console.log(e));
// console.log(oracles);







/// Перенести в отдельный файл
const fs = require('fs');
const { promises } = require('stream');
const fileName = './src/server/OraclesData.json'
// const OraclesData = require(fileName);
// 
// console.log(fs.existsSync('./OraclesData.json'));
// let OraclesData;

// try {
// 	OraclesData = require('./OraclesData.json');
// } catch(e) {
// 	OraclesData = {};
// }

// console.log(OraclesData);

// if (fs.existsSync('./OraclesData.json'))
// {
// 	console.log('!!');
// 	OraclesData = require('./OraclesData.json');
// }
// let OraclesData = fs.existsSync('./OraclesData.json') ? require('./OraclesData.json') : {}; 

// if (fs.existsSync('./OraclesData.json')) {

// } else {

// }
// import OraclesData from './OraclesData.json';



async function getOracles(oracles, flightSuretyData, flightSuretyApp) {
	let OraclesData;
	try {
		OraclesData = require('./OraclesData.json');
	} catch(e) {
		OraclesData = {};
	}

    // console.log('Here');
    // console.log('Oracle Data + ' + OraclesData);

    console.log(OraclesData.DataContract);
    console.log(flightSuretyData._address);
    console.log();

    if (OraclesData.OraclesData && OraclesData.DataContract === flightSuretyData._address) {
    	console.log("Found data");
        return OraclesData.oracles;
    }
//     console.log('here');
    console.log('Registration started');
    await Promise.all(oracles.map((oracle) => registerOracle(flightSuretyApp, oracle).catch((e) => console.log(e))));

    // console.log(`Registration ended`);

    let oraclesData = await Promise.all(oracles.map(oracle => getOracleData(flightSuretyApp, oracle))); 

    // console.log(`done getting oraclesData`);
    // console.log(oraclesData);
    // console.log(flightSuretyData);

    let result = {
        "DataContract": flightSuretyData._address,
        "OraclesData": oraclesData
    };

    // console.log(result);

    fs.writeFile(fileName, JSON.stringify(result), function writeJSON(err) {
        if (err) return console.log('Error');
        console.log(JSON.stringify(result));
        console.log('writing to ' + fileName);
    });
 }


async function registerOracle(flightSuretyApp, oracle) {
    console.log(`Try to register ${oracle}`);
    let regFee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    console.log(regFee);
    let gasPrice = await web3.eth.getGasPrice();
    console.log(gasPrice);
    // console.log(regFee);
    // console.log(flightSuretyApp.methods.registerOracle);
    // let gas = await flightSuretyApp.methods.registerOracle().estimateGas({ from: oracle.address, value: regFee });
    // console.log(gas);
    let gas = 2000000;
    await flightSuretyApp.methods.registerOracle().send({ from: oracle.address, value: regFee, gas: gas });
    console.log(`Oracle ${ oracle } registered`);
}

async function getOracleData(flightSuretyApp, oracle) {
    let indexes;
    let registered = true;
    try {
        indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: oracle.address });
    } catch(e) {
        console.log(e);
        registered = false;
    }

    return {
        address: oracle.address, 
        indexes: indexes,
        registered: registered
    };
}




/////





flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error) console.log(error)
  console.log(event)
});

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;