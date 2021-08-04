
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
        // console.log(contractFlight.departureTime);
        // console.log(new Date(contractFlight.departureTime));
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
        // console.log(arivalTime);
        // console.log(departureTime);
        let flightTime = arivalTime - departureTime;
        var flightDays = Math.floor(flightTime / 86400000);
        var flightHrs = Math.floor((flightTime % 86400000) / 3600000);
        var flightMins = Math.round(((flightTime % 86400000) % 3600000) / 60000);
        // console.log(flightTime);
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
            // console.log(window.contract);
            let flightId = getFlightId(this.airline, this.flightNumber);
            window.currentFlightId = flightId;
            showInsurancePopup();
            // window.contract.buyInsurance(flightId);
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

(async() => {

    let result = null;

    if (window.ethereum) {    
        // await window.ethereum.send('eth_requestAccounts');    
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        window.web3 = new Web3(window.ethereum);    
    } else {
        window.web3 =  new Web3(new Web3.providers.HttpProvider(config.url));
    }
    

    let contract = new Contract('localhost', () => {

        window.contract = contract;

        // contract.getInsurance();

        displayActiveInsurances();

        /*
        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
        */
    

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
    });
})();

/*
function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

*/






// Get all flights from server, by parameters. returns array of Flight
function getFlights() {

}

function searchFlights() 
{
    alert("Button Clicked");
    
}

async function getFlightsFromBlockChain(contract , searchParams) 
{  
    // console.log(searchParams);
    let flights = [];
    let topics = {};
    if (searchParams.airline && searchParams.flightNumber) {
        let flightId = getFlightId(searchParams.airline, searchParams.flightNumber);
        // console.log(flightId);
        let result = await contract.getActiveFlight(flightId);
        // console.log(result);
        let flight = Flight.fromContractFlight(result);
        flights.push(flight);
    } else if (searchParams.flightNumber) {
        topics = [,, window.web3.utils.sha3(searchParams.flightNumber)];
        let events = await contract.getPastEvents('FlightRegistered', topics);

        let addFlightPromises = events.map(async (event) => {
            console.log(event);
            let flightId = event.returnValues.key;
            let result = await contract.getActiveFlight(flightId);
            let flight = Flight.fromContractFlight(result);
            flights.push(flight)
        });

        await Promise.all(addFlightPromises);

    } else if (searchParams.airline) {
        // topics = [,searchParams.airline,];
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

    console.log(searchParams);

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

    // console.log(flights);

    return flights;
}

async function displayActiveInsurances() {
    let insurances = await getActiveInsurances();
    console.log(insurances);

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

    console.log(boughtEvents.map((event) => event.returnValues.flightKey));
    console.log(paidFlights);

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
    // console.log(flights);
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
    console.log(statusCode);
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