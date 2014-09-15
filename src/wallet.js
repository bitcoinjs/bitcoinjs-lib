var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('crypto')
var enforceType = require('./types')
var networks = require('./networks')

var Address = require('./address')
var HDNode = require('./hdnode')
var TransactionBuilder = require('./transaction_builder')
var Script = require('./script')

function estimatePaddedFee(tx, network) {
  var tmpTx = tx.clone()
  tmpTx.addOutput(Script.EMPTY, network.dustSoftThreshold || 0)

  return network.estimateFee(tmpTx)
}

function Wallet(seed, network) {
  seed = seed || crypto.randomBytes(32)
  network = network || networks.bitcoin

  // Stored in a closure to make accidental serialization less likely
  var masterKey = HDNode.fromSeedBuffer(seed, network)

  // HD first-level child derivation method should be hardened
  // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
  var accountZero = masterKey.deriveHardened(0)
  var externalAccount = accountZero.derive(0)
  var internalAccount = accountZero.derive(1)

  this.addresses = []
  this.changeAddresses = []
  this.network = network
  this.unspents = []

  this.getMasterKey = function() { return masterKey }
  this.getAccountZero = function() { return accountZero }
  this.getExternalAccount = function() { return externalAccount }
  this.getInternalAccount = function() { return internalAccount }
}

Wallet.prototype.createTransaction = function(to, value, options) {
  options = options || {}

  assert(value > this.network.dustThreshold, value + ' must be above dust threshold (' + this.network.dustThreshold + ' Satoshis)')

  var changeAddress = options.changeAddress
  var fixedFee = options.fixedFee
  var minConf = options.minConf === undefined ? 1 : options.minConf

  // filter by minConf and sort by descending value
  var unspents = this.unspents.filter(function(unspent) {
    return unspent.confirmations >= minConf
  }).sort(function(o1, o2) {
    return o2.value - o1.value
  })

  var accum = 0
  var addresses = []
  var subTotal = value

  var txb = new TransactionBuilder()
  txb.addOutput(to, value)

  for (var i = 0; i < unspents.length; ++i) {
    var unspent = unspents[i]
    addresses.push(unspent.address)

    txb.addInput(unspent.txHash, unspent.index)

    var fee = fixedFee === undefined ? estimatePaddedFee(txb.buildIncomplete(), this.network) : fixedFee

    accum += unspent.value
    subTotal = value + fee

    if (accum >= subTotal) {
      var change = accum - subTotal

      if (change > this.network.dustThreshold) {
        txb.addOutput(changeAddress || this.getChangeAddress(), change)
      }

      break
    }
  }

  assert(accum >= subTotal, 'Not enough funds (incl. fee): ' + accum + ' < ' + subTotal)

  return this.signWith(txb, addresses).build()
}

Wallet.prototype.generateAddress = function() {
  var k = this.addresses.length
  var address = this.getExternalAccount().derive(k).getAddress()

  this.addresses.push(address.toString())

  return this.getAddress()
}

Wallet.prototype.generateChangeAddress = function() {
  var k = this.changeAddresses.length
  var address = this.getInternalAccount().derive(k).getAddress()

  this.changeAddresses.push(address.toString())

  return this.getChangeAddress()
}

Wallet.prototype.getAddress = function() {
  if (this.addresses.length === 0) {
    this.generateAddress()
  }

  return this.addresses[this.addresses.length - 1]
}

Wallet.prototype.getBalance = function(minConf) {
  minConf = minConf || 0

  return this.unspents.filter(function(unspent) {
    return unspent.confirmations >= minConf

  }).reduce(function(accum, unspent) {
    return accum + unspent.value
  }, 0)
}

Wallet.prototype.getChangeAddress = function() {
  if (this.changeAddresses.length === 0) {
    this.generateChangeAddress()
  }

  return this.changeAddresses[this.changeAddresses.length - 1]
}

Wallet.prototype.getInternalPrivateKey = function(index) {
  return this.getInternalAccount().derive(index).privKey
}

Wallet.prototype.getPrivateKey = function(index) {
  return this.getExternalAccount().derive(index).privKey
}

Wallet.prototype.getPrivateKeyForAddress = function(address) {
  var index

  if ((index = this.addresses.indexOf(address)) > -1) {
    return this.getPrivateKey(index)
  }

  if ((index = this.changeAddresses.indexOf(address)) > -1) {
    return this.getInternalPrivateKey(index)
  }

  assert(false, 'Unknown address. Make sure the address is from the keychain and has been generated')
}

Wallet.prototype.getUnspentOutputs = function(minConf) {
  minConf = minConf || 0

  return this.unspents.filter(function(unspent) {
    return unspent.confirmations >= minConf

  }).map(function(unspent) {
    return {
      address: unspent.address,
      confirmations: unspent.confirmations,
      index: unspent.index,
      txId: unspent.txId,
      value: unspent.value
    }
  })
}

Wallet.prototype.setUnspentOutputs = function(unspents) {
  this.unspents = unspents.map(function(unspent) {
    var txId = unspent.txId
    var index = unspent.index

    enforceType('String', txId)
    enforceType('Number', index)
    enforceType('Number', unspent.value)
    enforceType('Number', unspent.confirmations)

    // sanity checking
    assert.equal(txId.length, 64, 'Expected valid txId, got ' + txId)
    assert.doesNotThrow(function() { Address.fromBase58Check(unspent.address) }, 'Expected Base58 Address, got ' + unspent.address)
    assert(isFinite(index), 'Expected number index, got ' + index)

    var txHash = bufferutils.reverse(new Buffer(txId, 'hex'))

    unspent = {
      address: unspent.address,
      confirmations: unspent.confirmations || 0,
      index: index,
      txHash: txHash,
      txId: txId,
      value: unspent.value
    }

    return unspent
  }, this)
}

Wallet.prototype.signWith = function(tx, addresses) {
  addresses.forEach(function(address, i) {
    var privKey = this.getPrivateKeyForAddress(address)

    tx.sign(i, privKey)
  }, this)

  return tx
}

module.exports = Wallet
