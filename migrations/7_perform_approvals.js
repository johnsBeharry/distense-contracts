const DIDToken = artifacts.require('./DIDToken.sol')
const Distense = artifacts.require('./Distense.sol')
const PullRequests = artifacts.require('./PullRequests.sol')
const Tasks = artifacts.require('./Tasks.sol')

module.exports = (deployer, network, accounts) => {
  Tasks.deployed()
    .then(async tasks => {
      await tasks.approve(PullRequests.address)
      const isApproved = await tasks.approved.call(PullRequests.address)
      if (isApproved)
        console.log(`PullRequests address now Tasks contract approved`)
      else console.log(`Failed to approve PullRequests address`)
    })
    .then(() => {
      return DIDToken.deployed()
    })
    .then(async didToken => {
      const pullRequests = await PullRequests.deployed()
      await didToken.approve(pullRequests.address)
      await didToken.approved.call(pullRequests.address)
      await didToken.setDistenseAddress(Distense.address)
    })
    .catch(err => {
      console.log(`error: ${err}`)
    })
}
