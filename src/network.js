// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
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
    bip32: {
      pub: 0x02facafd,
      priv: 0x02fac398
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e
  },
  litecoin: {
    bip32: {
      pub: 0x019da462,
      priv: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x05,
    wif: 0xb0
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