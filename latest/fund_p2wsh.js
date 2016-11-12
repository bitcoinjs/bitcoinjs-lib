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

var txid = '79f560d078eacf4cf9381544b15c400773fddd6bbfb1064956e0c345d39be260'
var vout = 0
var receivePK = bscript.pubKeyHash.output.encode(pubkeyhash)
var receiveAmount = 70000

var witnessScript = bscript.pubKeyHash.output.encode(pubkeyhash)
var toP2WSH = bscript.witnessScriptHash.output.encode(crypto.sha256(witnessScript))

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff)
txb.addOutput(toP2WSH, receiveAmount - 5000)

var txs = new TxSigner(txb.buildIncomplete())
txs.sign(0, root.keyPair, {
  scriptPubKey: receivePK
})
var tx = txs.done()
console.log(tx.toBuffer().toString('hex'))
