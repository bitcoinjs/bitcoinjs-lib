var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = 'beb647db98bda750f8202e6bc3441781ea5cfc6e3630c9d0ae47b0bfb111c249'
var vout = 1
var receiveAmount = 10000
var receivePK = bscript.pubKeyHash.output.encode(pubkeyhash)

var witnessScript = bscript.pubKeyHash.output.encode(pubkeyhash)
var p2shScript = bscript.witnessScriptHash.output.encode(crypto.sha256(witnessScript))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff)
txb.addOutput(scriptPubKey, receiveAmount - 10000)

var txs = new TxSigner(txb.buildIncomplete())
txs.sign(0, root.keyPair, {
  scriptPubKey: receivePK
})
var tx = txs.done()
console.log(tx.toBuffer().toString('hex'))
