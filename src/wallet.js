var assert = require('assert')
var crypto = require('crypto')
var networks = require('./networks')

var Address = require('./address')
var HDNode = require('./hdnode')
var Transaction = require('./transaction')
var Script = require('./script')

function Wallet(seed, network, unspents) {
  seed = seed || crypto.randomBytes(32)
  network = network || networks.bitcoin

  // Stored in a closure to make accidental serialization less likely
  var masterKey = HDNode.fromSeedBuffer(seed, network)
  var me = this

  // HD first-level child derivation method should be hardened
  // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
  var accountZero = masterKey.deriveHardened(0)
  var externalAccount = accountZero.derive(0)
  var internalAccount = accountZero.derive(1)

  // Addresses
  this.addresses = []
  this.changeAddresses = []

  this.network = network

  // Transaction output data
  this.outputs = unspents ? processUnspentOutputs(unspents) : {}

  // FIXME: remove in 2.x.y
  this.newMasterKey = function(seed) {
    console.warn('newMasterKey is deprecated, please make a new Wallet instance instead')

    seed = seed || crypto.randomBytes(32)
    masterKey = HDNode.fromSeedBuffer(seed, network)

    // HD first-level child derivation method should be hardened
    // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
    accountZero = masterKey.deriveHardened(0)
    externalAccount = accountZero.derive(0)
    internalAccount = accountZero.derive(1)

    me.addresses = []
    me.changeAddresses = []

    me.outputs = {}
  }

  this.processPendingTx = function(tx){
    processTx(tx, true)
  }

  this.processConfirmedTx = function(tx){
    processTx(tx, false)
  }

  var me = this

  function processTx(tx, isPending) {
    var txid = tx.getId()

    tx.outs.forEach(function(txOut, i) {
      var address

      try {
        address = Address.fromOutputScript(txOut.script, network).toString()
      } catch(e) {
        if (!(e.message.match(/has no matching Address/))) throw e
      }

      if (isMyAddress(address)) {
        var output = txid + ':' + i

        me.outputs[output] = {
          from: output,
          value: txOut.value,
          address: address,
          pending: isPending
        }
      }
    })

    tx.ins.forEach(function(txIn, i) {
      // copy and convert to big-endian hex
      var txinId = new Buffer(txIn.hash)
      Array.prototype.reverse.call(txinId)
      txinId = txinId.toString('hex')

      var output = txinId + ':' + txIn.index

      if (!(output in me.outputs)) return

      if (isPending) {
        me.outputs[output].to = txid + ':' + i
        me.outputs[output].pending = true
      } else {
        delete me.outputs[output]
      }
    })
  }

  this.getMasterKey = function() { return masterKey }
  this.getAccountZero = function() { return accountZero }
  this.getExternalAccount = function() { return externalAccount }
  this.getInternalAccount = function() { return internalAccount }

  this.getPrivateKeyForAddress = function(address) {
    assert(isMyAddress(address), 'Unknown address. Make sure the address is from the keychain and has been generated')

    if (isReceiveAddress(address)) {
      var index = this.addresses.indexOf(address)

      return this.getPrivateKey(index)
    }

    if (isChangeAddress(address)) {
      var index = this.changeAddresses.indexOf(address)

      return this.getInternalPrivateKey(index)
    }
  }

  function isReceiveAddress(address){
    return me.addresses.indexOf(address) > -1
  }

  function isChangeAddress(address){
    return me.changeAddresses.indexOf(address) > -1
  }

  function isMyAddress(address) {
    return isReceiveAddress(address) || isChangeAddress(address)
  }
}

