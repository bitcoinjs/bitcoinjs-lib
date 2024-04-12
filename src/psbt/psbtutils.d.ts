/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { HDSigner, HDSignerAsync, PsbtCache, PsbtOpts, Signer, SignerAsync } from './interfaces';
import { Psbt } from '../psbt';
export declare function check32Bit(num: number): void;
export declare function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void;
export declare function getSignersFromHD(inputIndex: number, inputs: PsbtInput[], hdKeyPair: HDSigner | HDSignerAsync): Array<Signer | SignerAsync>;
export declare function range(n: number): number[];
export declare function isPubkeyLike(buf: Buffer): boolean;
