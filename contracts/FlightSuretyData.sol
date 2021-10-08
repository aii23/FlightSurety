pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    mapping(address => bool) public authorizedContracts;                       // Addresses of FlightSuretyApp contract

    struct Airline
    {
        address id; 
        bool voted;
        bool active; // voted and funded
    }

    struct Flight {
        bool isRegistered;
        uint8 statusCode;       
        address airline;
        bytes3 departureAirport; 
        bytes3 arivalAirport;
        string flightNumber; // Unique within airline
        uint departureTime;
        uint arivalTime;
        uint updatedTimestamp; 
    }

    struct Insurance {
        bool active; 
        uint payments;  
    }

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    mapping(bytes32 => Flight) public activeFlights;

    mapping(address => Airline) airlines; 
    uint private numOfAirlines; 
    uint constant MIN_AIRLINES_FOR_VOTING = 3;
    uint constant BITES_BEFORE_AIRLINE_VOTING = 4; 

    mapping(uint => address[]) voting;

    uint constant OPERATIONAL_VOTING = 1; 

    mapping(uint => address[]) appContractVoting;

    mapping(address => mapping(bytes32 => Insurance)) public accountInsurances; 

    uint constant INITIAL_FUNDING_VALUE = 10 ether;

    uint private insurance_coef = 150;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                ) 
                                public 
                                payable
    {
        require(msg.value >= INITIAL_FUNDING_VALUE, "You have send not enough ether");
        contractOwner = msg.sender;
        msg.sender.transfer(msg.value - INITIAL_FUNDING_VALUE);
        addAirline(msg.sender);
        _fund(msg.sender);
    }

    event OperationalVoting(address indexed voter, bool mode, bool last);
    event OperationalVotingReverted(address indexed voter, uint position);

    event AddingAirlineVoting(address indexed addedAirline, address indexed voter, bool last);
    event RemoveAirlineVoting(address indexed removedAirline, address indexed voter, bool last);

    event AppContractUpdated(address indexed prevAppContract, address indexed newAppContract);

    event FlightRegistered(address indexed airline, string indexed flightNumber, bytes32 key); // remove key;

    event BoughtInsurance(address indexed user, bytes32 flightKey, uint cost);
    event PaidForInsurence(address indexed user, bytes32 flightKey, uint cost);

    event FlightStatusUpdated(address indexed airline, string flightNumber, uint8 statusCode);

    event OracleReport(address airline, string flightNum, uint256 timestamp, uint8 status);
    event OracleRequest(uint8 index, address airline, string flightNum, uint256 timestamp);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // Modifier that requires the function caller be authorized
    modifier onlyAuthorized()
    {
        require(authorizedContracts[msg.sender], "Caller is not authorized");
        _;
    }

    modifier onlyAirline()
    {
        require(isActiveAirline(msg.sender), "Caller is not registered airline");
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /// Only for testing. Should be deleted, when deployed to mainnet 
    function setFlightStatus(bytes32 flightKey, uint8 statusCode) external requireContractOwner 
    {
        activeFlights[flightKey].statusCode = statusCode;
    }

    function updateFlightStatus(address airline, string flightNum, uint8 statusCode) external onlyAuthorized 
    {
        bytes32 flightKey = keccak256(abi.encodePacked(airline, flightNum));
        activeFlights[flightKey].statusCode = statusCode;
        emit FlightStatusUpdated(airline, flightNum, statusCode);
    }

    // Add ability for address to access functions from current contract
    function authorizeContract(address _address) external requireContractOwner {
        authorizedContracts[_address] = true;
    }

    // Remove ability for address to access functions from current contract 
    function anauthorizeContract(address _address) external requireContractOwner {
        delete authorizedContracts[_address];
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    function isActiveAirline(address addr) public view returns(bool)
    {
        return airlines[addr].active;
    }

    function isVotedAirline(address addr) public view returns(bool)
    {
        return airlines[addr].voted;
    }

    function isFlightRegistered(bytes32 key) external view returns(bool)
    {
        return activeFlights[key].isRegistered;
    }

    function isContractAuthorized() external view returns(bool)
    {
        return authorizedContracts[msg.sender];
    }

    function isDuplicateAddress(address[] array, address target) private pure returns(bool) 
    {
        bool result = false; 
        for (uint i = 0; i < array.length; i++) 
        {
            if (array[i] == target) 
            {
                result = true;
                break;
            }
        }

        return result;
    }

    function isDuplicateVotingAddress(uint votingId, address target) external view returns(bool) 
    {
        address[] storage array = voting[votingId];
        bool result = false; 
        for (uint i = 0; i < array.length; i++) 
        {
            if (array[i] == target) 
            {
                result = true;
                break;
            }
        }

        return result;
    }

    function isDuplicateUint(uint[] array, uint target) private pure returns(bool) 
    {
        bool result = false; 
        for (uint i = 0; i < array.length; i++) 
        {
            if (array[i] == target) 
            {
                result = true;
                break;
            }
        }

        return result;
    }

    function findVotePosition(uint votingId, address voter, uint expectPosition) external view returns(bool success, uint position)
    {
        success = true;
        position = expectPosition;
        while (voting[votingId][position] != voter) 
        {
            if (position == 0) 
            {
                success = false;
                break;
            }

            position--;
        }
    }

    function hasInsurance(address accountAddress, bytes32 flightId) external view returns(bool)
    {
        return accountInsurances[accountAddress][flightId].active;
    } 

    function getFlightStatusCode(bytes32 flightId) external view returns(uint8) 
    {
        return activeFlights[flightId].statusCode;
    } 

    function getairlineVotingId(address addr) private pure returns(uint)
    {
        return uint(addr) * 2 ** BITES_BEFORE_AIRLINE_VOTING; 
    }

    function addVoter(uint votingId, address voter) external onlyAuthorized returns(uint) {
        voting[votingId].push(voter);
        return voting[votingId].length;
    }

    function getNumOfAirlines() external view returns(uint) {
        return numOfAirlines;
    }

    function getNumOfVotes(uint votingId) external view returns(uint) {
        return voting[votingId].length;
    }

    function addAirline(address airlineAddress) private {
        airlines[airlineAddress].voted = true;
    }

    function confirmAirline(address airlineAddress, uint votingId, address voter) external onlyAuthorized {
        addAirline(airlineAddress);
        delete voting[votingId];
        emit AddingAirlineVoting(airlineAddress, voter, true);
    }

    function voteAirline(address airlineAddress, address voter) external onlyAuthorized {
        emit AddingAirlineVoting(airlineAddress, voter, false);
    }

    function removeAirline(address airlineAddress, uint votingId, address voter) external onlyAuthorized {
        airlines[airlineAddress].active = false;
        airlines[airlineAddress].voted = false;
        numOfAirlines--;
        delete voting[votingId];
        emit RemoveAirlineVoting(airlineAddress, voter, true);
    }

    function voteRemoveAirline(address airlineAddress, address voter) external onlyAuthorized {
        emit RemoveAirlineVoting(airlineAddress, voter, false);
    }


    function setOprationStatusByOwner(bool mode) public requireContractOwner 
    {
        require(numOfAirlines < MIN_AIRLINES_FOR_VOTING, "There are enought airlines for voting. Use 'setOperatingStatus' for voting");
        operational = mode; 
    }

    function setOperationalMode(bool mode, uint votingId, address voter) external onlyAuthorized
    {
        operational = mode; 
        delete voting[votingId];
        emit OperationalVoting(voter, mode, true);
    }

    function operationalVote(bool mode, address voter) external onlyAuthorized
    {
        emit OperationalVoting(voter, mode, false);
    }

    function removeOperationalVote(uint votingId, uint position, address voter) external onlyAuthorized 
    {
        if (voting[votingId].length > 1)
        {
            voting[votingId][position] = voting[votingId][voting[votingId].length-1];
        }
        voting[votingId].length--;
  
        emit OperationalVotingReverted(voter, position);
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    

    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireIsOperational 
    {
        operational = mode;
    }
    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


    function updateAppContract(address prevAppContract, address newAppContract) external onlyAuthorized
    {
        authorizedContracts[prevAppContract] = false; 
        authorizedContracts[newAppContract] = true;

        emit AppContractUpdated(prevAppContract, newAppContract);
    }

    function buyInsurance(address accountAddress, bytes32 key, uint payments) external payable requireIsOperational
    {
        accountInsurances[accountAddress][key] = Insurance({
            active: true,
            payments: payments
        });

        emit BoughtInsurance(accountAddress, key, msg.value);
    }

    function payForInsurance(address accountAddress, bytes32 key) external requireIsOperational
    {
        uint payments = accountInsurances[accountAddress][key].payments; 

        _removeInsurance(accountAddress, key);
        accountAddress.transfer(payments);

        emit PaidForInsurence(accountAddress, key, payments);
    }

    function removeInsurance(address accountAddress, bytes32 key) external requireIsOperational
    {
        _removeInsurance(accountAddress, key);
    }

    function _removeInsurance(address accountAddress, bytes32 key) private requireIsOperational
    {
        delete accountInsurances[accountAddress][key]; 
    }

    function registerFlight(
        bytes32  key, 
        address airlineAddress, 
        string flightNumber, 
        uint8 status,
        bytes3 departureAirport,
        bytes3 arivalAirport,
        uint departureTime,
        uint arivalTime
    ) external onlyAuthorized
    {
        activeFlights[key] = Flight({
            isRegistered: true,
            statusCode: status,
            airline: airlineAddress,
            departureAirport: departureAirport,
            arivalAirport: arivalAirport,
            flightNumber: flightNumber,
            departureTime: departureTime,
            arivalTime: arivalTime,
            updatedTimestamp: now
        });

        emit FlightRegistered(airlineAddress, flightNumber, key);
    }
    

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                                address airlineAddress
                            )
                            public
                            payable
                            requireIsOperational
                            onlyAuthorized

    {
        _fund(airlineAddress);
    }

    function _fund
                            (   
                                address airlineAddress
                            )
                            private
    {
        if (!airlines[airlineAddress].active) 
        {
            numOfAirlines++;
            airlines[airlineAddress].active = true;
        } 
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function createOracleRequest(address requester, bytes32 key) external requireIsOperational onlyAuthorized
    {
         oracleResponses[key] = ResponseInfo({
                                                requester: requester,
                                                isOpen: true
                                            });
    }

    function registerOracle(address addr,  uint8[3] indexes) external payable requireIsOperational onlyAuthorized
    {
        oracles[addr] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function isOracleRegistered(address addr) public view returns(bool)
    {
        return oracles[addr].isRegistered;
    }

    function getMyIndexes
                            (
                                address addr
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[addr].isRegistered, "Not registered as an oracle");

        return oracles[addr].indexes;
    }

    function isOracleRequestOpen(bytes32 key) external view returns(bool) {
        return oracleResponses[key].isOpen;
    }

    function addOracleResponse(bytes32 key, uint8 statusCode, address addr) external requireIsOperational onlyAuthorized returns(uint)
    {
        oracleResponses[key].responses[statusCode].push(addr);
        return oracleResponses[key].responses[statusCode].length;
    }

    function closeOracleRequest(bytes32 key) external requireIsOperational onlyAuthorized {
        oracleResponses[key].isOpen = false;
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund(msg.sender);
    }


}

