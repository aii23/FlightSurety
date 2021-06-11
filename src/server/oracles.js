const fs = require('fs');
const { promises } = require('stream');
const fileName = './OraclesData.json'
// const OraclesData = require(fileName);
import OraclesData from './OraclesData.json';



async function getOracles(oracles, flightSuretyData, flightSuretyApp) {
    if (OraclesData.oracles && OraclesData.DataContract === flightSuretyData.address) {
        return OraclesData.oracles;
    }
    console.log('here');
    await Promise.all(oracles.map((oracle) => registerOracle(flightSuretyApp, oracle).catch((e) => console.log(e))));

    let oraclesData = await Promise.all(oracles.map(oracle => getOracleData(oraclesData))); 

    let result = {
        DataContract: flightSuretyData.address, 
        OraclesData: oraclesData
    };

    fs.writeFile(fileName, JSON.stringify(result), function writeJSON(err) {
        if (err) return console.log(err);
    });
}


async function registerOracle(flightSuretyApp, oracle) {
    let regFee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    await flightSuretyApp.methods.registerOracle.send({ from: oracle, value: regFee });
}

async function getOracleData(flightSuretyApp, oracle) {
    let indexes;
    let registered = true;
    try {
        indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: oracle });
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