Wallet.prototype.createTx = function(to, value, fixedFee, changeAddress) {
  assert(value > this.network.dustThreshold, value + ' must be above dust threshold (' + this.network.dustThreshold + ' Satoshis)')

  var utxos = getCandidateOutputs(this.outputs, value)
  var accum = 0
  var subTotal = value
  var addresses = []

  var tx = new Transaction()
  tx.addOutput(to, value)

  for (var i = 0; i < utxos.length; ++i) {
    var utxo = utxos[i]
    addresses.push(utxo.address)

    var outpoint = utxo.from.split(':')
    tx.addInput(outpoint[0], parseInt(outpoint[1]))

    var fee = fixedFee == undefined ? estimatePaddedFee(tx, this.network) : fixedFee

    accum += utxo.value
    subTotal = value + fee
    if (accum >= subTotal) {
      var change = accum - subTotal

      if (change > this.network.dustThreshold) {
        tx.addOutput(changeAddress || this.getChangeAddress(), change)
      }

      break
    }
  }

  assert(accum >= subTotal, 'Not enough funds (incl. fee): ' + accum + ' < ' + subTotal)

  this.signWith(tx, addresses)
  return tx
}

Wallet.prototype.generateAddress = function() {
  var k = this.addresses.length
  var address = this.getExternalAccount().derive(k).getAddress()

  this.addresses.push(address.toString())

  return this.getReceiveAddress()
}

Wallet.prototype.generateChangeAddress = function() {
  var k = this.changeAddresses.length
  var address = this.getInternalAccount().derive(k).getAddress()

  this.changeAddresses.push(address.toString())

  return this.getChangeAddress()
}

Wallet.prototype.getBalance = function() {
  return this.getUnspentOutputs().reduce(function(accum, output) {
    return accum + output.value
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

Wallet.prototype.getReceiveAddress = function() {
  if (this.addresses.length === 0) {
    this.generateAddress()
  }

  return this.addresses[this.addresses.length - 1]
}

Wallet.prototype.getUnspentOutputs = function() {
  var utxo = []

  for(var key in this.outputs){
    var output = this.outputs[key]
    if(!output.to) utxo.push(outputToUnspentOutput(output))
  }

  return utxo
}

Wallet.prototype.setUnspentOutputs = function(utxo) {
  console.warn('setUnspentOutputs is deprecated, please use the constructor option instead')

  this.outputs = processUnspentOutputs(utxo)
}

Wallet.prototype.signWith = function(tx, addresses) {
  assert.equal(tx.ins.length, addresses.length, 'Number of addresses must match number of transaction inputs')

  addresses.forEach(function(address, i) {
    var key = this.getPrivateKeyForAddress(address)

    tx.sign(i, key)
  }, this)

  return tx
}

function outputToUnspentOutput(output){
  var hashAndIndex = output.from.split(":")

  return {
    hash: hashAndIndex[0],
    index: parseInt(hashAndIndex[1]),
    address: output.address,
    value: output.value,
    pending: output.pending
  }
}

function estimatePaddedFee(tx, network) {
  var tmpTx = tx.clone()
  tmpTx.addOutput(Script.EMPTY, network.dustSoftThreshold || 0)

  return network.estimateFee(tmpTx)
}

function processUnspentOutputs(utxos) {
  var outputs = {}

  utxos.forEach(function(utxo){
    var hash = new Buffer(utxo.hash, 'hex')
    var index = utxo.index
    var address = utxo.address
    var value = utxo.value

    // FIXME: remove alternative in 2.x.y
    if (index === undefined) index = utxo.outputIndex

    assert.equal(hash.length, 32, 'Expected hash length of 32, got ' + hash.length)
    assert.equal(typeof index, 'number', 'Expected number index, got ' + index)
    assert.doesNotThrow(function() { Address.fromBase58Check(address) }, 'Expected Base58 Address, got ' + address)
    assert.equal(typeof value, 'number', 'Expected number value, got ' + value)

    var key = utxo.hash + ':' + utxo.index

    outputs[key] = {
      from: key,
      address: address,
      value: value,
      pending: utxo.pending
    }
  })

  return outputs
}

function getCandidateOutputs(outputs/*, value*/) {
  var unspent = []

  for (var key in outputs) {
    var output = outputs[key]
    if (!output.pending) unspent.push(output)
  }

  var sortByValueDesc = unspent.sort(function(o1, o2){
    return o2.value - o1.value
  })

  return sortByValueDesc
}

module.exports = Wallet
