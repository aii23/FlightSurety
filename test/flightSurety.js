var Test = require('../config/testConfig.js');

var BN = web3.utils.BN;

const {
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

var FlightSuretyApp = artifacts.require("FlightSuretyApp");


const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;


const MIN_AIRLINES_FOR_VOTING = 4;
let FUNDING_VALUE = web3.utils.toWei(new BN('10'), 'ether');

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

	describe('Airline registration', async() => {
		it(`Contract owner is first airline`, async() => {
			let active = await flightSuretyData.isActiveAirline(config.airlines[0]);
			assert.equal(active, true, 'Contract creator is not airline');
			activeAirlines.push(config.airlines[0]);
		});

		it(`Can register first ${MIN_AIRLINES_FOR_VOTING} airlines without voting`, async() => {
			let active; 
			for (airline of config.airlines.slice(1, MIN_AIRLINES_FOR_VOTING)) {
				await flightSuretyApp.registerAirline(airline, { from: config.owner });
				await flightSuretyApp.fund({ from: airline, value: FUNDING_VALUE});
				active = await flightSuretyData.isActiveAirline.call(airline);
				assert.equal(active, true, 'Cant register flight without voting');
				activeAirlines.push(airline);
			}
		});

		it(`Can't register airline without voting`, async() => {
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

		it(`Can't double vote`, async() => {
			let airline = config.airlines[activeAirlines.length];
			let voter = config.airlines[0];

			await expectRevert(
				flightSuretyApp.registerAirline(airline, { from: voter }),
				'You have already voted'
			);
		});

		it(`Can register airline with voting`, async() => {
			let airline = config.airlines[activeAirlines.length];
			for (voter of activeAirlines.slice(1, Math.ceil(activeAirlines.length / 2))) {
				let { tx } = await flightSuretyApp.registerAirline(airline, { from: voter });
				expectEvent.inTransaction(tx, flightSuretyData, 'AddingAirlineVoting');
			}

			let voted = await flightSuretyData.isVotedAirline(airline); 
			assert.equal(voted, true, `Voting has no effect`);
		});

		it(`Can't operate without funding`, async() => {
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

		it(`Can fund contract after voting`, async() => {
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

		it(`Can operate after funding`, async() => {
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

		it(`Can't remove airline without voting`, async() => {
			let airline = config.airlines[activeAirlines.length - 1];
			let initialStatus = flightSuretyData.isActiveAirline(airline);
			assert.ok(initialStatus, 'Airline is not registered');
			let voter = activeAirlines[0];
			await flightSuretyApp.unRegisterAirline(airline, { from: voter });
			let status = flightSuretyData.isActiveAirline(airline);
			assert.ok(status, 'Can remove airline without voting');
		});

		it(`Can remove airline with voting`, async() => {
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
			let airline = config.airlines[activeAirlines.length + 1];
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
			let flightNum = 'F002';
			let hashedFlightNum = web3.utils.soliditySha3(flightNum)
			let key = web3.utils.soliditySha3(airline, flightNum);

			let {tx} = await flightSuretyApp.registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, { from: airline });

			expectEvent.inTransaction(tx, flightSuretyData, 'FlightRegistered', { airline: airline, flightNumber: hashedFlightNum, key: key });

			let flightId = web3.utils.soliditySha3(airline, flightNum);
			let isFlightRegistered = await flightSuretyData.isFlightRegistered(flightId);
			assert.ok(isFlightRegistered, `Active airline can't register flight`);
		});
	});

	describe('Insurance Tests', async() => {
		let airline;
		let flighNum;
		let flightId;
		let cost;
		let secondFLightNum;
		let secondFlightId; 
		let user;
		it(`Init`, async() => {
			airline = config.owner;
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

	describe('Operational Tests', async() => {
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
  			await flightSuretyApp.setOperatingStatus(false, { from: airline });
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
        	for (voter of activeAirlines.slice(0, Math.ceil(activeAirlines.length / 2))) {
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

	describe('App contract update', async() => {
		let newAppContract;

		it(`Init`, async() => {
			newAppContract = await FlightSuretyApp.new(flightSuretyData.address);
		});

		it(`Can't update contract without voting`, async() => {
			let isAuthorized = await flightSuretyData.authorizedContracts.call(newAppContract.address);
			assert.ok(!isAuthorized, `Contract authorized without any voting`);
			await flightSuretyApp.updateAppContract(newAppContract.address);
			isAuthorized = await flightSuretyData.authorizedContracts.call(newAppContract.address);
			assert.ok(!isAuthorized, `Contract authorized after single vote`);
		});

		it(`Can update contract with voting`, async() => {
			for (voter of activeAirlines.slice(1, Math.ceil(activeAirlines.length / 2))) {
				await flightSuretyApp.updateAppContract(newAppContract.address, { from: voter });
			}

			let isAuthorizedNew = await flightSuretyData.authorizedContracts.call(newAppContract.address);
			assert.ok(isAuthorizedNew, `Contract still not authorized`);

			let isAuthorizedOld = await flightSuretyData.authorizedContracts.call(flightSuretyApp.address);
			assert.ok(!isAuthorizedOld, `Old contract still authorized`);
		});

		it(`Can't call data contract with old app contract`, async() => {
			let airline = config.airlines[activeAirlines.length - 1];
			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalTime = Date.now() + 5 * 1000 * 60 * 60;

			let flightNum = 'F042';

			expectRevert(
				flightSuretyApp.registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, { from: airline }),
				'Caller is not authorized'
			);
		});
		
		it('Can call data contract with new app contract', async() => {
			let airline = config.airlines[activeAirlines.length - 1];
			let departureAirport = web3.utils.asciiToHex('ABC');
			let arivalAirport = web3.utils.asciiToHex('BCD');
			let departureTime = Date.now();
			let arivalTime = Date.now() + 5 * 1000 * 60 * 60;

			let flightNum = 'F042';

			let { tx } = newAppContract.registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, { from: airline });
			
			expectEvent.inTransaction(tx, flightSuretyData, 'FlightRegistered');
		});
	});
});
