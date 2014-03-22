var Script = require('./script');
var ECKey = require('./eckey').ECKey;
var convert = require('./convert');
var assert = require('assert');
var BigInteger = require('./jsbn/jsbn');
var Transaction = require('./transaction').Transaction;
var TransactionIn = require('./transaction').TransactionIn;
var TransactionOut = require('./transaction').TransactionOut;
var HDNode = require('./hdwallet.js')
var rng = require('secure-random');

var Wallet = function (seed, options) {
    if (!(this instanceof Wallet)) { return new Wallet(seed, options); }

    var options = options || {}
    var network = options.network || 'mainnet'

    // Stored in a closure to make accidental serialization less likely
    var masterkey = null;
    var me = this;
    var accountZero = null;
    var internalAccount = null;
    var externalAccount = null;

    // Addresses
    this.addresses = [];
    this.changeAddresses = [];

    // Transaction output data
    this.outputs = {};

    // Make a new master key
    this.newMasterKey = function(seed, network) {
        if (!seed) seed= rng(32, { array: true })
        masterkey = new HDNode(seed, network);

        // HD first-level child derivation method should be private
        // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
        accountZero = masterkey.derivePrivate(0)
        externalAccount = accountZero.derive(0)
        internalAccount = accountZero.derive(1)

        me.addresses = [];
        me.changeAddresses = [];

        me.outputs = {};
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

    // Processes a transaction object
    // If "verified" is true, then we trust the transaction as "final"
    this.processTx = function(tx, verified) {
        var txhash = convert.bytesToHex(tx.getHash())
        for (var i = 0; i < tx.outs.length; i++) {
            if (this.addresses.indexOf(tx.outs[i].address.toString()) >= 0) {
                me.outputs[txhash+':'+i] = {
                    output: txhash+':'+i,
                    value: tx.outs[i].value,
                    address: tx.outs[i].address.toString(),
                    timestamp: new Date().getTime() / 1000,
                    pending: true
                }
            }
        }
        for (var i = 0; i < tx.ins.length; i++) {
            var op = tx.ins[i].outpoint
            var o = me.outputs[op.hash+':'+op.index]
            if (o) {
                o.spend = txhash+':'+i
                o.spendpending = true
                o.timestamp = new Date().getTime() / 1000
            }
        }
    }
    // Processes an output from an external source of the form
    // { output: txhash:index, value: integer, address: address }
    // Excellent compatibility with SX and pybitcointools
    this.processOutput = function(o) {
        if (!this.outputs[o.output] || this.outputs[o.output].pending)
             this.outputs[o.output] = o;
    }

    this.processExistingOutputs = function() {
        var t = new Date().getTime() / 1000
        for (var o in this.outputs) {
            if (o.pending && t > o.timestamp + 1200)
                delete this.outputs[o]
            if (o.spendpending && t > o.timestamp + 1200) {
                o.spendpending = false
                o.spend = false
                delete o.timestamp
            }
        }
    }
    var peoInterval = setInterval(this.processExistingOutputs, 10000)

    this.getUtxoToPay = function(value) {
        var h = []
        for (var out in this.outputs) h.push(this.outputs[out])
        var utxo = h.filter(function(x) { return !x.spend });
        var valuecompare = function(a,b) { return a.value > b.value; }
        var high = utxo.filter(function(o) { return o.value >= value; })
                       .sort(valuecompare);
        if (high.length > 0) return [high[0]];
        utxo.sort(valuecompare);
        var totalval = 0;
        for (var i = 0; i < utxo.length; i++) {
            totalval += utxo[i].value;
            if (totalval >= value) return utxo.slice(0,i+1);
        }
        throw ("Not enough money to send funds including transaction fee. Have: "
                     + (totalval / 100000000) + ", needed: " + (value / 100000000));
    }

    this.mkSend = function(to, value, fee) {
        var utxo = this.getUtxoToPay(value + fee)
        var sum = utxo.reduce(function(t,o) { return t + o.value },0),
            remainder = sum - value - fee
        if (value < 5430) throw new Error("Amount below dust threshold!")
        var unspentOuts = 0;
        for (var o in this.outputs) {
            if (!this.outputs[o].spend) unspentOuts += 1
            if (unspentOuts >= 5) return
        }
        var change = this.addresses[this.addresses.length - 1]
        var toOut = { address: to, value: value },
            changeOut = { address: change, value: remainder }
            halfChangeOut = { address: change, value: Math.floor(remainder/2) };

        var outs =
              remainder < 5430  ? [toOut]
            : remainder < 10860 ? [toOut, changeOut]
            : unspentOuts == 5  ? [toOut, changeOut]
            :                     [toOut, halfChangeOut, halfChangeOut]

        var tx = new Bitcoin.Transaction({
            ins: utxo.map(function(x) { return x.output }),
            outs: outs
        })
        this.sign(tx)
        return tx
    }

    this.mkSendToOutputs = function(outputs, changeIndex, fee) {
        var value = outputs.reduce(function(t,o) { return t + o.value },0),
            utxo = this.getUtxoToPay(value + fee),
            sum = utxo.reduce(function(t,p) { return t + o.value },0);
        utxo[changeIndex].value += sum - value - fee;
        var tx = new Bitcoin.Transaction({
            ins: utxo.map(function(x) { return x.output }),
            outs: outputs
        })
        this.sign(tx)
        return tx
    }

    this.sign = function(tx) {
        tx.ins.map(function(inp,i) {
            var inp = inp.outpoint.hash+':'+inp.outpoint.index;
            if (me.outputs[inp]) {
                var address = me.outputs[inp].address
                tx.sign(i, me.getPrivateKeyForAddress(address))
            }
        })
        return tx;
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
      var index;
      if((index = this.addresses.indexOf(address)) > -1) {
        return this.getPrivateKey(index)
      } else if((index = this.changeAddresses.indexOf(address)) > -1) {
        return this.getInternalPrivateKey(index)
      } else {
        throw new Error('Unknown address. Make sure the address is from the keychain and has been generated.')
      }
    }
};

module.exports = Wallet;
