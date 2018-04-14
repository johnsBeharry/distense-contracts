pragma solidity ^0.4.21;

import './lib/Approvable.sol';
import './Distense.sol';
import './Debuggable.sol';
import './lib/SafeMath.sol';

contract DIDToken is Approvable, Debuggable {

    using SafeMath for uint256;

    event LogIssueDID(address indexed to, uint256 numDID);
    event LogDecrementDID(address indexed to, uint256 numDID);
    event LogExchangeDIDForEther(address indexed to, uint256 numDID);
    event LogInvestEtherForDID(address indexed to, uint256 numWei);

    address[] public DIDHoldersArray;

    address public PullRequestsAddress;
    address public DistenseAddress;

    uint256 public investmentLimitAggregate  = 10000 ether;  // This is the max DID all addresses can receive from depositing ether
    uint256 public investmentLimitAddress = 100 ether;  // This is the max DID any address can receive from Ether deposit
    uint256 public investedAggregate = 1 ether;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    struct DIDHolder {
        uint256 balance;
        uint256 netContributionsDID;    // essentially the number of DID remaining for calculating how much ether an account may invest
        uint256 DIDHoldersIndex;
        uint256 weiInvested;
        uint256 tasksCompleted;
    }
    mapping (address => DIDHolder) public DIDHolders;

    function DIDToken() public {
        name = "Distense DID";
        symbol = "DID";
        totalSupply = 0;
        decimals = 18;
    }

    function issueDID(address _recipient, uint256 _numDID) public onlyApproved returns (uint256) {
        require(_recipient != address(0));
        require(_numDID > 0);

        _numDID = _numDID * 1 ether;
        totalSupply = SafeMath.add(totalSupply, _numDID);
        
        uint256 balance = DIDHolders[_recipient].balance;
        DIDHolders[_recipient].balance = SafeMath.add(balance, _numDID);

        if (DIDHolders[_recipient].DIDHoldersIndex == 0)
            DIDHolders[_recipient].DIDHoldersIndex = DIDHoldersArray.push(_recipient) - 1;

        emit LogIssueDID(_recipient, _numDID);

        return DIDHolders[_recipient].balance;
    }

    function decrementDID(address _address, uint256 _numDID) external onlyApproved returns (uint256) {
        require(_address != address(0));
        require(_numDID > 0);
        uint256 numDID = _numDID * 1 ether;
        require(SafeMath.sub(DIDHolders[_address].balance, numDID) >= 0);
        require(SafeMath.sub(totalSupply, numDID ) >= 0);

        totalSupply = SafeMath.sub(totalSupply, numDID);
        DIDHolders[_address].balance = SafeMath.sub(DIDHolders[_address].balance, numDID);

        //  If DIDHolder has exchanged all of their DID remove from DIDHoldersArray
        if (DIDHolders[_address].balance == 0) {
            if (DIDHoldersArray.length > 1) {
                address lastElement = DIDHoldersArray[DIDHoldersArray.length - 1];
                DIDHoldersArray[DIDHolders[_address].DIDHoldersIndex] = lastElement;
                DIDHoldersArray.length--;
                delete DIDHolders[msg.sender];
            }
        }

        emit LogDecrementDID(_address, numDID);

        return DIDHolders[_address].balance;
    }

    function pctDIDOwned(address _address) external view returns (uint256) {
        return SafeMath.percent(DIDHolders[_address].netContributionsDID, totalSupply, 20);
    }

    function exchangeDIDForEther(uint256 _numDIDToExchange)
        hasEnoughDID(msg.sender, _numDIDToExchange)
        external
    returns (uint256) {

        Distense distense = Distense(DistenseAddress);
        uint256 DIDPerEther = distense.getParameterValueByTitle(distense.didPerEtherParameterTitle());

        uint256 numEtherToIssue = SafeMath.div(_numDIDToExchange, DIDPerEther);

        uint256 numDIDToExchange = _numDIDToExchange * 1 ether;

        address contractAddress = this;
        require(contractAddress.balance > numEtherToIssue);

        //  Adjust number of DID owned first
        DIDHolders[msg.sender].balance = SafeMath.sub(DIDHolders[msg.sender].balance, numDIDToExchange);
        totalSupply = SafeMath.sub(totalSupply, numDIDToExchange);

        msg.sender.transfer(numEtherToIssue);

        if (DIDHolders[msg.sender].balance == 0) {
            if (DIDHoldersArray.length > 1) {
                address lastElement = DIDHoldersArray[DIDHoldersArray.length - 1];
                DIDHoldersArray[DIDHolders[msg.sender].DIDHoldersIndex] = lastElement;
                DIDHoldersArray.length--;
                delete DIDHolders[msg.sender];
            }
        }
        emit LogExchangeDIDForEther(msg.sender, numDIDToExchange);

        return DIDHolders[msg.sender].balance;
    }

    function investEtherForDID() canDepositThisManyEtherForDID external payable returns (uint256) {

        Distense distense = Distense(DistenseAddress);
        uint256 DIDPerEther = SafeMath.div(distense.getParameterValueByTitle(distense.didPerEtherParameterTitle()), 1 ether);

        require(getNumWeiAddressMayInvest(msg.sender) >= msg.value);

        uint256 numDIDToIssue = calculateNumDIDToIssue(msg.value, DIDPerEther);
        require(DIDHolders[msg.sender].netContributionsDID >= numDIDToIssue);

        totalSupply = SafeMath.add(totalSupply, numDIDToIssue);
        DIDHolders[msg.sender].balance = SafeMath.add(DIDHolders[msg.sender].balance, numDIDToIssue);
        decrementDIDFromContributions(msg.sender, numDIDToIssue);

        DIDHolders[msg.sender].weiInvested += msg.value;
        investedAggregate = investedAggregate + msg.value;

        emit LogIssueDID(msg.sender, numDIDToIssue);
        emit LogInvestEtherForDID(msg.sender, msg.value);

        return DIDHolders[msg.sender].balance;
    }

    function incrementTasksCompleted(address _contributor) onlyApproved public returns (bool) {
        DIDHolders[_contributor].tasksCompleted++;
        return true;
    }

    function getNumWeiAddressMayInvest(address _contributor) public returns (uint256) {

        uint256 DIDFromContributions = DIDHolders[_contributor].netContributionsDID;
        require(DIDFromContributions > 0);
        uint256 netUninvestedEther = SafeMath.sub(investmentLimitAddress, DIDHolders[_contributor].weiInvested);
        require(netUninvestedEther > 0);

        Distense distense = Distense(DistenseAddress);
        uint256 DIDPerEther = distense.getParameterValueByTitle(distense.didPerEtherParameterTitle());

        return (DIDFromContributions * 1 ether) / DIDPerEther;
    }

    function rewardContributor(address _contributor, uint256 _reward) external returns (bool) {
        issueDID(_contributor, _reward);
        incrementTasksCompleted(_contributor);
        incrementDIDFromContributions(_contributor, _reward);
    }

    function getWeiAggregateMayInvest() public view returns (uint256) {
        return SafeMath.sub(investmentLimitAggregate, investedAggregate);
    }

    function getNumDIDHolders() external view returns (uint256) {
        return DIDHoldersArray.length;
    }

    function getAddressBalance(address _address) public view returns (uint256) {
        return DIDHolders[_address].balance;
    }

    function getNetNumContributionsDID(address _address) public view returns (uint256) {
        return DIDHolders[_address].netContributionsDID;
    }

    function getWeiInvested(address _address) public view returns (uint256) {
        return DIDHolders[_address].weiInvested;
    }

    function setDistenseAddress(address _distenseAddress) public onlyApproved {
        DistenseAddress = _distenseAddress;
    }

    function calculateNumDIDToIssue(uint256 msgValue, uint256 DIDPerEther) public pure returns (uint256) {
        return SafeMath.mul(msgValue, DIDPerEther);
    }

    function incrementDIDFromContributions(address _contributor, uint256 _reward) public {
        uint256 incrementReward = _reward * 1 ether;
        DIDHolders[_contributor].netContributionsDID += incrementReward;
        totalSupply += incrementReward;
    }

    function decrementDIDFromContributions(address _contributor, uint256 _num) public {
        DIDHolders[_contributor].netContributionsDID -= _num * 1 ether;
    }

    modifier hasEnoughDID(address _address, uint256 _num) {
        require(DIDHolders[_address].balance >= _num);
        _;
    }

    modifier canDepositThisManyEtherForDID() {
        uint256 numWeiMayInvest = getNumWeiAddressMayInvest(msg.sender);
        require(numWeiMayInvest >= msg.value);
        require(investedAggregate < investmentLimitAggregate);
        _;
    }
}
