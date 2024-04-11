/// <reference types="node" />
import { PsbtInput } from "bip174/src/lib/interfaces";
import { PsbtCache, TxCacheNumberKey } from "../interfaces";
import { Transaction } from "../../transaction";
export declare function checkCache(cache: PsbtCache): void;
export declare function checkTxInputCache(cache: PsbtCache, input: {
    hash: Buffer;
    index: number;
}): void;
export declare function getTxCacheValue(key: TxCacheNumberKey, name: string, inputs: PsbtInput[], c: PsbtCache): number | undefined;
export declare function nonWitnessUtxoTxFromCache(cache: PsbtCache, input: PsbtInput, inputIndex: number): Transaction;
export declare function addNonWitnessTxCache(cache: PsbtCache, input: PsbtInput, inputIndex: number): void;
