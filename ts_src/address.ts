import { Network } from './networks';
import * as networks from './networks';
import { OPS } from './ops';
import * as payments from './payments';
import * as bscript from './script';
import { typeforce, tuple, Hash160bit, UInt8 } from './types';
import * as varuint from 'bip174/src/lib/converter/varint';
import { bech32, bech32m } from 'bech32';
import * as bs58check from 'bs58check';
export interface Base58CheckResult {
  hash: Buffer;
  version: number;
}

export interface Bech32Result {
  version: number;
  prefix: string;
  data: Buffer;
}

const FUTURE_SEGWIT_MAX_SIZE: number = 40;
const FUTURE_SEGWIT_MIN_SIZE: number = 2;
const FUTURE_SEGWIT_MAX_VERSION: number = 16;
const FUTURE_SEGWIT_MIN_VERSION: number = 2;
const FUTURE_SEGWIT_VERSION_DIFF: number = 0x50;
const FUTURE_SEGWIT_VERSION_WARNING: string =
  'WARNING: Sending to a future segwit version address can lead to loss of funds. ' +
  'End users MUST be warned carefully in the GUI and asked if they wish to proceed ' +
  'with caution. Wallets should verify the segwit version from the output of fromBech32, ' +
  'then decide when it is safe to use which version of segwit.';

function _toFutureSegwitAddress(output: Buffer, network: Network): string {
  const data = output.slice(2);

  if (
    data.length < FUTURE_SEGWIT_MIN_SIZE ||
    data.length > FUTURE_SEGWIT_MAX_SIZE
  )
    throw new TypeError('Invalid program length for segwit address');

  const version = output[0] - FUTURE_SEGWIT_VERSION_DIFF;

  if (
    version < FUTURE_SEGWIT_MIN_VERSION ||
    version > FUTURE_SEGWIT_MAX_VERSION
  )
    throw new TypeError('Invalid version for segwit address');

  if (output[1] !== data.length)
    throw new TypeError('Invalid script for segwit address');

  console.warn(FUTURE_SEGWIT_VERSION_WARNING);

  return toBech32(data, version, network.bech32);
}

export function fromBase58Check(address: string): Base58CheckResult {
  const payload = Buffer.from(bs58check.decode(address));

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');

  const version = payload.readUInt8(0);
  const hash = payload.slice(1);

  return { version, hash };
}

export function fromBech32(address: string): Bech32Result {
  let result;
  let version;
  try {
    result = bech32.decode(address);
  } catch (e) {}

  if (result) {
    version = result.words[0];
    if (version !== 0) throw new TypeError(address + ' uses wrong encoding');
  } else {
    result = bech32m.decode(address);
    version = result.words[0];
    if (version === 0) throw new TypeError(address + ' uses wrong encoding');
  }

  const data = bech32.fromWords(result.words.slice(1));

  return {
    version,
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}

export function toBase58Check(hash: Buffer, version: number): string {
  typeforce(tuple(Hash160bit, UInt8), arguments);

  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);

  return bs58check.encode(payload);
}

export function toBech32(
  data: Buffer,
  version: number,
  prefix: string,
): string {
  const words = bech32.toWords(data);
  words.unshift(version);

  return version === 0
    ? bech32.encode(prefix, words)
    : bech32m.encode(prefix, words);
}

export function fromOutputScript(output: Buffer, network?: Network): string {
  // TODO: Network
  network = network || networks.bitcoin;

  try {
    return payments.p2pkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2sh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wpkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wsh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2tr({ output, network }).address as string;
  } catch (e) {}
  try {
    return _toFutureSegwitAddress(output, network);
  } catch (e) {}

  throw new Error(bscript.toASM(output) + ' has no matching Address');
}

