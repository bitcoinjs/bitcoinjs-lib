/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { PsbtCache } from '../interfaces';
export declare function getHashAndSighashType(inputs: PsbtInput[], inputIndex: number, pubkey: Buffer, cache: PsbtCache, sighashTypes: number[]): {
    hash: Buffer;
    sighashType: number;
};
export declare function getHashForSig(inputIndex: number, input: PsbtInput, cache: PsbtCache, forValidate: boolean, sighashTypes?: number[]): {
    script: Buffer;
    hash: Buffer;
    sighashType: number;
};
export declare function getAllTaprootHashesForSig(inputIndex: number, input: PsbtInput, inputs: PsbtInput[], cache: PsbtCache): {
    pubkey: Buffer;
    hash: Buffer;
    leafHash?: Buffer;
}[];
export declare function getTaprootHashesForSig(inputIndex: number, input: PsbtInput, inputs: PsbtInput[], pubkey: Buffer, cache: PsbtCache, tapLeafHashToSign?: Buffer, allowedSighashTypes?: number[]): {
    pubkey: Buffer;
    hash: Buffer;
    leafHash?: Buffer;
}[];
