
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';
import Config from './config.json';
import Web3 from 'web3';

class Flight
{
    constructor(
        airline, 
        flightNumber, 
        departureAirport, 
        arivalAirport, 
        departureTime, 
        arivalTime
    ) {
        this.airline = airline;
        this.flightNumber = flightNumber;
        this.departureAirport = departureAirport;
        this.arivalAirport = arivalAirport;
        this.departureTime = departureTime;
        this.arivalTime = arivalTime;
        this.flightTime = this.getFlightTime(departureTime, arivalTime);
    }

    static fromContractFlight(contractFlight) {
        return  new Flight(
            contractFlight.airline,
            contractFlight.flightNumber,
            window.web3.utils.hexToAscii(contractFlight.departureAirport),
            window.web3.utils.hexToAscii(contractFlight.arivalAirport),
            new Date(parseInt(contractFlight.departureTime)),
            new Date(parseInt(contractFlight.arivalTime))
        );
    }

    getFlightTime(departureTime, arivalTime) {
        let flightTime = arivalTime - departureTime;
        var flightDays = Math.floor(flightTime / 86400000);
        var flightHrs = Math.floor((flightTime % 86400000) / 3600000);
        var flightMins = Math.round(((flightTime % 86400000) % 3600000) / 60000);
        let timeWithoutDays = `${flightHrs}H ${flightMins}M`;
        return flightDays == 0 ? timeWithoutDays : `${flightDays}D ` + timeWithoutDays;
    }

    htmlTableRow() {
        let row = document.createElement('tr');
        row.insertAdjacentHTML('beforeend', `<td> ${ this.airline } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.flightNumber } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.departureAirport } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.arivalAirport } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.departureTime } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.arivalTime } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.flightTime } </td>`);
        
        let tdWithButton = document.createElement('td');

        let purchaseButton = document.createElement('button');
        purchaseButton.innerHTML = 'Buy Insurance';
        purchaseButton.onclick = () => {
            let flightId = getFlightId(this.airline, this.flightNumber);
            window.currentFlightId = flightId;
            showInsurancePopup();
        }

        tdWithButton.appendChild(purchaseButton);

        row.append(tdWithButton);
        return row;
    }
}

class Insurance {
    constructor(
        airline, 
        flightNumber, 
        costInWei,
        flightStatusCode
    ) {
        this.airline = airline;
        this.flightNumber = flightNumber;
        this.cost = web3.utils.fromWei(costInWei, 'ether');
        this.flightStatusCode = flightStatusCode;
    }

    htmlTableRow() {
        let row = document.createElement('tr');
        row.insertAdjacentHTML('beforeend', `<td> ${ this.airline } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.flightNumber } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ this.cost } </td>`);
        row.insertAdjacentHTML('beforeend', `<td> ${ convertStatusToString(this.flightStatusCode) } </td>`);
        
        let tdWithButton = document.createElement('td');

        if (this.flightStatusCode == '20') {
            let getPaid = document.createElement('button');
            getPaid.innerHTML = 'Get Paid';
            getPaid.onclick = () => {
                let flightId = getFlightId(this.airline, this.flightNumber);
                window.contract.payForInsurance(flightId);
            }
            tdWithButton.append(getPaid);
        }

        row.append(tdWithButton);
        
        return row;
    }
}

class Log {
    constructor(type, blockNum, params) {
        this.type = type; 
        this.blockNum = blockNum;
        this.params = params;
    }

    getHTML() {
        let text = `Block: ${ this.blockNum }. `;
        switch(this.type) {
            case 'OperationalVoting': 
                text += `Operational voting. Mode - ${ this.params[0] }. ${ this.params[1] ? 'Last vote.' : '' }`;
                break; 
            case 'OperationalVotingReverted':
                text += `Revert operational voting`;
                break;
            case 'AddingAirlineVoting':
                text += `Vote for adding airline ${ this.params[0] }. ${ this.params[1] ? 'Last vote.' : '' }`;
                break;
            case 'RemoveAirlineVoting':
                text += `Vote for removing airline ${ this.params[0] }. ${ this.params[1] ? 'Last vote.' : '' }`;
                break;
            case 'FlightRegistered':
                text += `Register flight with flight number ${ this.params[0] }`;
                break; 
            case 'BoughtInsurance':
                text += `Bought insurance for flight ${ this.params[0] } with price ${ this.params[1] }eth`;
                break;
            case 'PaidForInsurence': 
                text += `Got paid for insurance for flight ${ this.params[0] }. Paid funds - ${ this.params[1] }eth`
                break;
        }
        return DOM.h5(text);
    }
}

