'use strict';
// https://en.bitcoin.it/wiki/List_of_address_prefixes
Object.defineProperty(exports, '__esModule', { value: true });
const eq = require('equihashjs-verify');
exports.bitcoin = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};
exports.regtest = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bcrt',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};
exports.testnet = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};
exports.bitcoingold = {
  messagePrefix: '\x1DBitcoin Gold Signed Message:\n',
  bech32: 'btg',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x26,
  scriptHash: 0x17,
  wif: 0x80,
  forkHeight: 491407,
  equihash: eq.networks.bitcoingold,
};
exports.bitcoingoldtestnet = {
  messagePrefix: '\x1DBitcoin Gold Signed Message:\n',
  bech32: 'tbtg',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
  forkHeight: 1,
  equihash: eq.networks.bitcoingoldTestnet,
};
exports.bitcoingoldregtest = {
  messagePrefix: '\x1DBitcoin Gold Signed Message:\n',
  bech32: 'tbtg',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
  forkHeight: 2000,
  equihash: eq.networks.bitcoingoldRegtest,
};
