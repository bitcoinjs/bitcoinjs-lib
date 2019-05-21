'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const script_1 = require('./script');
const multisig = require('./templates/multisig');
const nullData = require('./templates/nulldata');
const pubKey = require('./templates/pubkey');
const pubKeyHash = require('./templates/pubkeyhash');
const scriptHash = require('./templates/scripthash');
const witnessCommitment = require('./templates/witnesscommitment');
const witnessPubKeyHash = require('./templates/witnesspubkeyhash');
const witnessScriptHash = require('./templates/witnessscripthash');
const types = {
  P2MS: 'multisig',
  NONSTANDARD: 'nonstandard',
  NULLDATA: 'nulldata',
  P2PK: 'pubkey',
  P2PKH: 'pubkeyhash',
  P2SH: 'scripthash',
  P2WPKH: 'witnesspubkeyhash',
  P2WSH: 'witnessscripthash',
  WITNESS_COMMITMENT: 'witnesscommitment',
};
exports.types = types;
function classifyOutput(script) {
  if (witnessPubKeyHash.output.check(script)) return types.P2WPKH;
  if (witnessScriptHash.output.check(script)) return types.P2WSH;
  if (pubKeyHash.output.check(script)) return types.P2PKH;
  if (scriptHash.output.check(script)) return types.P2SH;
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (multisig.output.check(chunks)) return types.P2MS;
  if (pubKey.output.check(chunks)) return types.P2PK;
  if (witnessCommitment.output.check(chunks)) return types.WITNESS_COMMITMENT;
  if (nullData.output.check(chunks)) return types.NULLDATA;
  return types.NONSTANDARD;
}
exports.output = classifyOutput;
function classifyInput(script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (pubKeyHash.input.check(chunks)) return types.P2PKH;
  if (scriptHash.input.check(chunks, allowIncomplete)) return types.P2SH;
  if (multisig.input.check(chunks, allowIncomplete)) return types.P2MS;
  if (pubKey.input.check(chunks)) return types.P2PK;
  return types.NONSTANDARD;
}
exports.input = classifyInput;
function classifyWitness(script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (witnessPubKeyHash.input.check(chunks)) return types.P2WPKH;
  if (witnessScriptHash.input.check(chunks, allowIncomplete))
    return types.P2WSH;
  return types.NONSTANDARD;
}
exports.witness = classifyWitness;
