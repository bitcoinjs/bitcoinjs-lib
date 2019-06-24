export interface Secp256k1EccLib {
  // checks if given DER encoded point is on the secp256k1 curve
  // returns true if on curve false if not
  isPoint(derEncodedPoint: Buffer): boolean;
  // checks if the given 32 byte buffer is between 1 and n - 1 where n
  // refers to the order of the curve
  // returns true if a valid private key
  isPrivate(privateKey: Buffer): boolean;
  // Takes a scalar 32 bytes, multiplies it by the generator to get a point
  // then takes the given DER encoded point and adds it to that point
  // if toCompressed is given and true the returned value is DER compressed
  // if toCompressed is not given, then copy the compressed-ness state of the
  // first argument given (DER encoded point)
  // returns the point resulting in the addition of the given point and the
  // calculated point from the given scalar
  pointAddScalar(
    derEncodedPoint: Buffer,
    scalar32Bytes: Buffer,
    toCompressed?: boolean,
  ): Buffer;
  // Given a DER encoded point, convert the encoding to compressed-ness based on
  // the second argument's boolean value
  // returns a DER encoded public key point
  pointCompress(derEncodedPoint: Buffer, toCompressed: boolean): Buffer;
  // Given a 32 byte scalar, calculate the point (pubkey).
  // if toCompressed is not given, treat it as true.
  // returns a DER encoded public key
  pointFromScalar(scalar32Bytes: Buffer, toCompressed?: boolean): Buffer;
  // Adds together two 32 byte Buffers and checks that
  // the result is a valid private key.
  // returns the sum modulo the curve order as a Buffer
  privateAdd(privateKey: Buffer, scalar32Bytes: Buffer): Buffer;
  // Signs the hash using the privateKey. (no hashing is performed inside)
  // Returns a 64 byte Buffer where the first 32 bytes are the r value
  // the last 32 bytes are the s value. r and s are both big endian.
  sign(hash: Buffer, privateKey: Buffer): Buffer;
  // Same as sign, but with extra entropy added into the RFC6979 nonce
  // generation. See RFC6979 and libsecp256k1 for details
  signWithEntropy(
    hash: Buffer,
    privateKey: Buffer,
    extraEntropy: Buffer,
  ): Buffer;
  // Given a hash, DER encoded public key buffer, and 64 byte signature Buffer
  // It returns true if the verification of the signature passes.
  verify(hash: Buffer, publicKey: Buffer, signature: Buffer): boolean;
}

const ecc: Secp256k1EccLib = require('tiny-secp256k1');

export { ecc };
