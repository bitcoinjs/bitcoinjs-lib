var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
// var address = root.keyPair.getAddress()
// var wif = root.keyPair.toWIF()
// console.log(address)
// console.log(wif)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())
var witnessScript = bscript.pubKeyHash.output.encode(pubkeyhash)
var scriptHash = crypto.sha256(witnessScript)
var scriptPubKey = bscript.witnessScriptHash.output.encode(scriptHash)
var txid = '6d1c2682f553889e3887762fcf4669ab3844c6803d6c5c366bc2909bbe33cbf9'
var vout = 0

var txOut = {
  script: scriptPubKey,
  value: 65000
}

var builder = new TransactionBuilder(network)
builder.addInput(txid, vout, 0xffffffff, txOut.script)
builder.addOutput('2N6stcWuMpLgt4nkiaEFXP6p9J9VKRHCwDJ', 10000)

var unsigned = builder.buildIncomplete()
var signer = new TxSigner(unsigned)
signer.sign(0, root.keyPair, {
  scriptPubKey: scriptPubKey,
  witnessScript: witnessScript,
  value: txOut.value
})

var txd = signer.done()
console.log(txd.toBuffer().toString('hex'))

