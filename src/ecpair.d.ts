/// <reference types="node" />
import { Network } from './networks';
interface ECPairOptions {
    compressed?: boolean;
    network?: Network;
    rng?(arg0: Buffer): Buffer;
}
export interface ECPairInterface {
    compressed: boolean;
    network: Network;
    privateKey?: Buffer;
    publicKey?: Buffer;
    toWIF(): string;
    sign(hash: Buffer): Buffer;
    verify(hash: Buffer, signature: Buffer): Buffer;
    getPublicKey?(): Buffer;
}
declare class ECPair implements ECPairInterface {
    compressed: boolean;
    network: Network;
    private __d?;
    private __Q?;
    constructor(d?: Buffer, Q?: Buffer, options?: ECPairOptions);
    readonly privateKey: Buffer | undefined;
    readonly publicKey: Buffer | undefined;
    toWIF(): string;
    sign(hash: Buffer): Buffer;
    verify(hash: Buffer, signature: Buffer): Buffer;
}
declare function fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPairInterface;
declare function fromPublicKey(buffer: Buffer, options?: ECPairOptions): ECPairInterface;
declare function fromWIF(string: string, network?: Network | Array<Network>): ECPairInterface;
declare function makeRandom(options?: ECPairOptions): ECPairInterface;
export { makeRandom, fromPrivateKey, fromPublicKey, fromWIF };
