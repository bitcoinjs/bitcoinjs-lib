// https://en.bitcoin.it/wiki/List_of_address_prefixes
module.exports = {
  bitcoin: {
    bip32: {
      pub: 0x0488b21e,
      priv: 0x0488ade4
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80
  },
  dogecoin: {
    pubKeyHash: 0x30,
    scriptHash: 0x20,
    wif: 0x9e
  },
  litecoin: {
    scriptHash: 0x30,
  },
  testnet: {
    bip32: {
      pub: 0x043587cf,
      priv: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  }
}
