var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = 'beb647db98bda750f8202e6bc3441781ea5cfc6e3630c9d0ae47b0bfb111c249'
var vout = 1
var txOut = {
  script: bscript.pubKeyHash.output.encode(pubkeyhash),
  value: 100000
}

var witnessScript = txOut.script
var p2shScript = bscript.witnessScriptHash.output.encode(crypto.sha256(witnessScript))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff, txOut.script)
txb.addOutput(scriptPubKey, txOut.value - 10000)
txb.sign(0, root.keyPair)
var tx = txb.build()
console.log(tx.toBuffer().toString('hex'))
