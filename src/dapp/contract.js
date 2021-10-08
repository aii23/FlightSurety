import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = window.web3;
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(airline, flightNum) {
        this.flightSuretyApp.methods
            .fetchFlightStatus(airline, flightNum, Math.floor(Date.now() / 1000))
            .send({ from: this.owner}, (error, result) => {
                if (error) {
                    console.log(error);
                }
            });
    }

    registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime, callback)
    {
        let self = this;
        departureAirport = self.web3.utils.asciiToHex(departureAirport);
        arivalAirport = self.web3.utils.asciiToHex(arivalAirport);

        let payload = {
            sender: self.owner, 
            flightNum: flightNum,
            departureAirport: departureAirport,
            arivalAirport: arivalAirport,
            departureTime: departureTime,
            arivalTime: arivalTime
        }

        self.flightSuretyApp.methods
            .registerFlight(flightNum, departureAirport, arivalAirport, departureTime, arivalTime)
            .send({ from: self.owner }, (error, result) => {
                callback(error);
            });
    }

    getPastEvents(event, topics) {
        return this.flightSuretyData
            .getPastEvents(event, {
                topics: topics,
                fromBlock: 0,
                toBlock: 'latest'
            }).catch(e => {
                console.log(e);
                return [];
            });
    }

    getPastEventsFiltered(event, filter) {
        return this.flightSuretyData
            .getPastEvents(event, {
                filter: filter,
                fromBlock: 0,
                toBlock: 'latest'
            }).catch(e => {
                console.log(e);
                return [];
            });
    }

    authorizeContract()
    {
        let appContractAddress = this.flightSuretyApp.options.address;

        this.flightSuretyData.methods
            .authorizeContract(appContractAddress)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    buyInsurance(flightId, value) {
        this.flightSuretyApp.methods
            .buyInsurance(flightId)
            .send({  from: this.owner, value: value }, (error) => {
                console.log(error);
            });
    }

    payForInsurance(flightId) {
        this.flightSuretyApp.methods
            .payForInsurance(flightId)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    registerAirlineWithoutVoting(airline) {
        this.flightSuretyApp.methods
            .registerAirlineWithoutVoting(airline)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    registerAirline(airline) {
        this.flightSuretyApp.methods
            .registerAirline(airline)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    unRegisterAirline(airline) {
        this.flightSuretyApp.methods
            .unRegisterAirline(airline)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    updateAppContract(newAppContract) {
        this.flightSuretyApp.methods
            .updateAppContract(newAppContract)
            .send({ from: this.owner }, (error) => {
                console.log(error);
            });
    }

    fund() {
        this.flightSuretyApp.methods
            .FUNDING_VALUE()
            .call()
            .then(funding_value => 
                this.flightSuretyApp.methods
                .fund()
                .send({ from: this.owner, value: funding_value }));
    }

    async getActiveFlight(flightId)
    {
        return this.flightSuretyData.methods
            .activeFlights(flightId)
            .call();
    }

    async getInsurance(flightId)
    {
        return this.flightSuretyData.methods
            .accountInsurances(this.owner, flightId)
            .call();
    }
}