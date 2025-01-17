pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    FlightSuretyData dataContract;

    mapping(address => address[]) private appUpdateVoting; 

    uint constant BITS_BEFORE_AIRLINE_VOTING = 4; 
    uint public FUNDING_VALUE = 10 ether;

    uint constant OPERATIONAL_VOTING = 1; 
    uint constant MIN_AIRLINES_FOR_VOTING = 4;

    uint private constant MAX_INSURANCE_COST = 1 ether; 

    event UpdateAppContractVoting(address voter, address newContractAddress, bool last);

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
         // Modify to call data contract's status
        require(isOperational(), "Contract is currently not operational");  
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

    modifier activeAirline()
    {
        require(dataContract.isActiveAirline(msg.sender), "Caller should be active airline");
        _;
    }

    modifier votedAirline()
    {
        require(dataContract.isVotedAirline(msg.sender), "Caller should be voted airline");
        _;
    } 

    modifier onlyOwner() 
    {
        require(msg.sender == contractOwner, "Only owner can call this function");
        _;
    }

    modifier contractAuthorized()
    {
        //require(dataContract.isContractAuthorized(), "Caller is not authorized"); // Can't understand why this line break everything. Run out of gas...
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address dataContractAddress
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        dataContract = FlightSuretyData(dataContractAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            view
                            returns(bool) 
    {
        return dataContract.isOperational();
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

    function getairlineVotingId(address addr) private pure returns(uint)
    {
        return uint(addr) * 2 ** BITS_BEFORE_AIRLINE_VOTING; 
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            activeAirline 
                            contractAuthorized
                            returns(bool success, uint256 votes)
    {
        require(mode != isOperational(), "Mode should differ from opperational");
        require(!dataContract.isDuplicateVotingAddress(OPERATIONAL_VOTING, msg.sender), "You already voted for changing operational status");

        votes = dataContract.addVoter(OPERATIONAL_VOTING, msg.sender);
        uint numOfAirlines = dataContract.getNumOfAirlines();
        success = 2 * votes >= numOfAirlines;

        if  (success)
        {
            dataContract.setOperationalMode(mode, OPERATIONAL_VOTING, msg.sender);
        }
        else 
        {
            dataContract.operationalVote(mode, msg.sender);
        }
    }

    function removeOperationalVote(uint position) public activeAirline contractAuthorized
    {
        require(position < dataContract.getNumOfVotes(OPERATIONAL_VOTING), "Position can't be grater than array length");
        uint actPosition; 
        bool success; 
        (success, actPosition) = dataContract.findVotePosition(OPERATIONAL_VOTING, msg.sender, position);

        require(success, "Can't find such voting");

        dataContract.removeOperationalVote(OPERATIONAL_VOTING, actPosition, msg.sender);
    } 
  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline
                            (   
                                address addr
                            )
                            external
                            requireIsOperational
                            activeAirline
                            contractAuthorized
                            returns(bool success, uint256 votes)
    {
        require(!dataContract.isVotedAirline(addr), "Voting already finished");
        uint votingId = getairlineVotingId(addr);

        require(!dataContract.isDuplicateVotingAddress(votingId, msg.sender), "You have already voted");

        votes = dataContract.addVoter(votingId, msg.sender);
        uint numOfAirlines = dataContract.getNumOfAirlines();
        success = 2 * votes >= numOfAirlines || numOfAirlines < MIN_AIRLINES_FOR_VOTING;

        if  (success)
        {
            dataContract.confirmAirline(addr, votingId, msg.sender);
        }
        else 
        {   
            dataContract.voteAirline(addr, msg.sender);
        }
    }

    function unRegisterAirline(address addr) external requireIsOperational contractAuthorized activeAirline returns(bool success, uint votes)
    {
        require(dataContract.isActiveAirline(addr), "You cant unregister unregistered airline");// ?
        uint votingId = getairlineVotingId(addr);

        require(!dataContract.isDuplicateVotingAddress(votingId, msg.sender), "You have already voted");

        votes = dataContract.addVoter(votingId, msg.sender);
        uint numOfAirlines = dataContract.getNumOfAirlines();
        success = 2 * votes >= numOfAirlines;

        if  (success)
        {
            dataContract.removeAirline(addr, votingId, msg.sender);
        }
        else 
        {   
            dataContract.voteRemoveAirline(addr, msg.sender);
        }
    }

    function fund() external payable requireIsOperational votedAirline
    {
        require(dataContract.isVotedAirline(msg.sender), "Airline should be voted first."); // ? 
        require(msg.value >= FUNDING_VALUE, "You have send not enough ether");

        msg.sender.transfer(msg.value - FUNDING_VALUE);
        dataContract.fund(msg.sender);
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight
                                (
                                    string flightNumber,
                                    bytes3 departureAirport,
                                    bytes3 arivalAirport,
                                    uint departureTime,
                                    uint arivalTime
                                )
                                external
                                requireIsOperational
                                activeAirline
                                contractAuthorized
    {
        bytes32 key = keccak256(abi.encodePacked(msg.sender, flightNumber)); 
        require(!dataContract.isFlightRegistered(key), "Flight is already registered");

        dataContract.registerFlight(
            key, 
            msg.sender, 
            flightNumber, 
            STATUS_CODE_UNKNOWN, 
            departureAirport, 
            arivalAirport, 
            departureTime, 
            arivalTime
        );
    }

    function buyInsurance(bytes32 key) external requireIsOperational contractAuthorized payable
    {
        require(dataContract.isFlightRegistered(key), "No such flight");
        require(msg.value <= MAX_INSURANCE_COST, "You have sent more than maximum insurance cost"); 
        require(!dataContract.hasInsurance(msg.sender, key), "You already have insurance for this flight");

        dataContract.buyInsurance.value(msg.value)(msg.sender, key, (msg.value * 3)/2);
    }

    function payForInsurance(bytes32 key) external requireIsOperational contractAuthorized
    {
        require(dataContract.isFlightRegistered(key), "No such flight");
        require(dataContract.hasInsurance(msg.sender, key), "You don't have insurance for that flight");

        uint8 flightStatusCode = dataContract.getFlightStatusCode(key);

        if (flightStatusCode == STATUS_CODE_LATE_AIRLINE) 
        {
            dataContract.payForInsurance(msg.sender, key);
        } 
        else if (flightStatusCode != STATUS_CODE_UNKNOWN)
        {
            dataContract.removeInsurance(msg.sender, key);
        }
    }

    function updateAppContract(address newAppContract) external requireIsOperational activeAirline contractAuthorized
    {
        require(!isDuplicateAddress(appUpdateVoting[newAppContract], msg.sender), "You have already voted for changing app contract.");

        appUpdateVoting[newAppContract].push(msg.sender);

        uint numOfAirlines = dataContract.getNumOfAirlines();

        if  (appUpdateVoting[newAppContract].length >= numOfAirlines / 2)
        {   
            dataContract.updateAppContract(address(this), newAppContract);
            emit UpdateAppContractVoting(msg.sender, newAppContract, true);
        }
        else 
        {
            emit UpdateAppContractVoting(msg.sender, newAppContract, false);
        }
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flightNum,
                                    uint8 statusCode
                                )
                                internal
    {
        dataContract.updateFlightStatus(airline, flightNum, statusCode);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flightNum,
                            uint256 timestamp                            
                        )
                        external
    {
        bytes32 flightKey = keccak256(abi.encodePacked(airline, flightNum));
        require(dataContract.getFlightStatusCode(flightKey) == STATUS_CODE_UNKNOWN, "Flight status is already known");

        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flightNum, timestamp));
        dataContract.createOracleRequest(msg.sender, key);

        emit OracleRequest(index, airline, flightNum, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flightNum, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flightNum, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flightNum, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
                            requireIsOperational
                            contractAuthorized
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        dataContract.registerOracle(msg.sender, indexes);
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        return dataContract.getMyIndexes(msg.sender);
    }


    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flightNum,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
                        requireIsOperational
    {
        uint8[3] memory indexes = dataContract.getMyIndexes(msg.sender);
        require((indexes[0] == index) || (indexes[1] == index) || (indexes[2] == index), "Index does not match oracle request");

        bytes32 key = keccak256(abi.encodePacked(index, airline, flightNum, timestamp)); 
        require(dataContract.isOracleRequestOpen(key), "Flight or timestamp do not match oracle request");

        uint numOfResponses = dataContract.addOracleResponse(key, statusCode, msg.sender);

        emit OracleReport(airline, flightNum, timestamp, statusCode);
        
        if (numOfResponses >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flightNum, timestamp, statusCode);
            dataContract.closeOracleRequest(key);
            // Handle flight status as appropriate
            processFlightStatus(airline, flightNum, statusCode);
        }
    }

    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   

contract FlightSuretyData {
    function isActiveAirline(address addr) public view returns(bool);
    function isDuplicateVotingAddress(uint votingId, address target) external view returns(bool);
    function addVoter(uint votingId, address voter) external returns(uint);
    function getNumOfAirlines() external view returns(uint);
    function voteAirline(address airlineAddress, address voter) external;
    function confirmAirline(address airlineAddress, uint votingId, address voter) external;
    function isVotedAirline(address addr) public view returns(bool);
    function removeAirline(address airlineAddress, uint votingId, address voter) external;
    function voteRemoveAirline(address airlineAddress, address voter) external;
    function fund(address airlineAddress) public payable;
    function isOperational() public view returns(bool);
    function setOperationalMode(bool mode, uint votingId, address voter) external;
    function operationalVote(bool mode, address voter) external;
    function findVotePosition(uint votingId, address voter, uint expectPosition) external returns(bool, uint);
    function removeOperationalVote(uint votingId, uint position, address voter) external;
    function getNumOfVotes(uint votingId) external view returns(uint);
    function registerFlight(bytes32  key, address airlineAddress, string flightNumber, uint8 status,bytes3 departureAirport,bytes3 arivalAirport,uint departureTime,uint arivalTime) external;
    function isFlightRegistered(bytes32 key) external view returns(bool);
    function hasInsurance(address accountAddress, bytes32 flightId) external view returns(bool);
    function buyInsurance(address accountAddress, bytes32 key, uint payments) external payable;
    function getFlightStatusCode(bytes32 flightId) external returns(uint8);
    function payForInsurance(address accountAddress, bytes32 key) external;
    function removeInsurance(address accountAddress, bytes32 key) external;
    function updateAppContract(address prevAppContract, address newAppContract) external;
    function updateFlightStatus(address airline, string flightNum, uint8 statusCode) external;
    function isContractAuthorized() external view returns(bool);
    function registerOracle(address addr,  uint8[3] indexes) external payable;
    function getMyIndexes(address addr) view external returns(uint8[3]);
    function isOracleRegistered(address addr) public view returns(bool);
    function isOracleRequestOpen(bytes32 key) external view returns(bool);
    function addOracleResponse(bytes32 key, uint8 statusCode, address addr) external  returns(uint);
    function closeOracleRequest(bytes32 key) external;
    function createOracleRequest(address requester, bytes32 key) external;
}
