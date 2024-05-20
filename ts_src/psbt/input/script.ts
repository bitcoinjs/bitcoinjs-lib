import { PsbtInput } from 'bip174/src/lib/interfaces';
import { varuint } from '../../bufferutils';
import * as payments from '../../payments';
import { GetScriptReturn, PsbtCache, ScriptType } from '../interfaces';
import { nonWitnessUtxoTxFromCache } from '../global/cache';
import { hash160 } from '../../crypto';
import * as bscript from '../../script';
import { isPubkeyLike } from '../psbtutils';
import { isSigLike } from '../global/sign';

const { isP2MS, isP2PK, isP2PKH, isP2SHScript, isP2WPKH, isP2WSHScript } =
  payments;

export function getMeaningfulScript(
  script: Buffer,
  index: number,
  ioType: 'input' | 'output',
  redeemScript?: Buffer,
  witnessScript?: Buffer,
): {
  meaningfulScript: Buffer;
  type: 'p2sh' | 'p2wsh' | 'p2sh-p2wsh' | 'raw';
} {
  const isP2SH = isP2SHScript(script);
  const isP2SHP2WSH = isP2SH && redeemScript && isP2WSHScript(redeemScript);
  const isP2WSH = isP2WSHScript(script);

  if (isP2SH && redeemScript === undefined)
    throw new Error('scriptPubkey is P2SH but redeemScript missing');
  if ((isP2WSH || isP2SHP2WSH) && witnessScript === undefined)
    throw new Error(
      'scriptPubkey or redeemScript is P2WSH but witnessScript missing',
    );

  let meaningfulScript: Buffer;

  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript!;
    checkRedeemScript(index, script, redeemScript!, ioType);
    checkWitnessScript(index, redeemScript!, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2WSH) {
    meaningfulScript = witnessScript!;
    checkWitnessScript(index, script, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2SH) {
    meaningfulScript = redeemScript!;
    checkRedeemScript(index, script, redeemScript!, ioType);
  } else {
    meaningfulScript = script;
  }
  return {
    meaningfulScript,
    type: isP2SHP2WSH
      ? 'p2sh-p2wsh'
      : isP2SH
      ? 'p2sh'
      : isP2WSH
      ? 'p2wsh'
      : 'raw',
  };
}

export function checkInvalidP2WSH(script: Buffer): void {
  if (isP2WPKH(script) || isP2SHScript(script)) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH');
  }
}

export function classifyScript(script: Buffer): ScriptType {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}

export function scriptWitnessToWitnessStack(buffer: Buffer): Buffer[] {
  let offset = 0;

  function readSlice(n: number): Buffer {
    offset += n;
    return buffer.slice(offset - n, offset);
  }

  function readVarInt(): number {
    const vi = varuint.decode(buffer, offset);
    offset += (varuint.decode as any).bytes;
    return vi;
  }

  function readVarSlice(): Buffer {
    return readSlice(readVarInt());
  }

  function readVector(): Buffer[] {
    const count = readVarInt();
    const vector: Buffer[] = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }

  return readVector();
}

export function checkScriptForPubkey(
  pubkey: Buffer,
  script: Buffer,
  action: string,
): void {
  if (!pubkeyInScript(pubkey, script)) {
    throw new Error(
      `Can not ${action} for this input with the key ${pubkey.toString('hex')}`,
    );
  }
}

export function getScriptFromUtxo(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): Buffer {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return script;
}

export function getScriptAndAmountFromUtxo(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): { script: Buffer; value: number } {
  if (input.witnessUtxo !== undefined) {
    return {
      script: input.witnessUtxo.script,
      value: input.witnessUtxo.value,
    };
  } else if (input.nonWitnessUtxo !== undefined) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
    );
    const o = nonWitnessUtxoTx.outs[cache.__TX.ins[inputIndex].index];
    return { script: o.script, value: o.value };
  } else {
    throw new Error("Can't find pubkey in input without Utxo data");
  }
}

