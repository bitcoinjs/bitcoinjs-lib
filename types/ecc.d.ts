/// <reference types="node" />
export interface Secp256k1EccLib {
    isPoint(derEncodedPoint: Buffer): boolean;
    isPrivate(privateKey: Buffer): boolean;
    pointAddScalar(derEncodedPoint: Buffer, scalar32Bytes: Buffer, toCompressed?: boolean): Buffer;
    pointCompress(derEncodedPoint: Buffer, toCompressed: boolean): Buffer;
    pointFromScalar(scalar32Bytes: Buffer, toCompressed?: boolean): Buffer;
    privateAdd(privateKey: Buffer, scalar32Bytes: Buffer): Buffer;
    sign(hash: Buffer, privateKey: Buffer): Buffer;
    signWithEntropy(hash: Buffer, privateKey: Buffer, extraEntropy: Buffer): Buffer;
    verify(hash: Buffer, publicKey: Buffer, signature: Buffer): boolean;
}
declare const ecc: Secp256k1EccLib;
export { ecc };
