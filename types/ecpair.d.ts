/// <reference types="node" />
import { Network } from './networks';
interface ECPairOptions {
    compressed?: boolean;
    network?: Network;
    rng?(arg0: number): Buffer;
}
export interface ECPairInterface {
    compressed: boolean;
    network: Network;
    publicKey: Buffer;
    privateKey?: Buffer;
    toWIF(): string;
    sign(hash: Buffer, lowR?: boolean): Buffer;
    verify(hash: Buffer, signature: Buffer): boolean;
    getPublicKey?(): Buffer;
}
declare class ECPair implements ECPairInterface {
    private __D?;
    private __Q?;
    compressed: boolean;
    network: Network;
    constructor(__D?: Buffer | undefined, __Q?: Buffer | undefined, options?: ECPairOptions);
    readonly privateKey: Buffer | undefined;
    readonly publicKey: Buffer;
    toWIF(): string;
    sign(hash: Buffer, lowR?: boolean): Buffer;
    verify(hash: Buffer, signature: Buffer): boolean;
}
declare function fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPair;
declare function fromPublicKey(buffer: Buffer, options?: ECPairOptions): ECPair;
declare function fromWIF(wifString: string, network?: Network | Network[]): ECPair;
declare function makeRandom(options?: ECPairOptions): ECPair;
export { makeRandom, fromPrivateKey, fromPublicKey, fromWIF };
