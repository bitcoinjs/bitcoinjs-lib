var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
var address = root.keyPair.getAddress()
var wif = root.keyPair.toWIF()
console.log(address)
console.log(wif)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())
var txid = 'cca0f194d0ca770737121532497f82b3b4eb861df462bbb26978e53acfec7de8'
var vout = 0

var txOut = {
  script: bscript.witnessPubKeyHash.output.encode(pubkeyhash),
  value: 17000
}

var builder = new TransactionBuilder(network)
builder.addInput(txid, vout, 0xffffffff, txOut.script)
builder.addOutput('2N6stcWuMpLgt4nkiaEFXP6p9J9VKRHCwDJ', txOut.value - 5000)

var unsigned = builder.buildIncomplete()
var signer = new TxSigner(unsigned)
signer.sign(0, root.keyPair, {
  scriptPubKey: txOut.script,
  value: txOut.value
})

var txd = signer.done()

console.log(txd.toBuffer().toString('hex'))
