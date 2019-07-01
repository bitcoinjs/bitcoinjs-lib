import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';
import { Network } from './networks';
export declare class Psbt extends PsbtBase {
    network?: Network | undefined;
    constructor(network?: Network | undefined);
    canFinalize(inputIndex: number): boolean;
    signInput(inputIndex: number, keyPair: Signer): Psbt;
}
