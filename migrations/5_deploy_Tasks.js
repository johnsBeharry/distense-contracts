const DIDToken = artifacts.require('./DIDToken.sol')
const Distense = artifacts.require('./Distense.sol')
const Tasks = artifacts.require('./Tasks.sol')

module.exports = deployer => {
  deployer.deploy(Tasks, DIDToken.address, Distense.address)
}
