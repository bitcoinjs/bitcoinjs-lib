import * as bcrypto from '../crypto.js';
import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import { BufferSchema, isPoint, NBufferSchemaFactory } from '../types.js';
import * as lazy from './lazy.js';
import { bech32 } from 'bech32';
import * as tools from 'uint8array-tools';
import * as v from 'valibot';
const OPS = bscript.OPS;
const EMPTY_BUFFER = new Uint8Array(0);
// witness: {signature} {pubKey}
// input: <>
// output: OP_0 {pubKeyHash}
/**
 * Creates a pay-to-witness-public-key-hash (p2wpkh) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The p2wpkh payment object.
 * @throws {TypeError} If the required data is missing or invalid.
 */
export function p2wpkh(a, opts) {
  if (!a.address && !a.hash && !a.output && !a.pubkey && !a.witness)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        address: v.string(),
        hash: NBufferSchemaFactory(20),
        input: NBufferSchemaFactory(0),
        network: v.object({}),
        output: NBufferSchemaFactory(22),
        pubkey: v.custom(isPoint, 'Not a valid pubkey'),
        signature: v.custom(bscript.isCanonicalScriptSignature),
        witness: v.array(BufferSchema),
      }),
    ),
    a,
  );
  const _address = lazy.value(() => {
    const result = bech32.decode(a.address);
    const version = result.words.shift();
    const data = bech32.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Uint8Array.from(data),
    };
  });
  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'p2wpkh', network };
  lazy.prop(o, 'address', () => {
    if (!o.hash) return;
    const words = bech32.toWords(o.hash);
    words.unshift(0x00);
    return bech32.encode(network.bech32, words);
  });
  lazy.prop(o, 'hash', () => {
    if (a.output) return a.output.slice(2, 22);
    if (a.address) return _address().data;
    if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey);
  });
  lazy.prop(o, 'output', () => {
    if (!o.hash) return;
    return bscript.compile([OPS.OP_0, o.hash]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (!a.witness) return;
    return a.witness[1];
  });
  lazy.prop(o, 'signature', () => {
    if (!a.witness) return;
    return a.witness[0];
  });
  lazy.prop(o, 'input', () => {
    if (!o.witness) return;
    return EMPTY_BUFFER;
  });
  lazy.prop(o, 'witness', () => {
    if (!a.pubkey) return;
    if (!a.signature) return;
    return [a.signature, a.pubkey];
  });
  // extended validation
  if (opts.validate) {
    let hash = Uint8Array.from([]);
    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== 0x00)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 20)
        throw new TypeError('Invalid address data');
      hash = _address().data;
    }
    if (a.hash) {
      if (hash.length > 0 && tools.compare(hash, a.hash) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.hash;
    }
    if (a.output) {
      if (
        a.output.length !== 22 ||
        a.output[0] !== OPS.OP_0 ||
        a.output[1] !== 0x14
      )
        throw new TypeError('Output is invalid');
      if (hash.length > 0 && tools.compare(hash, a.output.slice(2)) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.output.slice(2);
    }
    if (a.pubkey) {
      const pkh = bcrypto.hash160(a.pubkey);
      if (hash.length > 0 && tools.compare(hash, pkh) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = pkh;
      if (!isPoint(a.pubkey) || a.pubkey.length !== 33)
        throw new TypeError('Invalid pubkey for p2wpkh');
    }
    if (a.witness) {
      if (a.witness.length !== 2) throw new TypeError('Witness is invalid');
      if (!bscript.isCanonicalScriptSignature(a.witness[0]))
        throw new TypeError('Witness has invalid signature');
      if (!isPoint(a.witness[1]) || a.witness[1].length !== 33)
        throw new TypeError('Witness has invalid pubkey');
      if (a.signature && tools.compare(a.signature, a.witness[0]) !== 0)
        throw new TypeError('Signature mismatch');
      // if (a.pubkey && !a.pubkey.equals(a.witness[1]))
      if (a.pubkey && tools.compare(a.pubkey, a.witness[1]) !== 0)
        throw new TypeError('Pubkey mismatch');
      const pkh = bcrypto.hash160(a.witness[1]);
      if (hash.length > 0 && tools.compare(hash, pkh) !== 0)
        throw new TypeError('Hash mismatch');
    }
  }
  return Object.assign(o, a);
}
