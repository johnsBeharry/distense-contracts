const web3 = global.web3
const DIDToken = artifacts.require('DIDToken')
const Distense = artifacts.require('./Distense.sol')
const web3Utils = require('web3-utils')
const didPerEtherParameter = require('./Distense.test')
const BigNumber = require('bignumber.js')

const increaseTime = addSeconds => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [addSeconds],
    id: 0
  })
}

const utils = require('./helpers/utils')

contract('DIDToken', function(accounts) {
  let didToken
  let distense

  beforeEach(async function() {
    didToken = await DIDToken.new()
    distense = await Distense.new(didToken.address)
    await didToken.setDistenseAddress(distense.address)
  })

  it('should set the initial attributes correctly', async function() {
    assert.equal(await didToken.totalSupply(), 0, 'totalSupply incorrect')
    assert.equal(await didToken.name(), 'Distense DID', 'incorrect')
    assert.equal(await didToken.symbol(), 'DID', 'incorrect')
    assert.equal(await didToken.decimals(), 18, 'incorrect')
    assert.notEqual(
      await didToken.DistenseAddress.call(),
      undefined,
      'Distense address must be set'
    )
  })

  it('should issueDID correctly', async function() {
    await didToken.issueDID(accounts[0], 4321)
    let newSupply = await didToken.totalSupply()
    assert.equal(newSupply.toString(), 4.321e21)

    await didToken.issueDID(accounts[0], 112340876)
    newSupply = await didToken.totalSupply()
    assert.equal(newSupply.toNumber(), 1.12345197e26)
  })

  it('should disallow issueDID from an empty address', async function() {
    let addError
    try {
      //contract throws error here
      await didToken.issueDID(accounts[5], 1234, {
        from: ''
      })
    } catch (error) {
      addError = error
    }
    assert.notEqual(addError, undefined, 'Error must be thrown')
  })

  it('should allow issueDID from owner', async function() {
    let addError
    try {
      //contract throws error here
      await didToken.issueDID(accounts[5], 9100, {
        from: accounts[0]
      })
    } catch (error) {
      addError = error
    }
    assert.equal(addError, undefined, 'Error must not be thrown')
    const balance = await didToken.getAddressBalance.call(accounts[5])
    assert.equal(balance.toString(), 9.1e21)
  })

  it('should disallow an issueDID call for === 0', async function() {
    let addError
    try {
      //contract throws error here
      await didToken.issueDID(accounts[5], 0, {
        from: accounts[0]
      })
    } catch (error) {
      addError = error
    }
    assert.notEqual(addError, undefined, 'Error must be thrown')
    const totalSupply = await didToken.totalSupply()
    assert.equal(totalSupply.toString(), 0, 'No DID should have been issued')
  })

  it('should correctly calculate the percentDID someone owns', async function() {
    assert.equal(await didToken.totalSupply(), 0)
    await didToken.issueDID(accounts[0], 200)
    let percentDID = await didToken.pctDIDOwned(accounts[0])
    assert.equal(percentDID.toString(), 100000000000000000000)

    await didToken.issueDID(accounts[1], 100)
    percentDID = await didToken.pctDIDOwned(accounts[1])
    assert.equal(percentDID.toString(), 33333333333333333333)

    await didToken.issueDID(accounts[1], 100)
    percentDID = await didToken.pctDIDOwned(accounts[1])
    assert.equal(percentDID.toString(), 50000000000000000000)
  })

  it("should throw an error when someone tries to exchange DID for ether who doesn't own DID", async function() {
    let exchangeError
    try {
      //  accounts[1] has no DID so this should fail/throw an error
      assert.equal(
        await didToken.getAddressBalance.call(accounts[1]),
        0,
        'accounts[1] must own 0 DID for this test to properly fail'
      )
      await didToken.exchangeDIDForEther(100, {
        from: accounts[1]
      })
    } catch (error) {
      exchangeError = error
    }
    assert.notEqual(exchangeError, undefined, 'Error should be thrown')
  })

  it('should allow an address that owns sufficient DID to exchange 2 ether for DID', async function() {
    let etherForDIDInvestError
    await didToken.issueDID(accounts[0], 20000000)
    await didToken.incrementDIDFromContributions(accounts[0], 2000000)

    try {
      await didToken.investEtherForDID({
        from: accounts[0],
        value: web3.toWei(2)
      })
    } catch (error) {
      etherForDIDInvestError = error
      console.error(`etherForDIDInvestError: ${etherForDIDInvestError}`)
    }

    const didTokenEtherBalance = await web3.eth.getBalance(didToken.address)
    assert.equal(
      didTokenEtherBalance.toNumber(),
      web3.toWei(2),
      `Contracts ether balance should be 2`
    )
    assert.equal(
      etherForDIDInvestError,
      undefined,
      'Error should not be thrown'
    )
  })

  it('should increment the number of DID for those who invest ether', async function() {
    let etherForDIDExchangeError
    await didToken.issueDID(accounts[0], 20000)
    await didToken.incrementDIDFromContributions(accounts[0], 20000)

    const preInvestDIDBalance = await didToken.getAddressBalance.call(
      accounts[0]
    )

    try {
      await didToken.investEtherForDID(
        {},
        {
          from: accounts[0],
          value: web3.toWei(2, 'ether')
        }
      )
    } catch (error) {
      etherForDIDExchangeError = error
      console.error(`etherForDIDExchangeError: ${etherForDIDExchangeError}`)
    }

    const postInvestDIDBalance = await didToken.getAddressBalance.call(
      accounts[0]
    )

    const didPerEther = await distense.getParameterValueByTitle('didPerEther')
    assert.equal(
      didPerEther.toString(),
      1e21,
      'make sure didPerEther is still 1000'
    )

    assert.equal(
      postInvestDIDBalance.toNumber(),
      22000e18,
      'accounts[0] DID balance should be 22000e18'
    )
  })

  it('should decrement the number of DID', async function() {
    await didToken.issueDID(accounts[0], 20000)
    await didToken.decrementDID(accounts[0], 10001)
    const DIDBalance = await didToken.getAddressBalance.call(accounts[0])

    assert.equal(
      DIDBalance.toNumber(),
      9.999e21,
      'accounts[0] DID balance should be 9999'
    )
  })

  it('should reject decrementing too many DID', async function() {
    let error
    try {
      await didToken.issueDID(accounts[0], 20000)
      await didToken.decrementDID(accounts[0], 20001)
    } catch (e) {
      error = e
    }
    assert.notEqual(
      error,
      undefined,
      'should have thrown an error decrementing too many DID'
    )
  })

  it('should not increment the number of DID for those who invest too much ether', async function() {
    let etherForDIDExchangeError
    await didToken.issueDID(accounts[0], 20000)
    const preInvestDIDBalance = await didToken.getAddressBalance.call(
      accounts[0]
    )
    const etherToInvest = 1001

    try {
      await didToken.investEtherForDID(
        {},
        {
          from: accounts[0],
          value: web3.toWei(etherToInvest, 'ether')
        }
      )
    } catch (error) {
      etherForDIDExchangeError = error
    }

    const postInvestDIDBalance = await didToken.getAddressBalance.call(
      accounts[0]
    )

    assert.notEqual(
      etherForDIDExchangeError,
      undefined,
      'Should throw an error'
    )
    assert.equal(
      postInvestDIDBalance.toNumber(),
      preInvestDIDBalance.toNumber(),
      'accounts[0] DID balance should be the same after trying to invest too much'
    )
  })

  it('should decrement the balance of DID of the DID exchanger', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    // await didToken.issueDID(accounts[1], 2000)
    await didToken.incrementDIDFromContributions(accounts[1], 10000)

    await didToken.investEtherForDID({
      from: accounts[1],
      value: web3.toWei(4)
    })

    const numDIDToExchange = 1

    await didToken.exchangeDIDForEther(numDIDToExchange, {
      from: accounts[1]
    })

    const updatedBalance = await didToken.getAddressBalance.call(accounts[1])

    assert.equal(updatedBalance.toString(), 3.999e21)
  })

  //  reviewed 4-14-2018 JJA
  it('should increment the investedAddress of an address', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.issueDID(accounts[1], 2000000)
    await didToken.incrementDIDFromContributions(accounts[1], 2000000)

    await didToken.investEtherForDID({
      from: accounts[1],
      value: web3.toWei(2)
    })

    let weiInvested = await didToken.getWeiInvested.call(accounts[1])

    assert.equal(
      weiInvested.toString(),
      web3.toWei(2),
      'accounts[1] invested 2 ether at this point'
    )

    await didToken.investEtherForDID({
      from: accounts[1],
      value: web3.toWei(3.3)
    })

    weiInvested = await didToken.getWeiInvested.call(accounts[1])

    assert.equal(
      weiInvested.toString(),
      web3.toWei(5.3),
      'accounts[1] invested 5.3 ether at this point'
    )
  })

  //  reviewed 4-14-2018 JJA
  it('should increment investedAggregate', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.issueDID(accounts[1], 1000000)
    await didToken.incrementDIDFromContributions(accounts[1], 1000000)

    await didToken.investEtherForDID(
      {},
      {
        from: accounts[1],
        value: web3.toWei(2)
      }
    )

    let investedAggregate = await didToken.investedAggregate.call()

    assert.equal(
      investedAggregate.toString(),
      web3.toWei(3),
      'investedAggregate should be higher by 2 ether'
    )
  })

  //  reviewed 4-14-2018 JJA
  it('remainingWeiAggregateMayInvest should return correct values', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.incrementDIDFromContributions(accounts[1], 10000)

    await didToken.investEtherForDID(
      {},
      {
        from: accounts[1],
        value: web3.toWei(1, 'ether')
      }
    )

    const remainingWei = await didToken.getWeiAggregateMayInvest.call()
    assert.equal(remainingWei.toString(), 9.998e21) // 9998
  })

  //  reviewed 4-14-2018 JJA
  it('numWeiAddressMayInvest should prevent those with 0 DID from contributions from contributing', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.issueDID(accounts[0], 1000000) // DID but no DID from contributions
    let someError

    try {
      await didToken.getNumWeiAddressMayInvest(accounts[0]) // throws
    } catch (error) {
      someError = error
    }
    assert.notEqual(someError, undefined)
  })

  //  reviewed 4-16-2018 JJA
  it('numWeiAddressMayInvest should allow those who have DID from contributions to invest', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.incrementDIDFromContributions(accounts[0], 10000)

    let numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[0]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(10, 'ether'))

    //  second test
    await didToken.incrementDIDFromContributions(accounts[0], 5)
    numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[0]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(10.005, 'ether'))

    //  third
    await didToken.incrementDIDFromContributions(accounts[0], 501)
    numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[0]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(10.506, 'ether'))

    //  fourth
    await didToken.incrementDIDFromContributions(accounts[1], 101)
    numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[1]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(0.101, 'ether'))

    await didToken.incrementDIDFromContributions(accounts[1], 88701)
    numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[1]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(88.802, 'ether'))

    await didToken.incrementDIDFromContributions(accounts[1], 55308)
    numWeiAddressMayInvest = await didToken.getNumWeiAddressMayInvest.call(
      accounts[1]
    )
    assert.equal(numWeiAddressMayInvest.toString(), web3.toWei(144.11, 'ether'))
  })

  it('should fire event "LogIssueDID" and "LogInvestEtherForDID investEtherForDID is called', async function() {
    await didToken.issueDID(accounts[0], 120000)
    await didToken.incrementDIDFromContributions(accounts[0], 120000)

    await didToken.investEtherForDID(
      {},
      {
        from: accounts[0],
        value: web3.toWei(1, 'ether')
      }
    )

    let LogIssueDIDEvents = didToken.LogIssueDID()
    let LogIssueDIDLog = await new Promise((resolve, reject) =>
      LogIssueDIDEvents.get(
        (error, log) => (error ? reject(error) : resolve(log))
      )
    )

    assert.equal(LogIssueDIDLog.length, 1, 'should be 1 event')
    let eventArgs = LogIssueDIDLog[0].args
    assert.equal(eventArgs.to, accounts[0])
    assert.isAbove(eventArgs.numDID, 0)

    let LogInvestEtherForDIDEvents = didToken.LogInvestEtherForDID()
    let LogInvestEtherForDID = await new Promise((resolve, reject) =>
      LogInvestEtherForDIDEvents.get(
        (error, log) => (error ? reject(error) : resolve(log))
      )
    )

    assert.equal(LogInvestEtherForDID.length, 1, 'should be 1 event')
    eventArgs = LogInvestEtherForDID[0].args
    assert.equal(eventArgs.to, accounts[0])
    assert.equal(eventArgs.numWei.toString(), web3.toWei(1))
  })

  it('should delete DIDHolders from the DIDHoldersArray who own 0 DID', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.issueDID(accounts[5], 101)
    await didToken.issueDID(accounts[4], 100)
    await didToken.incrementDIDFromContributions(accounts[4], 100)
    await didToken.issueDID(accounts[3], 102)
    await didToken.issueDID(accounts[0], 102)
    await didToken.incrementDIDFromContributions(accounts[0], 20000)

    await didToken.investEtherForDID({
      from: accounts[0],
      value: web3.toWei(2)
    })
    await didToken.exchangeDIDForEther(100, {
      from: accounts[4]
    })

    //  Verify decrementation
    const numDIDHolders = await didToken.getNumDIDHolders.call()
    assert.equal(
      numDIDHolders.toString(),
      3,
      'should only be 3 DID holders here'
    )

    //  Verify correct address was deleted
    const balance5 = await didToken.getAddressBalance.call(accounts[5])
    assert.equal(
      balance5.toString(),
      101000000000000000000,
      'accounts[5] should still own 101 DID'
    )

    const balance4 = await didToken.getAddressBalance.call(accounts[4])
    assert.equal(balance4.toString(), 0, 'accounts[4] should own 0 DID')

    const balance3 = await didToken.getAddressBalance.call(accounts[3])
    assert.equal(
      balance3.toString(),
      102000000000000000000,
      'accounts[4] should own 0 DID'
    )
  })

  it('should limit investing ether to the amount they have earned from contributions', async function() {
    let etherForDIDExchangeError
    await didToken.issueDID(accounts[0], 2000)
    await didToken.incrementDIDFromContributions(accounts[0], 2000)

    try {
      await didToken.investEtherForDID(
        {},
        {
          from: accounts[0],
          value: web3.toWei(50, 'ether') // too much ether!
        }
      )
    } catch (error) {
      etherForDIDExchangeError = error
      console.error(`etherForDIDExchangeError: ${etherForDIDExchangeError}`)
    }
    assert.notEqual(etherForDIDExchangeError, undefined)
  })

  it('should allow someone to invest ether if they have enough contributions DID', async function() {
    let etherForDIDExchangeError
    await didToken.issueDID(accounts[0], 20000)
    await didToken.incrementDIDFromContributions(accounts[0], 20000)

    try {
      await didToken.investEtherForDID(
        {},
        {
          from: accounts[0],
          value: web3.toWei(10, 'ether')
        }
      )
    } catch (error) {
      etherForDIDExchangeError = error
      console.error(`etherForDIDExchangeError: ${etherForDIDExchangeError}`)
    }
    assert.equal(etherForDIDExchangeError, undefined)
  })

  it('calculateNumDIDToIssue', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    let DID = await didToken.calculateNumDIDToIssue.call(
      web3.toWei(0.1, 'ether'),
      1000
    )
    assert.equal(DID.toString(), 100000000000000000000)

    DID = await didToken.calculateNumDIDToIssue.call(
      web3.toWei(0.5, 'ether'),
      1000
    )
    assert.equal(DID.toString(), 500000000000000000000)

    DID = await didToken.calculateNumDIDToIssue.call(
      web3.toWei(1.1, 'ether'),
      1100
    )
    assert.equal(DID.toString(), 1.21e21)

    DID = await didToken.calculateNumDIDToIssue.call(
      web3.toWei(3.3333, 'ether'),
      1100
    )
    assert.equal(DID.toString(), 3.66663e21)
  })

  it('investEtherForDID should decrement the DID balances of an address', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.issueDID(accounts[1], 10000)
    await didToken.incrementDIDFromContributions(accounts[1], 10000)

    await didToken.investEtherForDID({
      from: accounts[1],
      value: web3.toWei(3)
    })

    const didBalance = await didToken.getAddressBalance.call(accounts[1])
    assert.isBelow(didBalance.toString(), web3.toWei(10000, 'ether'), '')
  })

  it('calculateNumWeiToIssue should perform correctly', async function() {
    let WEI = await didToken.calculateNumWeiToIssue.call(
      web3.toWei(1, 'ether'),
      web3.toWei(1000, 'ether')
    )
    assert.equal(WEI.toString(), web3.toWei(1, 'finney'))

    WEI = await didToken.calculateNumWeiToIssue.call(
      web3.toWei(12100),
      web3.toWei(1100)
    )
    assert.equal(WEI.toString(), web3.toWei(11, 'ether'))

    WEI = await didToken.calculateNumWeiToIssue.call(
      web3.toWei(33333),
      web3.toWei(1100)
    )
    assert.equal(WEI.toString(), 30302727272727272727)

    WEI = await didToken.calculateNumWeiToIssue.call(
      web3.toWei(333),
      web3.toWei(454)
    )
    assert.equal(WEI.toString(), 733480176211453744)
  })

  it('should send ether to someone who exchanges DID', async function() {
    //  make sure the contract has ether to return for the DID or this will fail
    await didToken.approve(accounts[0])
    await didToken.issueDID(accounts[0], 10000)
    await didToken.issueDID(accounts[1], 10000)
    await didToken.incrementDIDFromContributions(accounts[1], 10000)
    await didToken.incrementDIDFromContributions(accounts[0], 12000)
    const numContributionsDID = await didToken.getNetNumContributionsDID.call(
      accounts[0]
    )

    const originalBalance = await web3.eth.getBalance(accounts[0])
    await didToken.investEtherForDID({
      from: accounts[1],
      value: web3.toWei(5, 'ether')
    })

    const numDIDToExchange = 100

    let etherBalance = await web3.eth.getBalance(accounts[1])
    await didToken.exchangeDIDForEther(numDIDToExchange)

    etherBalance = await web3.eth.getBalance(accounts[1])
    const didPerEtherParameterValue = await distense.getParameterValueByTitle.call(
      'didPerEther'
    )
    const numWeiThatShouldBeIssued = await didToken.calculateNumWeiToIssue.call(
      web3.toWei(numDIDToExchange),
      didPerEtherParameterValue
    )
    const endingBalance = new BigNumber(
      numWeiThatShouldBeIssued.toString()
    ).add(etherBalance)
    assert.isAbove(endingBalance.toString(), etherBalance.toString())
  })
})
