/** 
 * These types were originally written by 
 * Mohamed Hegazy https://github.com/mhegazy,
 * Daniel https://github.com/dlebrecht, 
 * Ron Buckton https://github.com/rbuckton, 
 * Satana Charuwichitratana https://github.com/micksatana, 
 * Youssef GHOUBACH https://github.com/youssefgh, 
 * Kento https://github.com/kento1218.
 */

export declare type Bitcoin = {
  messagePrefix: '\x18Bitcoin Signed Message:\n'
  bech32: 'bc'
  bip32: {
    public: 0x0488b21e
    private: 0x0488ade4
  }
  pubKeyHash: 0x00
  scriptHash: 0x05
  wif: 0x80
}

export declare type Testnet = {
  messagePrefix: '\x18Bitcoin Signed Message:\n'
  bech32: 'tb'
  bip32: {
    public: 0x043587cf
    private: 0x043587cf
  }
  pubKeyHash: 0x6f
  scriptHash: 0xc4
  wif: 0xef
}

export type Network = Bitcoin | Testnet
export declare const bitcoin: Bitcoin
export declare const testnet: Testnet
