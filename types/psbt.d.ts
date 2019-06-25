import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';
export declare class Psbt extends PsbtBase {
    constructor();
    signInput(inputIndex: number, keyPair: Signer): Psbt;
}
