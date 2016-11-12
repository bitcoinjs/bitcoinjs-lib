var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
console.log(root.getAddress())
var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = '79f560d078eacf4cf9381544b15c400773fddd6bbfb1064956e0c345d39be260'
var vout = 0
var scriptPubKey = bscript.pubKeyHash.output.encode(pubkeyhash)
var amount = 70000

var witnessScriptHash = crypto.sha256(scriptPubKey)
var toP2WSH = bscript.witnessScriptHash.output.encode(witnessScriptHash)

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff, scriptPubKey)
txb.addOutput(toP2WSH, amount - 5000)
txb.sign(0, root.keyPair)
var tx = txb.build()
console.log(tx.toBuffer().toString('hex'))
