var bitcoin = require('../../')
var regtestUtils = require('./../_regtest')
var regtest = regtestUtils.network

// Random generator
function rng () {
  return Buffer.from('YT8dAtK4d16A3P1z+TpwB2jJ4aFH3g9M1EioIBkLEV4=', 'base64')
}

//  importing alice and bob's private key from wif
var alice = bitcoin.ECPair.fromWIF('L1Knwj9W3qK3qMKdTvmg3VfzUs3ij2LETTFhxza9LfD5dngnoLG1')
var bob = bitcoin.ECPair.fromWIF('KwcN2pT3wnRAurhy7qMczzbkpY5nXMW2ubh696UBc1bcwctTx26z')


var txb = new bitcoin.TransactionBuilder()
   txb.addInput('b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c', 6) // Alice's previous transaction output, has 200000 satoshis
   txb.addInput('7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730',0) // Bob's previous transaction output, has 300000 satoshis
   // not sure why arguement 6 and 0 is passed but it probably has something to do with format
   txb.addOutput('1CUNEBjYrCn2y1SdiUMohaKUi4wpP326Lb', 180000)
   txb.addOutput('1JtK9CQw1syfWj1WtFMWomrYdV3W2tWBF9', 170000)
// (in)(200000 + 300000) - (out)(180000 + 170000) = (fee)150000, this is the miner fee

// both parties sign
txb.sign(1, bob) // Bob signs his input, which was the second input (1th)
txb.sign(0, alice) // Alice signs her input, which was the first input (0th)

console.log('2-2 Multisig Transaction to be broadcasted to Bitcoin network in hex format :'+'\n'+ txb.build().toHex())
