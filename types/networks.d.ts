export declare type Network = {
    messagePrefix: string;
    bech32: string;
    bip32: bip32;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
};
declare type bip32 = {
    public: number;
    private: number;
};
export declare const bitcoin: Network;
export declare const regtest: Network;
export declare const testnet: Network;
export {};
