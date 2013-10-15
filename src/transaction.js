var BigInteger = require('./jsbn/jsbn');
var Script = require('./script');
var util = require('./util');
var conv = require('./convert');
var Crypto = require('./crypto-js/crypto');
var Wallet = require('./wallet');
var ECKey = require('./eckey');
var ECDSA = require('./ecdsa');
var Address = require('./address');

var Transaction = function (doc) {
  this.version = 1;
  this.lock_time = 0;
  this.ins = [];
  this.outs = [];
  this.timestamp = null;
  this.block = null;

  if (doc) {
    if (doc.hash) this.hash = doc.hash;
    if (doc.version) this.version = doc.version;
    if (doc.lock_time) this.lock_time = doc.lock_time;
    if (doc.ins && doc.ins.length) {
      for (var i = 0; i < doc.ins.length; i++) {
        this.addInput(new TransactionIn(doc.ins[i]));
      }
    }
    if (doc.outs && doc.outs.length) {
      for (var i = 0; i < doc.outs.length; i++) {
        this.addOutput(new TransactionOut(doc.outs[i]));
      }
    }
    if (doc.timestamp) this.timestamp = doc.timestamp;
    if (doc.block) this.block = doc.block;
  }
};

/**
 * Turn transaction data into Transaction objects.
 *
 * Takes an array of plain JavaScript objects containing transaction data and
 * returns an array of Transaction objects.
 */
Transaction.objectify = function (txs) {
  var objs = [];
  for (var i = 0; i < txs.length; i++) {
    objs.push(new Transaction(txs[i]));
  }
  return objs;
};

/**
 * Create a new txin.
 *
 * Can be called with an existing TransactionIn object to add it to the
 * transaction. Or it can be called with a Transaction object and an integer
 * output index, in which case a new TransactionIn object pointing to the
 * referenced output will be created.
 *
 * Note that this method does not sign the created input.
 */
Transaction.prototype.addInput = function (tx, outIndex) {
  if (arguments[0] instanceof TransactionIn) {
    this.ins.push(arguments[0]);
  } else {
    this.ins.push(new TransactionIn({
      outpoint: {
        hash: tx.hash,
        index: outIndex
      },
      script: new Script(),
      sequence: 4294967295
    }));
  }
};

/**
 * Create a new txout.
 *
 * Can be called with an existing TransactionOut object to add it to the
 * transaction. Or it can be called with an Address object and a BigInteger
 * for the amount, in which case a new TransactionOut object with those
 * values will be created.
 */
Transaction.prototype.addOutput = function (address, value) {
    if (arguments[0] instanceof TransactionOut) {
       this.outs.push(arguments[0]);
    } 
    else {
        this.outs.push(new TransactionOut({
            value: value,
            script: Script.createOutputScript(address)
        }));
    }
};

// TODO(shtylman) crypto sha uses this also
// Convert a byte array to big-endian 32-bit words
var bytesToWords = function (bytes) {
	for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
		words[b >>> 5] |= bytes[i] << (24 - b % 32);
	return words;
};

	// Convert big-endian 32-bit words to a byte array
var wordsToBytes = function (words) {
	for (var bytes = [], b = 0; b < words.length * 32; b += 8)
		bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
	return bytes;
};

/**
 * Serialize this transaction.
 *
 * Returns the transaction as a byte array in the standard Bitcoin binary
 * format. This method is byte-perfect, i.e. the resulting byte array can
 * be hashed to get the transaction's standard Bitcoin hash.
 */
