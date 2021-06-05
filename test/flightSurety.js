
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

	var config;
	before('setup contract', async () => {
		config = await Test.Config(accounts);
		await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
	});

	/****************************************************************************************/
	/* Operations and Settings                                                              */
	/****************************************************************************************/

	xdescribe('Operational Tests', async() => {
        xit('Can\'t set operational status without voting', async() => {

        });
        xit('Can set operational status with voting', async() => {

        });
        xit('Can\'t call data changing functions while contract is not opreational', async() => {

        });
        xit('Can\'t change back operational status without voting', async() => {

        });
        xit('Can change back operational status with voting', async() => {

        });
		xit('Can remove operational vote', async() => {

		});
	});

	xdescribe('App contract update', async() => {
		xit(`Cant update contract without voting`, async() => {

		});
		xit(`Can update contract with voting`, async() => {

		});
		xit(`Can't call data contract with old app contract`, async() => {

		});
		xit('Can call data contract with new app contract', async() => {

		});
	});

	xdescribe('Airline registration', async() => {
		xit('Can\'t register airline without voting', async() => {

		});
		xit('Can register airline without voting', async() => {

		});
		xit('Can\'t operate without funding', async() => {

		});
		xit('Can fund contract after voting', async() => {

		});
		xit('Can operate after funding', async() => {

		});
		xit('Can\'t remove airline without voting', async() => {

		});
		xit('Can remove airline without voting', async() => {

		});
	});

	xdescribe('Flight registration', async() => {
		xit(`Can't register flight with unactive airline`, async() => {

		});
		xit(`Can register flight with active airline`, async() => {

		});
		xit(`Can't remove flight if it is active`, async() => {

		});
		xit(`Can remove flight is it is inactive`, async() => {

		});
	});

	xdescribe('Insurence Tests', async() => {
		xit(`Can't buy insurence that cost more than 1 ether`, async() => {

		});
		xit(`Can't buy insurence for inactive flight`, async() => {

		});
		xit(`Can buy insurence for active flight`, async() => {

		});
		xit(`Can't buy insurence twice`, async() => {

		});
		xit(`Can get paid for insurence if staus is STATUS_CODE_LATE_AIRLINE`, async() => {

		});
		xit(`Can't get paid for insurence if status is not STATUS_CODE_LATE_AIRLINE`, async() => {

		});
	})


	it(`(multiparty) has correct initial isOperational() value`, async function () {

		// Get operating status
		let status = await config.flightSuretyData.isOperational.call();
		assert.equal(status, true, "Incorrect initial operating status value");

	});

	it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

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

	it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

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

	it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

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

	it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
		
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
