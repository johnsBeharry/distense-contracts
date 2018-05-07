const DIDToken = artifacts.require('./DIDToken.sol')
const Distense = artifacts.require('./Distense.sol')

module.exports = deployer => {
  DIDToken.deployed().then(() => {
    return deployer.deploy(Distense, DIDToken.address)
  })
}
