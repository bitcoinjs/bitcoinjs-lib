/// <reference types="node" />
import { PsbtOutput } from 'bip174/src/lib/interfaces';
import { PsbtCache } from '../interfaces';
export declare function pubkeyInOutput(pubkey: Buffer, output: PsbtOutput, outputIndex: number, cache: PsbtCache): boolean;