/**
 * This uses the logic from Bitcoin Core to decide what is the dust threshold for a given script.
 *
 * Ref: https://github.com/bitcoin/bitcoin/blob/160d23677ad799cf9b493eaa923b2ac080c3fb8e/src/policy/policy.cpp#L26-L63
 *
 * @param {Buffer} script - This is the script to evaluate a dust limit for.
 * @param {number} [satPerVb=1] - This is to account for different MIN_RELAY_TX_FEE amounts. Bitcoin Core does not calculate
 *                                dust based on the mempool ejection cutoff, but always by the MIN_RELAY_TX_FEE.
 *                                This argument should be passed in as satoshi per vByte. Not satoshi per kvByte like Core.
 */
export function dustAmountFromOutputScript(
  script: Buffer,
  satPerVb: number = 1,
): number {
  if (isUnspendableCore(script)) {
    return 0;
  }

  const inputBytes = isSegwit(script) ? 67 : 148;
  const outputBytes = script.length + 8 + varuint.encodingLength(script.length);

  return Math.ceil((inputBytes + outputBytes) * 3 * satPerVb);
}

function isUnspendableCore(script: Buffer): boolean {
  const startsWithOpReturn = script.length > 0 && script[0] == OPS.OP_RETURN;
  const MAX_SCRIPT_SIZE = 10000;
  const greaterThanScriptSize = script.length > MAX_SCRIPT_SIZE;
  // If unspendable, return 0
  // https://github.com/bitcoin/bitcoin/blob/160d23677ad799cf9b493eaa923b2ac080c3fb8e/src/script/script.h#L554C16-L554C84
  // (size() > 0 && *begin() == OP_RETURN) || (size() > MAX_SCRIPT_SIZE);
  return startsWithOpReturn || greaterThanScriptSize;
}

function isSegwit(script: Buffer): boolean {
  if (script.length < 4 || script.length > 42) return false;
  if (script[0] !== OPS.OP_0 && (script[0] < OPS.OP_1 || script[0] > OPS.OP_16))
    return false;
  if (script[1] + 2 !== script.length) return false;
  return true;
}

export function toOutputScript(address: string, network?: Network): Buffer {
  network = network || networks.bitcoin;

  let decodeBase58: Base58CheckResult | undefined;
  let decodeBech32: Bech32Result | undefined;
  try {
    decodeBase58 = fromBase58Check(address);
  } catch (e) {}

  if (decodeBase58) {
    if (decodeBase58.version === network.pubKeyHash)
      return payments.p2pkh({ hash: decodeBase58.hash }).output as Buffer;
    if (decodeBase58.version === network.scriptHash)
      return payments.p2sh({ hash: decodeBase58.hash }).output as Buffer;
  } else {
    try {
      decodeBech32 = fromBech32(address);
    } catch (e) {}

    if (decodeBech32) {
      if (decodeBech32.prefix !== network.bech32)
        throw new Error(address + ' has an invalid prefix');
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20)
          return payments.p2wpkh({ hash: decodeBech32.data }).output as Buffer;
        if (decodeBech32.data.length === 32)
          return payments.p2wsh({ hash: decodeBech32.data }).output as Buffer;
      } else if (decodeBech32.version === 1) {
        if (decodeBech32.data.length === 32)
          return payments.p2tr({ pubkey: decodeBech32.data }).output as Buffer;
      } else if (
        decodeBech32.version >= FUTURE_SEGWIT_MIN_VERSION &&
        decodeBech32.version <= FUTURE_SEGWIT_MAX_VERSION &&
        decodeBech32.data.length >= FUTURE_SEGWIT_MIN_SIZE &&
        decodeBech32.data.length <= FUTURE_SEGWIT_MAX_SIZE
      ) {
        console.warn(FUTURE_SEGWIT_VERSION_WARNING);

        return bscript.compile([
          decodeBech32.version + FUTURE_SEGWIT_VERSION_DIFF,
          decodeBech32.data,
        ]);
      }
    }
  }

  throw new Error(address + ' has no matching Script');
}
