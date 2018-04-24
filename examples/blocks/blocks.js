// Dislpays block height

var bitcoin = require('../..')

    // from 00000000000000000097669cdca131f24d40c4cc7d80eaa65967a2d09acf6ce6
    let txHex = '01000000012ad2438bd80f44912b5835cc636ccf4a82b4d88a4d19295fc1e888a21ee03273120000006b483045022100b27cd88b27849f19027c6838016a70ba95d33a6eac638006cd97c6c23da17aaf02207a772c1e209d6d283f9eb29079c4d238e9a2d8bb1630f52c9d28698290f9b9b80121022c7b4de26d782dcd2734d60b66794bb8c4feb1569b984e33f7c0972576dc1c3effffffff02bca61e00000000001976a91460d81b22c243fccbb4549ffec6df00f44f8bc5be88ac1cea7100000000001976a914531ec7bce6cca075dab446f25d6d92473d9f399d88ac00000000'
    console.log("Transaction Hex:",txHex,'\n');
    let tx = bitcoin.Transaction.fromHex(txHex)

    let script = tx.ins[0].script

    let heightBuffer = script.slice(1, 4)
    console.log("Transaction Script in Hex:",script.toString("Hex"),"\n");
    let height = bitcoin.script.number.decode(heightBuffer)
    console.log("Height number:",height)