Transaction.prototype.serialize = function ()
{
  var buffer = [];
  buffer = buffer.concat(util.numToBytes(parseInt(this.version),4));
  buffer = buffer.concat(util.numToVarInt(this.ins.length));
  for (var i = 0; i < this.ins.length; i++) {
    var txin = this.ins[i];

    // Why do blockchain.info, blockexplorer.com, sx and just about everybody
    // else use little-endian hashes? No idea...
    buffer = buffer.concat(conv.hexToBytes(txin.outpoint.hash).reverse());

    buffer = buffer.concat(util.numToBytes(parseInt(txin.outpoint.index),4));
    var scriptBytes = txin.script.buffer;
    buffer = buffer.concat(util.numToVarInt(scriptBytes.length));
    buffer = buffer.concat(scriptBytes);
    buffer = buffer.concat(util.numToBytes(parseInt(txin.sequence),4));
  }
  buffer = buffer.concat(util.numToVarInt(this.outs.length));
  for (var i = 0; i < this.outs.length; i++) {
    var txout = this.outs[i];
    buffer = buffer.concat(util.numToBytes(txout.value,8));
    var scriptBytes = txout.script.buffer;
    buffer = buffer.concat(util.numToVarInt(scriptBytes.length));
    buffer = buffer.concat(scriptBytes);
  }
  buffer = buffer.concat(util.numToBytes(parseInt(this.lock_time),4));

  return buffer;
};

var OP_CODESEPARATOR = 171;

var SIGHASH_ALL = 1;
var SIGHASH_NONE = 2;
var SIGHASH_SINGLE = 3;
var SIGHASH_ANYONECANPAY = 80;

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input. This
 * method copies the transaction, makes the necessary changes based on the
 * hashType, serializes and finally hashes the result. This hash can then be
 * used to sign the transaction input in question.
 */
Transaction.prototype.hashTransactionForSignature =
function (connectedScript, inIndex, hashType)
{
  var txTmp = this.clone();

  // In case concatenating two scripts ends up with two codeseparators,
  // or an extra one at the end, this prevents all those possible
  // incompatibilities.
  /*scriptCode = scriptCode.filter(function (val) {
   return val !== OP_CODESEPARATOR;
   });*/

  // Blank out other inputs' signatures
  for (var i = 0; i < txTmp.ins.length; i++) {
    txTmp.ins[i].script = new Script();
  }

  txTmp.ins[inIndex].script = connectedScript;

  // Blank out some of the outputs
  if ((hashType & 0x1f) == SIGHASH_NONE) {
    txTmp.outs = [];

    // Let the others update at will
    for (var i = 0; i < txTmp.ins.length; i++)
      if (i != inIndex)
        txTmp.ins[i].sequence = 0;
  } else if ((hashType & 0x1f) == SIGHASH_SINGLE) {
    // TODO: Implement
  }

  // Blank out other inputs completely, not recommended for open transactions
  if (hashType & SIGHASH_ANYONECANPAY) {
    txTmp.ins = [txTmp.ins[inIndex]];
  }

  var buffer = txTmp.serialize();

  buffer = buffer.concat(util.numToBytes(parseInt(hashType),4));

  var hash1 = Crypto.SHA256(buffer, {asBytes: true});

  return Crypto.SHA256(hash1, {asBytes: true});
};

/**
 * Calculate and return the transaction's hash.
 * Reverses hash since blockchain.info, blockexplorer.com and others
 * use little-endian hashes for some stupid reason
 */
Transaction.prototype.getHash = function ()
{
  var buffer = this.serialize();
  return Crypto.SHA256(Crypto.SHA256(buffer, {asBytes: true}), {asBytes: true}).reverse();
};

/**
 * Create a copy of this transaction object.
 */
Transaction.prototype.clone = function ()
{
  var newTx = new Transaction();
  newTx.version = this.version;
  newTx.lock_time = this.lock_time;
  for (var i = 0; i < this.ins.length; i++) {
    var txin = this.ins[i].clone();
    newTx.addInput(txin);
  }
  for (var i = 0; i < this.outs.length; i++) {
    var txout = this.outs[i].clone();
    newTx.addOutput(txout);
  }
  return newTx;
};

/**
 * Analyze how this transaction affects a wallet.
 *
 * Returns an object with properties 'impact', 'type' and 'addr'.
 *
 * 'impact' is an object, see Transaction#calcImpact.
 * 
 * 'type' can be one of the following:
 * 
 * recv:
 *   This is an incoming transaction, the wallet received money.
 *   'addr' contains the first address in the wallet that receives money
 *   from this transaction.
 *
 * self:
 *   This is an internal transaction, money was sent within the wallet.
 *   'addr' is undefined.
 *
 * sent:
 *   This is an outgoing transaction, money was sent out from the wallet.
 *   'addr' contains the first external address, i.e. the recipient.
 *
 * other:
 *   This method was unable to detect what the transaction does. Either it
 */
