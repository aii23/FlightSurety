var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

var BN = web3.utils.BN;

const {
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');


const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;


const MIN_AIRLINES_FOR_VOTING = 3;
let FUNDING_VALUE = web3.utils.toWei(new BN('10'), 'ether');

function keccak256(...args) {
	return web3.utils.sha3(args.reduce((acc, cur) => acc + web3.utils.toHex(cur), ""));
}

contract('Flight Surety Tests', async (accounts) => {
	let config;
	let flightSuretyData;
	let flightSuretyApp;
	let activeAirlines = [];
	before('setup contract', async () => {
		config = await Test.Config(accounts);
		await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);

		flightSuretyData = config.flightSuretyData;
		flightSuretyApp = config.flightSuretyApp;
	});

	/****************************************************************************************/
	/* Operations and Settings                                                              */
	/****************************************************************************************/


	xdescribe('Airline registration', async() => {
		xit(`Contract owner is first airline`, async() => {
			let active = await flightSuretyData.isActiveAirline(config.airlines[0]);
			assert.equal(active, true, 'Contract creator is not airline');
			activeAirlines.push(config.airlines[0]);
		});

		xit(`Can register first ${MIN_AIRLINES_FOR_VOTING} airlines without voting`, async() => {
			let active; 
			for (airline of config.airlines.slice(1, MIN_AIRLINES_FOR_VOTING)) {
				await flightSuretyApp.registerAirlineWithoutVoting(airline, { from: config.owner });
				await flightSuretyApp.fund({ from: airline, value: FUNDING_VALUE});
				active = await flightSuretyData.isActiveAirline.call(airline);
				assert.equal(active, true, 'Cant register flight without voting');
				activeAirlines.push(airline);
			}
		});

		xit(`Can't register more than ${MIN_AIRLINES_FOR_VOTING} without voting`, async() => {
			let trigered = false;
			let airline = config.airlines[activeAirlines.length];

			try {
				await flightSuretyApp.registerAirlineWithoutVoting(airline, { from: config.owner });
			} catch (e) {
				trigered = true;
			}

			assert.equal(trigered, true, `Can register more than ${MIN_AIRLINES_FOR_VOTING} without voting`);
		});
		xit(`Can't register airline without voting`, async() => {
			let trigered = false;
			let airline = config.airlines[activeAirlines.length];
			let voter = config.airlines[0];

			await flightSuretyApp.registerAirline(airline, { from: voter }); // Should go fine

			try {
				await flightSuretyApp.fund({ from: airline, value: FUNDING_VALUE});
			} catch (e) {
				trigered = true;
			}

			assert.equal(trigered, true, `Can register airline without voting`);
		});
		xit(`Can't double vote`, async() => {
			let airline = config.airlines[activeAirlines.length];
			let voter = config.airlines[0];

			await expectRevert(
				flightSuretyApp.registerAirline(airline, { from: voter }),
				'You have already voted'
			);
		});
		xit(`Can register airline with voting`, async() => {
			let airline = config.airlines[activeAirlines.length];
			for (voter of activeAirlines.slice(1, Math.ceil(activeAirlines.length / 2))) {
				let { tx } = await flightSuretyApp.registerAirline(airline, { from: voter });
				expectEvent.inTransaction(tx, flightSuretyData, 'AddingAirlineVoting');
			}

			let voted = await flightSuretyData.isVotedAirline(airline); 
			assert.equal(voted, true, `Voting has no effect`);
		});
		xit(`Can't operate without funding`, async() => {
			let trigered = false; 
			let airline = config.airlines[activeAirlines.length];

			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalDate = Date.now() + 5 * 1000 * 60 * 60;

			try 
			{
				await fligtSuretyApp.registerFlight('New flight', departureAirport, arivalAirport, departureTime, arivalDate, { from: airline }); 
			} catch(e) {
				trigered = true;
			}
			assert.ok(trigered, 'Can operate without funding');
		});
		xit(`Can fund contract after voting`, async() => {
			let airline = config.airlines[activeAirlines.length];
			let valueForFunding = web3.utils.toWei(new BN('11'), 'ether');
			let initialBalance = await web3.eth.getBalance(airline);

			await flightSuretyApp.fund({ from: airline, value: valueForFunding, gasPrice: 0 });
			let active = await flightSuretyData.isActiveAirline.call(airline);

			assert.ok(active, 'Airline is still inactive');
			let currentBalance = await web3.eth.getBalance(airline);
			assert.equal(initialBalance - currentBalance, FUNDING_VALUE, 'Change is not correct');
			activeAirlines.push(airline);
		});
		xit(`Can operate after funding`, async() => {
			let flightName = 'New flight';
			let airline = config.airlines[activeAirlines.length - 1];

			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalDate = Date.now() + 5 * 1000 * 60 * 60;

			let result = await flightSuretyApp.registerFlight('New flight', departureAirport, arivalAirport, departureTime, arivalDate, { from: airline }); 
			let flightId = web3.utils.soliditySha3(airline, flightName);
			let isFlightRegistered = await flightSuretyData.isFlightRegistered(flightId);
			assert.ok(isFlightRegistered, `Can't register flight after funding`);
		});
		xit(`Can't remove airline without voting`, async() => {
			let airline = config.airlines[activeAirlines.length - 1];
			let initialStatus = flightSuretyData.isActiveAirline(airline);
			assert.ok(initialStatus, 'Airline is not registered');
			let voter = activeAirlines[0];
			await flightSuretyApp.unRegisterAirline(airline, { from: voter });
			let status = flightSuretyData.isActiveAirline(airline);
			assert.ok(status, 'Can remove airline without voting');
		});
		xit(`Can remove airline with voting`, async() => {
			let airline = config.airlines[activeAirlines.length - 1];
			for (voter of activeAirlines.slice(1, Math.ceil(activeAirlines.length / 2))) {
				await flightSuretyApp.unRegisterAirline(airline, { from: voter });
			}
			let status = await flightSuretyData.isActiveAirline(airline);
			assert.ok(!status, `Can't unregister airline`);
			activeAirlines.pop();
		});
	});

	describe('Flight registration', async() => {
		let departureAirport = web3.utils.asciiToHex('ABC');
		let arivalAirport = web3.utils.asciiToHex('BCD');
		let departureTime = Date.now();
		let arivalTime = Date.now() + 5 * 1000 * 60 * 60;

		it(`Can't register flight with inactive airline`, async() => {
			let airline = config.airlines[activeAirlines.length];
			let initailStatus = await flightSuretyData.isActiveAirline(airline);
			assert.ok(!initailStatus, `Wrong test. Airline is active`);


			let flightNum = 'F001';
			let failed = false;
			try 
			{
				await flightSuretyApp.registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, { from: airline }); 
			} catch(e) {
				failed = true;
			}

			assert.ok(failed, 'Can refister flight with inactive airline');
		});
		it(`Can register flight with active airline`, async() => {
			let airline = config.owner;
			// let airline = activeAirlines[activeAirlines.length - 2];
			// let airline = activeAirlines[0];
			let flightNum = 'F002';
			let key = web3.utils.soliditySha3(airline, flightNum);

			console.log(`registerFlight(${ flightNum }, ${ departureAirport }, ${ arivalAirport }, ${ departureTime }, ${ arivalTime })`);

			let {tx} = await flightSuretyApp.registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, { from: airline });

			expectEvent.inTransaction(tx, flightSuretyData, 'FlightRegistered', { airline: airline, flightNumber: flightNum, key: key });

			let flightId = web3.utils.soliditySha3(airline, flightNum);
			let isFlightRegistered = await flightSuretyData.isFlightRegistered(flightId);
			assert.ok(isFlightRegistered, `Active airline can't register flight`);
		});
		xit(`Can't remove flight if it is active`, async() => {
			// Функционал не используется =(
		});
		xit(`Can remove flight is it is inactive`, async() => {
			// Функционал не используется =(
		});
	});

	xdescribe('Insurance Tests', async() => {
		let airline;
		let flighNum;
		let flightId;
		let cost;
		let secondFLightNum;
		let secondFlightId; 
		let user;
		it(`Init`, async() => {
			airline = activeAirlines[activeAirlines.length - 1];
			flightNum = 'F002';
			flightId = web3.utils.soliditySha3(airline, flightNum);
			cost = web3.utils.toWei(new BN('1'), 'ether');
			user = config.users[0];
		});

		it(`Can't buy insurance for inactive flight`, async() => {
			let wrongFlightNum = 'WFN002';
			let wrongFlightId = web3.utils.soliditySha3(airline, wrongFlightNum);

			await expectRevert(
				flightSuretyApp.buyInsurance(wrongFlightId, { from: user, value: '0' }),
				'No such flight'
			);
		});
		it(`Can't buy insurance that cost more than 1 ether`, async() => {
			let cost = web3.utils.toWei(new BN('2'), 'ether');

			await expectRevert(
				flightSuretyApp.buyInsurance(flightId, { from: user, value: cost }),
				'You have sent more than maximum insurance cost'
			);
		});
		it(`Can buy insurance for active flight`, async() => {
			// console.log(flightId);
			// console.log(config.users[0]);
			// console.log(cost);
			// let hasInsurance = await flightSuretyData.hasInsurance(config.users[0], flightId);
			// console.log(hasInsurance);
			let {tx} = await flightSuretyApp.buyInsurance(flightId, { from: user, value: cost });
			expectEvent.inTransaction(tx, flightSuretyData, 'BoughtInsurance');
			let hasInsurance = await flightSuretyData.hasInsurance(user, flightId);
			assert.ok(hasInsurance);
		});
		it(`Can't buy insurance twice`, async() => {
			await expectRevert(
				flightSuretyApp.buyInsurance(flightId, { from: user, value: cost }),
				'You already have insurance for this flight'
			);
		});
		it(`Can buy insurence for another flight`, async() => {
			secondFlightNum = 'F003';
			secondFlightId = web3.utils.soliditySha3(airline, secondFlightNum);
			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalDate = Date.now() + 5 * 1000 * 60 * 60;

			await flightSuretyApp.registerFlight(secondFlightNum, departureAirport, arivalAirport, departureTime, arivalDate, { from: airline });
			await flightSuretyApp.buyInsurance(secondFlightId, { from: user, value: cost });
			let hasInsurance = await flightSuretyData.hasInsurance(user, secondFlightId);
			assert.ok(hasInsurance);
		});
		it(`Can get paid for insurance if staus is STATUS_CODE_LATE_AIRLINE`, async() => {
			await flightSuretyData.setFlightStatus(flightId, STATUS_CODE_LATE_AIRLINE, { from: config.owner });
			let initialBalance = await web3.eth.getBalance(user);
			let { tx } = await flightSuretyApp.payForInsurance(flightId, { from: user, gasPrice: 0 });
			expectEvent.inTransaction(tx, flightSuretyData, 'PaidForInsurence');
			let currentBalance = await web3.eth.getBalance(user);
			assert.equal(currentBalance - initialBalance, cost * 1.5, 'Wrong payment');
		});
		it(`Can't get paid for insurance if status is not STATUS_CODE_LATE_AIRLINE`, async() => {
			await flightSuretyData.setFlightStatus(secondFlightId, STATUS_CODE_ON_TIME, { from: config.owner });
			let { tx } = await flightSuretyApp.payForInsurance(secondFlightId, { from: user, gasPrice: 0 });
			expectEvent.notEmitted.inTransaction(tx, flightSuretyData, 'PaidForInsurence');
		});
	});

	xdescribe('Operational Tests', async() => {
		it('Default operational status equal true', async() => {
			let operational = await flightSuretyData.isOperational();
			assert.ok(operational);
		});
		it(`Only active airline can vote for operational status changing`, async() => {
			let user = config.users[0];
			expectRevert(
				flightSuretyApp.setOperatingStatus(false, { from: user }),
				'Caller should be active airline'
			);
		});
        it(`Can't set operational status without voting`, async() => {
  			let airline = activeAirlines[0];
  			let { tx } = await flightSuretyApp.setOperatingStatus(false, { from: airline });
  			let operational = await flightSuretyData.isOperational();
  			assert.ok(operational, 'Can change operational status without voting');

  			let numOfVotes = await flightSuretyData.getNumOfVotes(1);
  			assert.equal(numOfVotes, 1);
        });
        it(`Can remove operational vote`, async() => {
        	let airline = activeAirlines[0];
  			let { tx } = await flightSuretyApp.removeOperationalVote(0, { from: airline });
  			expectEvent.inTransaction(tx, flightSuretyData, 'OperationalVotingReverted');
		});
        it(`Can set operational status with voting`, async() => {
        	// console.log(activeAirlines);
        	for (voter of activeAirlines.slice(0, Math.ceil(activeAirlines.length / 2))) {
        		// console.log(voter);
				let { tx } = await flightSuretyApp.setOperatingStatus(false, { from: voter });
				expectEvent.inTransaction(tx, flightSuretyData, 'OperationalVoting');
			}
			let operational = await flightSuretyData.isOperational();
  			assert.ok(!operational, `Can't change operational status with voting`);
        });
        it(`Can't call data changing functions while contract is not opreational`, async() => {
        	let activeAirline = activeAirlines[1];
        	let inActiveAirline = config.airlines[activeAirlines.length];
        	let user = config.users[0];
        	let flighNum = 'WFN003';
        	let flightId = web3.utils.soliditySha3(activeAirline, flighNum);
			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalDate = Date.now() + 5 * 1000 * 60 * 60;

        	expectRevert(
        		flightSuretyApp.registerAirline(inActiveAirline, { from: activeAirline }),
        		'Contract is currently not operational'
        	);
        	expectRevert(
        		flightSuretyApp.unRegisterAirline(activeAirline, { from: config.firstAirline }),
        		'Contract is currently not operational'
        	);
        	expectRevert(
        		flightSuretyApp.fund({ from: activeAirline }),
        		'Contract is currently not operational'
        	);
        	expectRevert(
        		flightSuretyApp.registerFlight(flighNum, departureAirport, arivalAirport, departureTime, arivalDate, { from: activeAirline }),
        		'Contract is currently not operational'
        	);
        	expectRevert(
        		flightSuretyApp.buyInsurance(flightId, { from: user }),
        		'Contract is currently not operational'
        	);
        	expectRevert(
        		flightSuretyApp.payForInsurance(flightId, { from: user }),
        		'Contract is currently not operational'
        	);
        });
        it(`Can't change back operational status without voting`, async() => {
        	let airline = activeAirlines[0];
        	let { tx } = await flightSuretyApp.setOperatingStatus(true, { from: airline });
        	let operational = await flightSuretyData.isOperational();
  			assert.ok(!operational, 'Can change operational status back without voting');
        });
        it(`Can change back operational status with voting`, async() => {
        	for (voter of activeAirlines.slice(1, Math.ceil(activeAirlines.length / 2))) {
				let { tx } = await flightSuretyApp.setOperatingStatus(true, { from: voter });
				expectEvent.inTransaction(tx, flightSuretyData, 'OperationalVoting');
			}
			let operational = await flightSuretyData.isOperational();
  			assert.ok(operational, `Can't change back operational status with voting`);
        });
	});

	xdescribe('App contract update', async() => {
		xit(`Can't update contract without voting`, async() => {

		});
		xit(`Can update contract with voting`, async() => {

		});
		xit(`Can't call data contract with old app contract`, async() => {
			
		});
		xit('Can call data contract with new app contract', async() => {

		});
	});


	xit(`(multiparty) has correct initial isOperational() value`, async function () {

		// Get operating status
		let status = await config.flightSuretyData.isOperational.call();
		assert.equal(status, true, "Incorrect initial operating status value");

	});

	xit(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

			// Ensure that access is denied for non-Contract Owner account
			let accessDenied = false;
			try 
			{
					await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
			}
			catch(e) {
					accessDenied = true;
			}
			assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
						
	});

	xit(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

			// Ensure that access is allowed for Contract Owner account
			let accessDenied = false;
			try 
			{
					await config.flightSuretyData.setOperatingStatus(false);
			}
			catch(e) {
					accessDenied = true;
			}
			assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
			
	});

	xit(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

			await config.flightSuretyData.setOperatingStatus(false);

			let reverted = false;
			try 
			{
					await config.flightSurety.setTestingMode(true);
			}
			catch(e) {
					reverted = true;
			}
			assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

			// Set it back for other tests to work
			await config.flightSuretyData.setOperatingStatus(true);

	});

	xit('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
		
		// ARRANGE
		let newAirline = accounts[2];

		// ACT
		try {
				await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
		}
		catch(e) {

		}
		let result = await config.flightSuretyData.isAirline.call(newAirline); 

		// ASSERT
		assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

	});
 

});
