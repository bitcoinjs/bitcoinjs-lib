var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
var root2 = root.derive(1)

// var address = root.keyPair.getAddress()
// var wif = root.keyPair.toWIF()
// console.log(address)
// console.log(wif)

var multisig = bscript.multisig.output.encode(2, [root.getPublicKeyBuffer(), root2.getPublicKeyBuffer()])
var p2shScript = bscript.witnessScriptHash.output.encode(crypto.sha256(multisig))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))

var txid = '5d614b47c75ca29a16086e7866de7522e59a09491bbd7e914923f5aabc62616a'
var vout = 0
var txOut = {
  script: scriptPubKey,
  value: 15000
}

var builder = new TransactionBuilder(network)
builder.addInput(txid, vout, 0xffffffff, txOut.script)
builder.addOutput('2N6stcWuMpLgt4nkiaEFXP6p9J9VKRHCwDJ', 10000)

var unsigned = builder.buildIncomplete()
var signer = new TxSigner(unsigned)

var data = {
  scriptPubKey: txOut.script,
  value: txOut.value,
  redeemScript: p2shScript,
  witnessScript: multisig
}

signer.sign(0, root.keyPair, data)
signer.sign(0, root2.keyPair, data)

var txd = signer.done()
console.log(txd.toBuffer().toString('hex'))