Transaction.prototype.analyze = function (wallet) {
  if (!(wallet instanceof Wallet)) return null;

  var allFromMe = true,
  allToMe = true,
  firstRecvHash = null,
  firstMeRecvHash = null,
  firstSendHash = null;

  for (var i = this.outs.length-1; i >= 0; i--) {
    var txout = this.outs[i];
    var hash = txout.script.simpleOutPubKeyHash();
    if (!wallet.hasHash(hash)) {
      allToMe = false;
    } else {
      firstMeRecvHash = hash;
    }
    firstRecvHash = hash;
  }
  for (var i = this.ins.length-1; i >= 0; i--) {
    var txin = this.ins[i];
    firstSendHash = txin.script.simpleInPubKeyHash();
    if (!wallet.hasHash(firstSendHash)) {
      allFromMe = false;
      break;
    }
  }

  var impact = this.calcImpact(wallet);

  var analysis = {};

  analysis.impact = impact;

  if (impact.sign > 0 && impact.value > 0) {
    analysis.type = 'recv';
    analysis.addr = new Address(firstMeRecvHash);
  } else if (allFromMe && allToMe) {
    analysis.type = 'self';
  } else if (allFromMe) {
    analysis.type = 'sent';
    // TODO: Right now, firstRecvHash is the first output, which - if the
    //       transaction was not generated by this library could be the
    //       change address.
    analysis.addr = new Address(firstRecvHash);
  } else  {
    analysis.type = "other";
  }

  return analysis;
};

/**
 * Get a human-readable version of the data returned by Transaction#analyze.
 *
 * This is merely a convenience function. Clients should consider implementing
 * this themselves based on their UI, I18N, etc.
 */
Transaction.prototype.getDescription = function (wallet) {
  var analysis = this.analyze(wallet);

  if (!analysis) return "";

  switch (analysis.type) {
  case 'recv':
    return "Received with "+analysis.addr;
    break;

  case 'sent':
    return "Payment to "+analysis.addr;
    break;

  case 'self':
    return "Payment to yourself";
    break;

  case 'other':
  default:
    return "";
  }
};

/**
 * Get the total amount of a transaction's outputs.
 */
Transaction.prototype.getTotalOutValue = function () {
  return this.outs.reduce(function(t,o) { return t + o.value },0);
};

 /**
  * Old name for Transaction#getTotalOutValue.
  *
  * @deprecated
  */
 Transaction.prototype.getTotalValue = Transaction.prototype.getTotalOutValue;

/**
 * Calculates the impact a transaction has on this wallet.
 *
 * Based on the its public keys, the wallet will calculate the
 * credit or debit of this transaction.
 *
 * It will return an object with two properties:
 *  - sign: 1 or -1 depending on sign of the calculated impact.
 *  - value: amount of calculated impact
 *
 * @returns Object Impact on wallet
 */
Transaction.prototype.calcImpact = function (wallet) {
  if (!(wallet instanceof Wallet)) return 0;

  // Calculate credit to us from all outputs
  var valueOut = this.outs.filter(function(o) {
    return wallet.hasHash(conv.bytesToHex(o.script.simpleOutPubKeyHash()));
  })
  .reduce(function(t,o) { return t+o.value },0);

  var valueIn = this.ins.filter(function(i) {
    return wallet.hasHash(conv.bytesToHex(i.script.simpleInPubKeyHash()))
        && wallet.txIndex[i.outpoint.hash];
  })
  .reduce(function(t,i) {
    return t + wallet.txIndex[i.outpoint.hash].outs[i.outpoint.index].value
  },0);

  if (valueOut > valueIn) {
    return {
      sign: 1,
      value: valueOut - valueIn
    };
  } else {
    return {
      sign: -1,
      value: valueIn - valueOut
    };
  }
};

/**
 * Converts a serialized transaction into a transaction object
 */

