pragma solidity ^0.4.24;


contract Ownable {

  address public owner;

  constructor () internal {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

}