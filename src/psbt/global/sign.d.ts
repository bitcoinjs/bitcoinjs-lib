/// <reference types="node" />
import { PsbtInput } from "bip174/src/lib/interfaces";
export declare function hasSigs(neededSigs: number, partialSig?: any[], pubkeys?: Buffer[]): boolean;
export declare function checkPartialSigSighashes(input: PsbtInput): void;
export declare function trimTaprootSig(signature: Buffer): Buffer;
export declare function isSigLike(buf: Buffer): boolean;