(async() => {
    if (window.ethereum) {        
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        window.web3 = new Web3(window.ethereum);    
    } else {
        window.web3 =  new Web3(new Web3.providers.HttpProvider(config.url));
    }
    

    let contract = new Contract('localhost', () => {
        window.contract = contract;

        displayActiveInsurances();

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let airline = DOM.elid('airline_fetch_status').value;
            let flightNumber = DOM.elid('flight_number_fetch_status').value;//!!
            // Write transaction
            contract.fetchFlightStatus(airline, flightNumber);
        });

        DOM.elid('register_new_flight').addEventListener('click', () => {
            let flightNum = DOM.elid('new_flight_number').value;
            let departureAirport = DOM.elid('new_departure_airport').value;
            let arivalAirport = DOM.elid('new_arival_airport').value;
            let departureDate = DOM.elid('new_departure_date').value;
            let departureTime = DOM.elid('new_departure_time').value;
            let arivalDate = DOM.elid('new_arival_date').value;
            let arivalTime = DOM.elid('new_arival_time').value;

            let departureTimestamp = Date.parse(departureDate + "T" + departureTime);
            let arivalTimestamp = Date.parse(arivalDate + "T" + arivalTime);

            contract.registerFlight(flightNum, departureAirport, arivalAirport, departureTimestamp, arivalTimestamp, (error) => {
                console.log(error)
            });
        });

        DOM.elid('authorize_contract').addEventListener('click', () => {
            contract.authorizeContract();
        });

        DOM.elid('search_button').addEventListener('click', () => {
            let searchParams = {};
            searchParams.airline = DOM.elid('airline_input').value;
            searchParams.flightNumber = DOM.elid('flight_num_input').value;
            searchParams.departureAirport = DOM.elid('departure_airport_input').value;
            searchParams.arivalAirport = DOM.elid('arival_airport_input').value;
            searchParams.departureTime = DOM.elid('departure_date_input').value;

            getFlightsFromBlockChain(contract, searchParams).then(flights => displayFlights(flights));
        });    

        DOM.elid('hide_insurance_form').addEventListener('click', () => {
            hideInsurancePopup();
        });

        DOM.elid('buy_insurence').addEventListener('click', () => {
            let cost = DOM.elid('insurance_cost_input').value;
            let costInWei = web3.utils.toWei(cost, 'ether');
            contract.buyInsurance( window.currentFlightId, costInWei);
            hideInsurancePopup();
        });

        DOM.elid('update_isurances').addEventListener('click', () => {
            displayActiveInsurances();
        });

        DOM.elid('register_airline_withoud_voting').addEventListener('click', () => {
            let airline = DOM.elid('new_airline_address_no_voting').value;

            contract.registerAirlineWithoutVoting(airline);
        });

        DOM.elid('fund_contract').addEventListener('click', () => {
            contract.fund();
        });

        DOM.elid('register_airline_voting').addEventListener('click', () => {
            let airline = DOM.elid('new_airline_address').value;

            contract.registerAirline(airline);
        });

        DOM.elid('remove_airline_voting').addEventListener('click', () => {
            let airline = DOM.elid('airline_for_removal_address').value;

            contract.unRegisterAirline(airline);
        });

        DOM.elid('update_app_contract').addEventListener('click', () => {
            let newAppContractAddress = DOM.elid('new_app_contract_address').value;

            contract.updateAppContract(newAppContractAddress);
        });

        DOM.elid('show_history').addEventListener('click', () => {
            showTransactionHistory();
        });
    });
})();

async function getFlightsFromBlockChain(contract , searchParams) 
{  
    let flights = [];
    let topics = {};
    if (searchParams.airline && searchParams.flightNumber) {
        let flightId = getFlightId(searchParams.airline, searchParams.flightNumber);
        let result = await contract.getActiveFlight(flightId);
        let flight = Flight.fromContractFlight(result);
        flights.push(flight);
    } else if (searchParams.flightNumber) {
        topics = [,, window.web3.utils.sha3(searchParams.flightNumber)];
        let events = await contract.getPastEvents('FlightRegistered', topics);

        let addFlightPromises = events.map(async (event) => {
            let flightId = event.returnValues.key;
            let result = await contract.getActiveFlight(flightId);
            let flight = Flight.fromContractFlight(result);
            flights.push(flight)
        });

        await Promise.all(addFlightPromises);

    } else if (searchParams.airline) {
        let filter = {
            airline: searchParams.airline
        };
        let events = await contract.getPastEventsFiltered('FlightRegistered', filter);

        let addFlightPromises = events.map(async (event) => {
            let flightId = event.returnValues.key;
            let result = await contract.getActiveFlight(flightId);
            let flight = Flight.fromContractFlight(result);
            flights.push(flight)
        });

        await Promise.all(addFlightPromises);
    } else {
        let events = await contract.getPastEventsFiltered('FlightRegistered', {});

        let addFlightPromises = events.map(async (event) => {
            let flightId = event.returnValues.key;
            let result = await contract.getActiveFlight(flightId);
            let flight = Flight.fromContractFlight(result);
            flights.push(flight)
        });

        await Promise.all(addFlightPromises);
    }

    flights = flights.filter(flight => {
        let result = true;
        if (searchParams.departureAirport) {
            if (searchParams.departureAirport != flight.departureAirport) {
                result = false;
            }
        }

        if (searchParams.arivalAirport) {
            if (searchParams.arivalAirport != flight.arivalAirport) {
                result = false;
            }
        }

        if (searchParams.departureTime) {
            let departureTime = new Date(searchParams.departureTime);
            if (departureTime.toDateString() != flight.departureTime.toDateString()) {
                result = false;
            }
        }

        return result;
    });

    return flights;
}

