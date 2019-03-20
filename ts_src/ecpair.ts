import { Network } from './networks';
import * as NETWORKS from './networks';
import * as types from './types';
const ecc = require('tiny-secp256k1');
const randomBytes = require('randombytes');
const typeforce = require('typeforce');
const wif = require('wif');

const isOptions = typeforce.maybe(
  typeforce.compile({
    compressed: types.maybe(types.Boolean),
    network: types.maybe(types.Network),
  }),
);

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

class ECPair implements ECPairInterface {
  compressed: boolean;
  network: Network;

  constructor(
    private __D?: Buffer,
    private __Q?: Buffer,
    options?: ECPairOptions,
  ) {
    if (options === undefined) options = {};
    this.compressed =
      options.compressed === undefined ? true : options.compressed;
    this.network = options.network || NETWORKS.bitcoin;

    if (__Q !== undefined) this.__Q = ecc.pointCompress(__Q, this.compressed);
  }

  get privateKey(): Buffer | undefined {
    return this.__D;
  }

  get publicKey(): Buffer | undefined {
    if (!this.__Q) this.__Q = ecc.pointFromScalar(this.__D, this.compressed);
    return this.__Q;
  }

  toWIF(): string {
    if (!this.__D) throw new Error('Missing private key');
    return wif.encode(this.network.wif, this.__D, this.compressed);
  }

  sign(hash: Buffer): Buffer {
    if (!this.__D) throw new Error('Missing private key');
    return ecc.sign(hash, this.__D);
  }

  verify(hash: Buffer, signature: Buffer): Buffer {
    return ecc.verify(hash, this.publicKey, signature);
  }
}

function fromPrivateKey(buffer: Buffer, options?: ECPairOptions): ECPair {
  typeforce(types.Buffer256bit, buffer);
  if (!ecc.isPrivate(buffer))
    throw new TypeError('Private key not in range [1, n)');
  typeforce(isOptions, options);

  return new ECPair(buffer, undefined, options as ECPairOptions);
}

function fromPublicKey(buffer: Buffer, options?: ECPairOptions): ECPair {
  typeforce(ecc.isPoint, buffer);
  typeforce(isOptions, options);
  return new ECPair(undefined, buffer, options as ECPairOptions);
}

function fromWIF(wifString: string, network?: Network | Network[]): ECPair {
  const decoded = wif.decode(wifString);
  const version = decoded.version;

  // list of networks?
  if (types.Array(network)) {
    network = (network as Network[])
      .filter((x: Network) => {
        return version === x.wif;
      })
      .pop() as Network;

    if (!network) throw new Error('Unknown network version');

    // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = network || NETWORKS.bitcoin;

    if (version !== (network as Network).wif)
      throw new Error('Invalid network version');
  }

  return fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: network as Network,
  });
}

function makeRandom(options?: ECPairOptions): ECPair {
  typeforce(isOptions, options);
  if (options === undefined) options = {};
  const rng = options.rng || randomBytes;

  let d;
  do {
    d = rng(32);
    typeforce(types.Buffer256bit, d);
  } while (!ecc.isPrivate(d));

  return fromPrivateKey(d, options);
}

export { makeRandom, fromPrivateKey, fromPublicKey, fromWIF };
