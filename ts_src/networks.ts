// https://en.bitcoin.it/wiki/List_of_address_prefixes

import * as eq from 'equihashjs-verify';
import { LwmaConfig } from './lwma';

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
  lwma?: LwmaConfig;
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
  lwma: {
    enableHeight: 536200,
    testnet: false,
    regtest: false,
    powTargetSpacing: 600,
    averagingWindow: 45,
    adjustWeight: 13772,
    minDenominator: 10,
    solveTimeLimitation: true,
    powLimit:
      '14134776517815698497336078495404605830980533548759267698564454644503805952',
  },
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
  lwma: {
    enableHeight: 14300,
    testnet: true,
    regtest: false,
    powTargetSpacing: 600,
    averagingWindow: 45,
    adjustWeight: 13772,
    minDenominator: 10,
    solveTimeLimitation: false,
    powLimit:
      '14134776517815698497336078495404605830980533548759267698564454644503805952',
  },
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
  lwma: {
    enableHeight: 0,
    testnet: false,
    regtest: true,
    powTargetSpacing: 600,
    averagingWindow: 45,
    adjustWeight: 13772,
    minDenominator: 10,
    solveTimeLimitation: false,
    powLimit:
      '57896044618658097711785492504343953926634992332820282019728792003956564819967',
  },
};
