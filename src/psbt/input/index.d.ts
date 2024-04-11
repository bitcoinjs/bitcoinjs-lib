/// <reference types="node" />
import { PsbtInput } from "bip174/src/lib/interfaces";
import { Transaction } from "../../transaction";
import { PsbtCache } from "../interfaces";
export declare function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void;
export declare function checkTxForDupeIns(tx: Transaction, cache: PsbtCache): void;
export declare function inputFinalizeGetAmts(inputs: PsbtInput[], tx: Transaction, cache: PsbtCache, mustFinalize: boolean): void;
export declare function getPrevoutTaprootKey(inputIndex: number, input: PsbtInput, cache: PsbtCache): Buffer | null;
