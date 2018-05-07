const DIDToken = artifacts.require('./DIDToken.sol')
const Distense = artifacts.require('./Distense.sol')
const Tasks = artifacts.require('./Tasks.sol')
const SafeMath = artifacts.require('./SafeMath.sol')
const SafeMathMock = artifacts.require('./SafeMathMock')

module.exports = deployer => {
  deployer.deploy(SafeMath).then(() => {
    deployer.link(SafeMath, [DIDToken, SafeMathMock, Tasks, Distense])
  })
}
