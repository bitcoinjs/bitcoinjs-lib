import * as bcrypto from '../crypto.js';
import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import {
  isPoint,
  Hash160bitSchema,
  NBufferSchemaFactory,
  BufferSchema,
} from '../types.js';
import * as lazy from './lazy.js';
import bs58check from 'bs58check';
import * as tools from 'uint8array-tools';
import * as v from 'valibot';
const OPS = bscript.OPS;
// input: {signature} {pubkey}
// output: OP_DUP OP_HASH160 {hash160(pubkey)} OP_EQUALVERIFY OP_CHECKSIG
/**
 * Creates a Pay-to-Public-Key-Hash (P2PKH) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2PKH payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
export function p2pkh(a, opts) {
  if (!a.address && !a.hash && !a.output && !a.pubkey && !a.input)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        network: v.object({}),
        address: v.string(),
        hash: Hash160bitSchema,
        output: NBufferSchemaFactory(25),
        pubkey: v.custom(isPoint),
        signature: v.custom(bscript.isCanonicalScriptSignature),
        input: BufferSchema,
      }),
    ),
    a,
  );
  const _address = lazy.value(() => {
    const payload = bs58check.decode(a.address);
    const version = tools.readUInt8(payload, 0);
    const hash = payload.slice(1);
    return { version, hash };
  });
  const _chunks = lazy.value(() => {
    return bscript.decompile(a.input);
  });
  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'p2pkh', network };
  lazy.prop(o, 'address', () => {
    if (!o.hash) return;
    const payload = new Uint8Array(21);
    tools.writeUInt8(payload, 0, network.pubKeyHash);
    payload.set(o.hash, 1);
    return bs58check.encode(payload);
  });
  lazy.prop(o, 'hash', () => {
    if (a.output) return a.output.slice(3, 23);
    if (a.address) return _address().hash;
    if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey);
  });
  lazy.prop(o, 'output', () => {
    if (!o.hash) return;
    return bscript.compile([
      OPS.OP_DUP,
      OPS.OP_HASH160,
      o.hash,
      OPS.OP_EQUALVERIFY,
      OPS.OP_CHECKSIG,
    ]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (!a.input) return;
    return _chunks()[1];
  });
  lazy.prop(o, 'signature', () => {
    if (!a.input) return;
    return _chunks()[0];
  });
  lazy.prop(o, 'input', () => {
    if (!a.pubkey) return;
    if (!a.signature) return;
    return bscript.compile([a.signature, a.pubkey]);
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  // extended validation
  if (opts.validate) {
    let hash = Uint8Array.from([]);
    if (a.address) {
      if (_address().version !== network.pubKeyHash)
        throw new TypeError('Invalid version or Network mismatch');
      if (_address().hash.length !== 20) throw new TypeError('Invalid address');
      hash = _address().hash;
    }
    if (a.hash) {
      if (hash.length > 0 && tools.compare(hash, a.hash) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.hash;
    }
    if (a.output) {
      if (
        a.output.length !== 25 ||
        a.output[0] !== OPS.OP_DUP ||
        a.output[1] !== OPS.OP_HASH160 ||
        a.output[2] !== 0x14 ||
        a.output[23] !== OPS.OP_EQUALVERIFY ||
        a.output[24] !== OPS.OP_CHECKSIG
      )
        throw new TypeError('Output is invalid');
      const hash2 = a.output.slice(3, 23);
      if (hash.length > 0 && tools.compare(hash, hash2) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = hash2;
    }
    if (a.pubkey) {
      const pkh = bcrypto.hash160(a.pubkey);
      if (hash.length > 0 && tools.compare(hash, pkh) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = pkh;
    }
    if (a.input) {
      const chunks = _chunks();
      if (chunks.length !== 2) throw new TypeError('Input is invalid');
      if (!bscript.isCanonicalScriptSignature(chunks[0]))
        throw new TypeError('Input has invalid signature');
      if (!isPoint(chunks[1])) throw new TypeError('Input has invalid pubkey');
      if (a.signature && tools.compare(a.signature, chunks[0]) !== 0)
        throw new TypeError('Signature mismatch');
      if (a.pubkey && tools.compare(a.pubkey, chunks[1]) !== 0)
        throw new TypeError('Pubkey mismatch');
      const pkh = bcrypto.hash160(chunks[1]);
      if (hash.length > 0 && tools.compare(hash, pkh) !== 0)
        throw new TypeError('Hash mismatch');
    }
  }
  return Object.assign(o, a);
}
