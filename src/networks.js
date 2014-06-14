// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
module.exports = {
  bitcoin: {
    magicprefix: '\x18Bitcoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubkeyhash: 0x00,
    scripthash: 0x05,
    wif: 0x80
  },
  dogecoin: {
    magicprefix: '\x19Dogecoin Signed Message:\n',
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398
    },
    pubkeyhash: 0x1e,
    scripthash: 0x16,
    wif: 0x9e
  },
  litecoin: {
    magicprefix: '\x19Litecoin Signed Message:\n',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe
    },
    pubkeyhash: 0x30,
    scripthash: 0x05,
    wif: 0xb0
  },
  testnet: {
    magicprefix: '\x18Bitcoin Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    wif: 0xef
  }
}
