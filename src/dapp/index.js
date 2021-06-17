
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

class Flight
{
    constructor(
        airlineName, 
        flightNum, 
        departureAirport, 
        arivalAirport, 
        departureDate, 
        arivalDate, 
        flightTime
    ) {

        this.airlineNumber = airlineNumber;
        this.righNumber = rightNuber;
        this.departureAirport = departureAirport;
        this.arivalAirport = arivalAirport;
        this.departureDate = deparureDate;
        this.arivalDate = arivalDate;
        this.flightTime = flightTime;
    }


    htmlTableRow() {

    }

}

(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        });

        DOM.elid('')
    
    });
    

})();


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
 
// Get all flights from server, by parameters. returns array of Flight
function getFlights() {

}






