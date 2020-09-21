import * as eq from 'equihashjs-verify';
import { LwmaConfig } from './lwma';
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
    forkId?: number;
}
interface Bip32 {
    public: number;
    private: number;
}
export declare const bitcoin: Network;
export declare const regtest: Network;
export declare const testnet: Network;
export declare const bitcoingold: Network;
export declare const bitcoingoldtestnet: Network;
export declare const bitcoingoldregtest: Network;
export {};