Transaction.deserialize = function(buffer) {
    var pos = 0;
    var readAsInt = function(bytes) {
        if (bytes == 0) return 0;
        pos++;
        return buffer[pos-1] + readAsInt(bytes-1) * 256;
    }
    var readVarInt = function() {
        pos++;
        if (buffer[pos-1] < 253) {
            return buffer[pos-1];
        }
        return readAsInt(buffer[pos-1] - 251);
    }
    var readBytes = function(bytes) {
        pos += bytes;
        return buffer.slice(pos - bytes, pos);
    }
    var readVarString = function() {
        var size = readVarInt();
        return readBytes(size);
    }
    var obj = {
        ins: [],
        outs: []
    }
    obj.version = readAsInt(4);
    var ins = readVarInt();
    for (var i = 0; i < ins; i++) {
        obj.ins.push({
            outpoint: {
                hash: conv.bytesToHex(readBytes(32).reverse()),
                index: readAsInt(4)
            },
            script: new Script(readVarString()),
            sequence: readAsInt(4)
        });
    }
    var outs = readVarInt();
    for (var i = 0; i < outs; i++) {
        obj.outs.push({
            value: util.bytesToNum(readBytes(8)),
            script: new Script(readVarString())
        });
    }
    obj.locktime = readAsInt(4);
    return new Transaction(obj);
}

/**
 * Signs a standard output at some index with the given key
 */

Transaction.prototype.sign = function(index, key, type) {
    type = type || SIGHASH_ALL;
    key = new ECKey(key);
    var pub = key.getPub(),
        hash160 = util.sha256ripe160(pub),
        script = Script.createOutputScript(new Address(hash160)),
        hash = this.hashTransactionForSignature( script, index, type),
        sig = key.sign(hash).concat([type]);
    this.ins[index].script = Script.createInputScript(sig,pub);
}

/**
 * Signs a P2SH output at some index with the given key
 */

Transaction.prototype.p2shsign = function(index, script, key, type) {
    script = new Script(script);
    key = new ECKey(key);
    type = type || SIGHASH_ALL;
    var hash = this.hashTransactionForSignature(script, index, type),
        sig = key.sign(hash).concat([type]);
    return sig;
}

Transaction.prototype.multisign = Transaction.prototype.p2shsign;

Transaction.prototype.validateSig = function(index,script,sig,pub) {
    script = new Script(script);
    var hash = this.hashTransactionForSignature(script,index,1);
    return ECDSA.verify(hash, conv.coerceToBytes(sig),
                                      conv.coerceToBytes(pub));
}


var TransactionIn = function (data)
{
  this.outpoint = data.outpoint;
  if (data.script instanceof Script) {
    this.script = data.script;
  } else {
    if (data.scriptSig) {
      this.script = Script.fromScriptSig(data.scriptSig);
    }
    else {
      this.script = new Script(data.script);
    }
  }
  this.sequence = data.sequence;
};

TransactionIn.prototype.clone = function ()
{
  var newTxin = new TransactionIn({
    outpoint: {
      hash: this.outpoint.hash,
      index: this.outpoint.index
    },
    script: this.script.clone(),
    sequence: this.sequence
  });
  return newTxin;
};

var TransactionOut = function (data) {
    this.script =
        data.script instanceof Script    ? data.script.clone()
      : util.isArray(data.script)        ? new Script(data.script)
      : typeof data.script == "string"   ? new Script(conv.hexToBytes(data.script))
      : data.scriptPubKey                ? Script.fromScriptSig(data.scriptPubKey)
      :                                    new Script();

    this.value = 
        util.isArray(data.value)         ? util.bytesToNum(data.value)
      : "string" == typeof data.value    ? parseInt(data.value)
      : data.value instanceof BigInteger ? parseInt(data.value.toString())
      :                                    data.value;
};

TransactionOut.prototype.clone = function ()
{
  var newTxout = new TransactionOut({
    script: this.script.clone(),
    value: this.value
  });
  return newTxout;
};

module.exports.Transaction = Transaction;
module.exports.TransactionIn = TransactionIn;
module.exports.TransactionOut = TransactionOut;

