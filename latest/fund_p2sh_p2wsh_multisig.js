var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
var root2 = root.derive(1)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = 'aed14f8e918c6e7cc9347391b790f765030b07e6985fbb146bf3f6b25ddc0043'
var vout = 0
var txOut = {
  script: bscript.pubKeyHash.output.encode(pubkeyhash),
  value: 22000
}

var multisig = bscript.multisig.output.encode(2, [root.getPublicKeyBuffer(), root2.getPublicKeyBuffer()])
var p2shScript = bscript.witnessScriptHash.output.encode(crypto.sha256(multisig))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff, txOut.script)
txb.addOutput(scriptPubKey, txOut.value - 5000)
txb.sign(0, root.keyPair)
var tx = txb.build()
console.log(tx.toBuffer().toString('hex'))

// b5e7c1d911b078c754770fc372bc92096ce2605ac6b785f91ec7df0a5034ec69
