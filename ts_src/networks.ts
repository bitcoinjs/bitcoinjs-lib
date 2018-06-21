// https://en.bitcoin.it/wiki/List_of_address_prefixes

import * as eq from 'equihashjs-verify';

// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
export interface Network {
  messagePrefix: string;
  bech32: string;
  bip32: Bip32;
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
  forkHeight?: number;
  equihashForkHeight?: number;
  equihash?: eq.Network;
  equihashLegacy?: eq.Network;
}

interface Bip32 {
  public: number;
  private: number;
}

export const bitcoin: Network = {
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
export const regtest: Network = {
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
export const testnet: Network = {
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
export const bitcoingold: Network = {
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
  equihashForkHeight: 536200,
  equihash: eq.networks.bitcoingold,
  equihashLegacy: eq.networks.bitcoingoldPreEquihashFork,
};
export const bitcoingoldtestnet: Network = {
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
  equihashForkHeight: 14300,
  equihash: eq.networks.bitcoingoldTestnet,
  equihashLegacy: eq.networks.bitcoingoldPreEquihashFork,
};
export const bitcoingoldregtest: Network = {
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