async function displayActiveInsurances() {
    let insurances = await getActiveInsurances();

    let tbody = document.createElement('tbody');
    insurances.forEach(insurance => tbody.append(insurance.htmlTableRow()));
    DOM.elid('insurances').tBodies[0].replaceWith(tbody);
}

async function getActiveInsurances() {
    let filter = {
        user: (await window.web3.eth.getAccounts())[0]
    }
    let boughtEvents = await contract.getPastEventsFiltered('BoughtInsurance', filter);
    let paidEvents = await contract.getPastEventsFiltered('PaidForInsurence', filter);
    let paidFlights = paidEvents.map((event) => event.returnValues.flightKey);

    let activeInsurances = boughtEvents
    .filter(boughtEvent => !paidFlights.includes(boughtEvent.returnValues.flightKey))
    .map(async (event) => {
        let cost = event.returnValues.cost;
        let flightId = event.returnValues.flightKey;
        let flight = await contract.getActiveFlight(flightId);
        let airline = flight.airline;
        let flightNumber = flight.flightNumber;
        let flightStatusCode = flight.statusCode;
        return new Insurance(airline, flightNumber, cost, flightStatusCode);
    });

    return Promise.all(activeInsurances);
}

function getFlightId(airline, flightNum) {
    return window.web3.utils.soliditySha3(airline, flightNum);
}

function displayFlights(flights) {
    let tbody = document.createElement('tbody');
    flights.forEach(flight => tbody.append(flight.htmlTableRow()));
    DOM.elid('flights').tBodies[0].replaceWith(tbody);
}

function hideInsurancePopup() {
    DOM.elid('popup_buy_insurance_form').style.display = 'none';
}

function showInsurancePopup() {
    DOM.elid('popup_buy_insurance_form').style.display = 'block';
}

function convertStatusToString(statusCode) {
    let result = 'Unknown';
    switch (statusCode) {
        case '10':
            result = 'On time';
            break;
        case '20':
            result = 'Late airline';
            break;
        case '30':
            result = 'Late weather';
            break;
        case '40':
            result = 'Late technical';
            break;
        case '50': 
            result = 'Late other';
            break;
    }
    return result;
}

async function showTransactionHistory() {
    DOM.elid('history_list').innerHTML = "";
    
    let logTypes = [
        {
            type: 'OperationalVoting',
            filterField: 'voter'
        }, 
        {
            type: 'OperationalVotingReverted',
            filterField: 'voter'
        }, 
        {
            type: 'AddingAirlineVoting',
            filterField: 'voter'
        }, 
        {
            type: 'RemoveAirlineVoting',
            filterField: 'voter'
        }, 
        {
            type: 'FlightRegistered',
            filterField: 'airline'
        }, 
        {
            type: 'BoughtInsurance',
            filterField: 'user'
        },
        {
            type: 'PaidForInsurence',
            filterField: 'user'
        }
    ];

    let allLogsPromises = logTypes
        .map(async type => { // Get logs of all types
            let filter = {};
            filter[type.filterField] = (await window.web3.eth.getAccounts())[0];
            let currentLogs = await contract.getPastEventsFiltered(type.type, filter);

            return Promise.all(currentLogs
                .map(async log => {   // Create logs entities
                    let blockNum = log.blockNumber;
                    let params = [];
                    switch(type.type) {
                        case 'OperationalVoting': 
                            params.push(log.returnValues.mode);
                            params.push(log.returnValues.last);
                            break; 
                        case 'AddingAirlineVoting':
                        case 'RemoveAirlineVoting':
                            params.push(log.returnValues.addedAirline);
                            params.push(log.returnValues.last);
                            break;
                        case 'FlightRegistered':
                            params.push(await getFlightNumByKey(log.returnValues.key));
                            break; 
                        case 'BoughtInsurance':
                        case 'PaidForInsurence': 
                            params.push(await getFlightNumByKey(log.returnValues.flightKey));
                            params.push(web3.utils.fromWei(log.returnValues.cost, 'ether'));
                            break;
                    }
                    return new Log(type.type, blockNum, params);
                }));
        });
    let allLogs = (await Promise.all(allLogsPromises)).flat();

    allLogs.sort((a, b) => a.blockNum - b.blockNum); // Sort logs by block number; 

    allLogs // Display logs on screen 
        .forEach(log => {
            DOM.elid('history_list').appendChild(log.getHTML());
        });
}

async function getFlightNumByKey(flightKey) {
    let flight = await contract.getActiveFlight(flightKey);
    return flight.flightNumber;
} 