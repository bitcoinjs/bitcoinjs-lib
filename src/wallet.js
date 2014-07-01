var assert = require('assert')
var networks = require('./networks')
var rng = require('secure-random')

var Address = require('./address')
var HDNode = require('./hdnode')
var Transaction = require('./transaction')

function Wallet(seed, network) {
  network = network || networks.bitcoin

  // Stored in a closure to make accidental serialization less likely
  var masterkey = null
  var me = this
  var accountZero = null
  var internalAccount = null
  var externalAccount = null

  // Addresses
  this.addresses = []
  this.changeAddresses = []

  // Transaction output data
  this.outputs = {}

  // Make a new master key
  this.newMasterKey = function(seed) {
    seed = seed || new Buffer(rng(32))
    masterkey = HDNode.fromSeedBuffer(seed, network)

    // HD first-level child derivation method should be hardened
    // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
    accountZero = masterkey.deriveHardened(0)
    externalAccount = accountZero.derive(0)
    internalAccount = accountZero.derive(1)

    me.addresses = []
    me.changeAddresses = []

    me.outputs = {}
  }

  this.newMasterKey(seed)

  this.generateAddress = function() {
    var key = externalAccount.derive(this.addresses.length)
    this.addresses.push(key.getAddress().toString())
    return this.addresses[this.addresses.length - 1]
  }

  this.generateChangeAddress = function() {
    var key = internalAccount.derive(this.changeAddresses.length)
    this.changeAddresses.push(key.getAddress().toString())
    return this.changeAddresses[this.changeAddresses.length - 1]
  }

  this.getBalance = function() {
    return this.getUnspentOutputs().reduce(function(memo, output){
      return memo + output.value
    }, 0)
  }

  this.getUnspentOutputs = function() {
    var utxo = []

    for(var key in this.outputs){
      var output = this.outputs[key]
      if(!output.to) utxo.push(outputToUnspentOutput(output))
    }

    return utxo
  }

  this.setUnspentOutputs = function(utxo) {
    var outputs = {}

    utxo.forEach(function(uo){
      validateUnspentOutput(uo)
      var o = unspentOutputToOutput(uo)
      outputs[o.from] = o
    })

    this.outputs = outputs
  }

  function outputToUnspentOutput(output){
    var hashAndIndex = output.from.split(":")

    return {
      hash: hashAndIndex[0],
      outputIndex: parseInt(hashAndIndex[1]),
      address: output.address,
      value: output.value,
      pending: output.pending
    }
  }

  function unspentOutputToOutput(o) {
    var hash = o.hash
    var key = hash + ":" + o.outputIndex
    return {
      from: key,
      address: o.address,
      value: o.value,
      pending: o.pending
    }
  }

  function validateUnspentOutput(uo) {
    var missingField

    if (isNullOrUndefined(uo.hash)) {
      missingField = "hash"
    }

    var requiredKeys = ['outputIndex', 'address', 'value']
    requiredKeys.forEach(function (key) {
      if (isNullOrUndefined(uo[key])){
        missingField = key
      }
    })

    if (missingField) {
      var message = [
        'Invalid unspent output: key', missingField, 'is missing.',
        'A valid unspent output must contain'
      ]
      message.push(requiredKeys.join(', '))
      message.push("and hash")
      throw new Error(message.join(' '))
    }
  }

  function isNullOrUndefined(value) {
    return value == undefined
  }

  this.processPendingTx = function(tx){
    processTx(tx, true)
  }

  this.processConfirmedTx = function(tx){
    processTx(tx, false)
  }

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

  this.createTx = function(to, value, fixedFee, changeAddress) {
    assert(value > network.dustThreshold, value + ' must be above dust threshold (' + network.dustThreshold + ' Satoshis)')

    var utxos = getCandidateOutputs(value)
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

      var fee = fixedFee == undefined ? estimateFeePadChangeOutput(tx) : fixedFee

      accum += utxo.value
      subTotal = value + fee
      if (accum >= subTotal) {
        var change = accum - subTotal

        if (change > network.dustThreshold) {
          tx.addOutput(changeAddress || getChangeAddress(), change)
        }

        break
      }
    }

    assert(accum >= subTotal, 'Not enough funds (incl. fee): ' + accum + ' < ' + subTotal)

    this.signWith(tx, addresses)
    return tx
  }

  function getCandidateOutputs() {
    var unspent = []

    for (var key in me.outputs) {
      var output = me.outputs[key]
      if (!output.pending) unspent.push(output)
    }

    var sortByValueDesc = unspent.sort(function(o1, o2){
      return o2.value - o1.value
    })

    return sortByValueDesc
  }

  function estimateFeePadChangeOutput(tx) {
    var tmpTx = tx.clone()
    tmpTx.addOutput(getChangeAddress(), network.dustSoftThreshold || 0)

    return network.estimateFee(tmpTx)
  }

  function getChangeAddress() {
    if(me.changeAddresses.length === 0) me.generateChangeAddress();
    return me.changeAddresses[me.changeAddresses.length - 1]
  }

  this.signWith = function(tx, addresses) {
    assert.equal(tx.ins.length, addresses.length, 'Number of addresses must match number of transaction inputs')

    addresses.forEach(function(address, i) {
      var key = me.getPrivateKeyForAddress(address)

      tx.sign(i, key)
    })

    return tx
  }

  this.getMasterKey = function() { return masterkey }
  this.getAccountZero = function() { return accountZero }
  this.getInternalAccount = function() { return internalAccount }
  this.getExternalAccount = function() { return externalAccount }

  this.getPrivateKey = function(index) {
    return externalAccount.derive(index).privKey
  }

  this.getInternalPrivateKey = function(index) {
    return internalAccount.derive(index).privKey
  }

  this.getPrivateKeyForAddress = function(address) {
    var index
    if((index = this.addresses.indexOf(address)) > -1) {
      return this.getPrivateKey(index)
    } else if((index = this.changeAddresses.indexOf(address)) > -1) {
      return this.getInternalPrivateKey(index)
    } else {
      throw new Error('Unknown address. Make sure the address is from the keychain and has been generated.')
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

module.exports = Wallet
