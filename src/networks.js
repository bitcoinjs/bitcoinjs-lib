// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
// Add alt coins BIP44 https://github.com/libbitcoin/libbitcoin/wiki/Altcoin-Version-Mappings

module.exports = {
  bitcoin: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80
  },
  testnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',  
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  },
  litecoin: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
  },
  litecoinTestnet: {
    messagePrefix: '\x19Litecoin Testnet Signed Message:\n',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  },
  viacoin: {
    messagePrefix: '\x19Viacoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x47,
    scriptHash: 0x21,
    wif: 0xc7
  },
  viacoinTestnet: {
    messagePrefix: '\x19Viacoin Testnet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x7f,
    scriptHash: 0xc4,
    wif: 0xff
  },
  dogecoin: {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e
  },
  dogecoinTestnet: {
    messagePrefix: '\x19Dogecoin Testnet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x0432a243
    },
    pubKeyHash: 0x71,
    scriptHash: 0xc4,
    wif: 0xf1
  },
  startcoin: {
    messagePrefix: '\x19Startcoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x7d,
    scriptHash: 0xfd,
    wif: 0x05
  },
  startcoinTestnet: {
    messagePrefix: '\x19Startcoin Testnet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04468394
    },
    pubKeyHash: 0x7f,
    scriptHash: 0xf4,
    wif: 0xc4
  },
  dash: {
    messagePrefix: '\x19Dash Signed Message:\n',
    bip32: {
      public: 0x02fe52f8,
      private: 0x02fe52cc
    },
    pubKeyHash: 0x4c,
    scriptHash: 0x10,
    wif: 0xcc
  },
  dashTestnet: {
    messagePrefix: '\x19Dash Testnet Signed Message:\n',
    bip32: {
      public: 0x3a8061a0,
      private: 0x3a805837
    },
    pubKeyHash: 0x8b,
    scriptHash: 0x13,
    wif: 0xef
  },
  reddcoin: {
    messagePrefix: '\x19Reddcoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x3d,
    scriptHash: 0x05,
    wif: 0xbd
  },
  reddcoinTestnet: {
    messagePrefix: '\x19Reddcoin Testnet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  },
  peercoin: {
    messagePrefix: '\x19Peercoin Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x37,
    scriptHash: 0x75,
    wif: 0x80
  },
  peercoinTestnet: {
    messagePrefix: '\x19Peercoin Testnet Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  }
}
