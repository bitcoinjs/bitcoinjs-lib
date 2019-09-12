import { Network } from './networks';
interface ECPairOptions {
    compressed?: boolean;
    network?: Network;
    rng?(arg0: number): Buffer;
}
export interface Signer {
    publicKey: Buffer;
    network?: any;
    sign(hash: Buffer, lowR?: boolean): Buffer;
    getPublicKey?(): Buffer;
}
export interface SignerAsync {
    publicKey: Buffer;
    network?: any;
    sign(hash: Buffer, lowR?: boolean): Promise<Buffer>;
    getPublicKey?(): Buffer;
}
export interface ECPairInterface extends Signer {
    compressed: boolean;
    network: Network;
    lowR: boolean;
    privateKey?: Buffer;
    toWIF(): string;
    verify(hash: Buffer, signature: Buffer): boolean;
}
declare class ECPair implements ECPairInterface {
    private __D?;
    private __Q?;
    compressed: boolean;
    network: Network;
    lowR: boolean;
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