export function getScriptFromInput(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): GetScriptReturn {
  const unsignedTx = cache.__TX;
  const res: GetScriptReturn = {
    script: null,
    isSegwit: false,
    isP2SH: false,
    isP2WSH: false,
  };
  res.isP2SH = !!input.redeemScript;
  res.isP2WSH = !!input.witnessScript;
  if (input.witnessScript) {
    res.script = input.witnessScript;
  } else if (input.redeemScript) {
    res.script = input.redeemScript;
  } else {
    if (input.nonWitnessUtxo) {
      const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
        cache,
        input,
        inputIndex,
      );
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      res.script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    } else if (input.witnessUtxo) {
      res.script = input.witnessUtxo.script;
    }
  }
  if (input.witnessScript || isP2WPKH(res.script!)) {
    res.isSegwit = true;
  }
  return res;
}

/**
 * Converts a witness stack to a script witness.
 * @param witness The witness stack to convert.
 * @returns The converted script witness.
 */
export function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
  let buffer = Buffer.allocUnsafe(0);

  function writeSlice(slice: Buffer): void {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }

  function writeVarInt(i: number): void {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);

    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }

  function writeVarSlice(slice: Buffer): void {
    writeVarInt(slice.length);
    writeSlice(slice);
  }

  function writeVector(vector: Buffer[]): void {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }

  writeVector(witness);

  return buffer;
}

/**
 * Finds the position of a public key in a script.
 * @param pubkey The public key to search for.
 * @param script The script to search in.
 * @returns The index of the public key in the script, or -1 if not found.
 * @throws {Error} If there is an unknown script error.
 */
export function pubkeyPositionInScript(pubkey: Buffer, script: Buffer): number {
  const pubkeyHash = hash160(pubkey);
  const pubkeyXOnly = pubkey.slice(1, 33); // slice before calling?

  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');

  return decompiled.findIndex(element => {
    if (typeof element === 'number') return false;
    return (
      element.equals(pubkey) ||
      element.equals(pubkeyHash) ||
      element.equals(pubkeyXOnly)
    );
  });
}

/**
 * Checks if a public key is present in a script.
 * @param pubkey The public key to check.
 * @param script The script to search in.
 * @returns A boolean indicating whether the public key is present in the script.
 */
export function pubkeyInScript(pubkey: Buffer, script: Buffer): boolean {
  return pubkeyPositionInScript(pubkey, script) !== -1;
}

export function redeemFromFinalScriptSig(
  finalScript: Buffer | undefined,
): Buffer | undefined {
  if (!finalScript) return;
  const decomp = bscript.decompile(finalScript);
  if (!decomp) return;
  const lastItem = decomp[decomp.length - 1];
  if (
    !Buffer.isBuffer(lastItem) ||
    isPubkeyLike(lastItem) ||
    isSigLike(lastItem)
  )
    return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}

export function redeemFromFinalWitnessScript(
  finalScript: Buffer | undefined,
): Buffer | undefined {
  if (!finalScript) return;
  const decomp = scriptWitnessToWitnessStack(finalScript);
  const lastItem = decomp[decomp.length - 1];
  if (isPubkeyLike(lastItem)) return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}

function scriptCheckerFactory(
  payment: any,
  paymentScriptName: string,
): (idx: number, spk: Buffer, rs: Buffer, ioType: 'input' | 'output') => void {
  return (
    inputIndex: number,
    scriptPubKey: Buffer,
    redeemScript: Buffer,
    ioType: 'input' | 'output',
  ): void => {
    const redeemScriptOutput = payment({
      redeem: { output: redeemScript },
    }).output as Buffer;

    if (!scriptPubKey.equals(redeemScriptOutput)) {
      throw new Error(
        `${paymentScriptName} for ${ioType} #${inputIndex} doesn't match the scriptPubKey in the prevout`,
      );
    }
  };
}

const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');

const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);
