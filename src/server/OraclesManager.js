
const fs = require('fs');


class OraclesManager {
    constructor(web3, flightSuretyApp, flightSuretyData) {
        this.web3 = web3;
        this.flightSuretyApp = flightSuretyApp;
        this.flightSuretyData = flightSuretyData;
        this.indexToOracle = {}; // Filled by invoking initOracles function
    }

    async initOracles() {
        console.log('init started');
        let oraclesPrivateKeys;
        try {
            oraclesPrivateKeys = require('./oraclesPrivateKeys.json');
        } catch (e) {
            console.log(`Can't find './oraclesPrivateKeys.json'. Create this file and fill it with oracle private keys array`);
            return;
        }

        let oracles = oraclesPrivateKeys.map((pKey) => this.web3.eth.accounts.privateKeyToAccount('0x' + pKey));
        oracles.forEach(oracle => this.web3.eth.accounts.wallet.add(oracle));

        let OraclesData;
        try {
            OraclesData = require('./OraclesData.json');
        } catch(e) {
            OraclesData = {};
        }
    
        let oraclesData = [];

        if (OraclesData.OraclesData && OraclesData.DataContract === this.flightSuretyData._address) {
            console.log("Found data");
            oraclesData = OraclesData.OraclesData;
            // console.log(oraclesData);
        } else {
            console.log('Registration started');
    
            await Promise.all(oracles.map((oracle) => this.registerOracle(oracle).catch((e) => console.log(e))));
        
            oraclesData = await Promise.all(oracles.map(oracle => this.getOracleData(oracle))); 
        
            let result = {
                "DataContract": this.flightSuretyData._address,
                "OraclesData": oraclesData
            };
        
            fs.writeFile('./src/server/OraclesData.json', JSON.stringify(result), function writeJSON(err) {
                if (err) return console.log('Error');
                console.log(JSON.stringify(result));
                console.log('writing to ' + './src/server/OraclesData.json');
            });
        }
        this.fillIndexToOracles(oraclesData);
    }

    fillIndexToOracles(oraclesData) {
        console.log(`Amount of oracles: ${ oraclesData.length }`);
        oraclesData.forEach(oracle => 
            oracle.indexes.forEach(index => {
                if (! this.indexToOracle[index]) {
                    this.indexToOracle[index] = [];
                }
                this.indexToOracle[index].push(oracle.address)
            }));
    }
    
    
    async registerOracle(oracle) {
        console.log(`Try to register ${oracle}`);
        let regFee = await this.flightSuretyApp.methods.REGISTRATION_FEE().call();
        let gas = 2000000;
        await this.flightSuretyApp.methods.registerOracle().send({ from: oracle.address, value: regFee, gas: gas });
        console.log(`Oracle ${ oracle } registered`);
    }

    async getOracleData(oracle) {
        let indexes;
        let registered = true;
        try {
            indexes = await this.flightSuretyApp.methods.getMyIndexes().call({ from: oracle.address });
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

    async manageOracleRequestEvent(event) {
        // console.log('Get OracleRequest event');
        // console.log(event);

        let index = event.returnValues.index;
        let airline = event.returnValues.airline;
        let flightNum = event.returnValues.flightNum;
        let timeStamp = event.returnValues.timestamp;

        // console.log(this);

        let result = this.getRandomResult();

        // console.log(`Main result: ${ result }`);
        
        let responsibleOracles = this.indexToOracle[index];

        for (let oracle of responsibleOracles) {
            // console.log(oracle);
            let falierNumber = Math.random();
            let curResult = result;
            if (falierNumber < this.falierPortion()) {
                while (curResult == result) {
                    curResult = this.getRandomResult();
                }
            }

            let gas = 2000000;

            console.log(`Oracle ${ oracle } submit result ${ curResult } for flight ${ flightNum } of ${ airline } airline`);
            
            let shouldBreak = false;

            await this.flightSuretyApp.methods
                .submitOracleResponse(index, airline, flightNum, timeStamp, curResult)
                .send({ from: oracle, gas: gas })
                .catch(e => {
                    // console.log(`Can't submit oracle response`);
                    // console.log(e.message);
                    shouldBreak = true;
                });
            
            if (shouldBreak) {
                console.log('Break');
                break;
            }
        }
    }

    getRandomResult() {
        // console.log(this);
        let index = Math.floor(Math.random() * this.avaliablesCodes().length);
        return this.avaliablesCodes()[index];
    }

    avaliablesCodes() {
        return [
            10,
            20,
            30,
            40,
            50
        ];
    }

    falierPortion() {
        return 0.3;
    }
}

export default OraclesManager;