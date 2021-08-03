const fs = require('fs');
const { promises } = require('stream');
const fileName = './OraclesData.json'
// const OraclesData = require(fileName);
// import OraclesData from './OraclesData.json';



async function getOracles(oracles, flightSuretyData, flightSuretyApp) {
	let OraclesData;
	try {
		OraclesData = require('./OraclesData.json');
	} catch(e) {
		OraclesData = {};
	}


    if (OraclesData.OraclesData && OraclesData.DataContract === flightSuretyData._address) {
    	console.log("Found data");
        return OraclesData.oracles;
    }

    console.log('Registration started');



    await Promise.all(oracles.map((oracle) => registerOracle(flightSuretyApp, oracle).catch((e) => console.log(e))));

    let oraclesData = await Promise.all(oracles.map(oracle => getOracleData(flightSuretyApp, oracle))); 


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

export { getOracles };