
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

const {
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 20;
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);

  });


  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {      
      await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    let flightNum = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    let receipt = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flightNum, timestamp);

    console.log(receipt);

    expectEvent.inTransaction(receipt.tx, config.flightSuretyApp, 'OracleRequest');

    // let event = tx.receipt.rawLogs.some(l => { return l.topics[0] == '0x' + sha3("Stored()") });

    let logs = receipt.logs;

    assert.ok(Array.isArray(logs));
		assert.equal(logs.length, 1);

		let log = logs[0];
		assert.equal(log.event, 'OracleRequest');
		
    let requestIndex = log.event.index;

    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {
        
        if (oracleIndexes[idx] == requestIndex) {
          let result = await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flightNum, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });

          expectEvent(result, 'OracleReport', { airline: config.firstAirline, flightNum: flightNum, timestamp: timestamp, status: STATUS_CODE_ON_TIME});
        } else {
          expectRevert(
            config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] }),
            'Flight or timestamp do not match oracle request'
          );
        }

      }
    }


  });


 
});
