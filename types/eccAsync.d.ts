/// <reference types="node" />
export interface Secp256k1EccLibAsync {
    isPoint(derEncodedPoint: Buffer): Promise<boolean>;
    isPrivate(privateKey: Buffer): Promise<boolean>;
    pointAddScalar(derEncodedPoint: Buffer, scalar32Bytes: Buffer, toCompressed?: boolean): Promise<Buffer>;
    pointCompress(derEncodedPoint: Buffer, toCompressed: boolean): Promise<Buffer>;
    pointFromScalar(scalar32Bytes: Buffer, toCompressed?: boolean): Promise<Buffer>;
    privateAdd(privateKey: Buffer, scalar32Bytes: Buffer): Promise<Buffer>;
    sign(hash: Buffer, privateKey: Buffer): Promise<Buffer>;
    signWithEntropy(hash: Buffer, privateKey: Buffer, extraEntropy: Buffer): Promise<Buffer>;
    verify(hash: Buffer, publicKey: Buffer, signature: Buffer): Promise<boolean>;
}
declare const ecc: Secp256k1EccLibAsync;
export { ecc };
