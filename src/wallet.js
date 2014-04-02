var convert = require('./convert')
var Transaction = require('./transaction').Transaction
var HDNode = require('./hdwallet.js')
var rng = require('secure-random')

function Wallet(seed, options) {
  if (!(this instanceof Wallet)) { return new Wallet(seed, options); }

  var options = options || {}
  var network = options.network || 'mainnet'

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
  this.newMasterKey = function(seed, network) {
    if (!seed) seed = rng(32, { array: true });
    masterkey = new HDNode(seed, network)

    // HD first-level child derivation method should be private
    // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
    accountZero = masterkey.derivePrivate(0)
    externalAccount = accountZero.derive(0)
    internalAccount = accountZero.derive(1)

    me.addresses = []
    me.changeAddresses = []

    me.outputs = {}
  }
  this.newMasterKey(seed, network)


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
      if(!output.spend) utxo.push(outputToUnspentOutput(output))
    }

    return utxo
  }

  this.setUnspentOutputs = function(utxo) {
    var outputs = {}

    utxo.forEach(function(uo){
      validateUnspentOutput(uo)
      var o = unspentOutputToOutput(uo)
      outputs[o.receive] = o
    })

    this.outputs = outputs
  }

  this.setUnspentOutputsAsync = function(utxo, callback) {
    var error = null
    try {
      this.setUnspentOutputs(utxo)
    } catch(err) {
      error = err
    } finally {
      process.nextTick(function(){ callback(error) })
    }
  }

  function outputToUnspentOutput(output){
    var hashAndIndex = output.receive.split(":")

    return {
      hash: hashAndIndex[0],
      hashLittleEndian: convert.reverseEndian(hashAndIndex[0]),
      outputIndex: parseInt(hashAndIndex[1]),
      address: output.address,
      value: output.value
    }
  }

  function unspentOutputToOutput(o) {
    var hash = o.hash || convert.reverseEndian(o.hashLittleEndian)
    var key = hash + ":" + o.outputIndex
    return {
      receive: key,
      address: o.address,
      value: o.value
    }
  }

  function validateUnspentOutput(uo) {
    var missingField

    if (isNullOrUndefined(uo.hash) && isNullOrUndefined(uo.hashLittleEndian)) {
      missingField = "hash(or hashLittleEndian)"
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
      message.push("and hash(or hashLittleEndian)")
      throw new Error(message.join(' '))
    }
  }

  function isNullOrUndefined(value) {
    return value == undefined
  }

  this.processTx = function(tx) {
    var txhash = convert.bytesToHex(tx.getHash())

    tx.outs.forEach(function(txOut, i){
      var address = txOut.address.toString()
      if (isMyAddress(address)) {
        var output = txhash+':'+i
        me.outputs[output] = {
          receive: output,
          value: txOut.value,
          address: address,
        }
      }
    })

    tx.ins.forEach(function(txIn, i){
      var op = txIn.outpoint
      var o = me.outputs[op.hash+':'+op.index]
      if (o) {
        o.spend = txhash+':'+i
      }
    })
  }

  this.createTx = function(to, value, fixedFee) {
    checkDust(value)

    var tx = new Transaction()
    tx.addOutput(to, value)

    var utxo = getCandidateOutputs(value)
    var totalInValue = 0
    for(var i=0; i<utxo.length; i++){
      var output = utxo[i]
      tx.addInput(output.receive)

      totalInValue += output.value
      if(totalInValue < value) continue

      var fee = fixedFee == undefined ? estimateFeePadChangeOutput(tx) : fixedFee
      if(totalInValue < value + fee) continue

      var change = totalInValue - value - fee
      if(change > 0 && !isDust(change)) {
        tx.addOutput(getChangeAddress(), change)
      }
      break
    }

    checkInsufficientFund(totalInValue, value, fee)

    this.sign(tx)

    return tx
  }

  this.createTxAsync = function(to, value, fixedFee, callback){
    if(fixedFee instanceof Function) {
      callback = fixedFee
      fixedFee = undefined
    }
    var tx = null
    var error = null

    try {
      tx = this.createTx(to, value, fixedFee)
    } catch(err) {
      error = err
    } finally {
      process.nextTick(function(){ callback(error, tx) })
    }
  }

  this.dustThreshold = 5430
  function isDust(amount) {
    return amount <= me.dustThreshold
  }

  function checkDust(value){
    if (isNullOrUndefined(value) || isDust(value)) {
      throw new Error("Value must be above dust threshold")
    }
  }

  function getCandidateOutputs(value){
    var unspent = []
    for (var key in me.outputs){
      var output = me.outputs[key]
      if(!output.spend) unspent.push(output)
    }

    var sortByValueDesc = unspent.sort(function(o1, o2){
      return o2.value - o1.value
    })

    return sortByValueDesc
  }

  function estimateFeePadChangeOutput(tx){
    var tmpTx = tx.clone()
    tmpTx.addOutput(getChangeAddress(), 0)
    return tmpTx.estimateFee()
  }

  function getChangeAddress() {
    if(me.changeAddresses.length === 0) me.generateChangeAddress();
    return me.changeAddresses[me.changeAddresses.length - 1]
  }

  function checkInsufficientFund(totalInValue, value, fee) {
    if(totalInValue < value + fee) {
      throw new Error('Not enough money to send funds including transaction fee. Have: ' +
                      totalInValue + ', needed: ' + (value + fee))
    }
  }

  this.sign = function(tx) {
    tx.ins.forEach(function(inp,i) {
      var output = me.outputs[inp.outpoint.hash + ':' + inp.outpoint.index]
      if (output) {
        tx.sign(i, me.getPrivateKeyForAddress(output.address))
      }
    })
    return tx
  }

  this.getMasterKey = function() { return masterkey }
  this.getAccountZero = function() { return accountZero }
  this.getInternalAccount = function() { return internalAccount }
  this.getExternalAccount = function() { return externalAccount }

  this.getPrivateKey = function(index) {
    return externalAccount.derive(index).priv
  }

  this.getInternalPrivateKey = function(index) {
    return internalAccount.derive(index).priv
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
