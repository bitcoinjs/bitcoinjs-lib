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
    private __D?;
    private __Q?;
    compressed: boolean;
    network: Network;
    constructor(__D?: Buffer | undefined, __Q?: Buffer | undefined, options?: ECPairOptions);
    readonly privateKey: Buffer | undefined;
    readonly publicKey: Buffer | undefined;
    toWIF(): string;
    sign(hash: Buffer): Buffer;
    verify(hash: Buffer, signature: Buffer): Buffer;
}
declare function fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPair;
declare function fromPublicKey(buffer: Buffer, options?: ECPairOptions): ECPair;
declare function fromWIF(wifString: string, network?: Network | Network[]): ECPair;
declare function makeRandom(options?: ECPairOptions): ECPair;
export { makeRandom, fromPrivateKey, fromPublicKey, fromWIF };
