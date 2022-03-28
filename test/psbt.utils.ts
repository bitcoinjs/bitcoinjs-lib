import { PsbtInput } from 'bip174/src/lib/interfaces';
import * as bitcoin from './..';

/**
 * Build finalizer function for Tapscript.
 * Usees the default Tapscript version (0xc0).
 * @returns finalizer function
 */
const buildTapscriptFinalizer = (
  internalPubkey: Buffer,
  scriptTree: any,
  network: bitcoin.networks.Network,
) => {
  return (
    inputIndex: number,
    input: PsbtInput,
    script: Buffer,
    _isSegwit: boolean,
    _isP2SH: boolean,
    _isP2WSH: boolean,
    _isTapscript: boolean,
  ): {
    finalScriptSig: Buffer | undefined;
    finalScriptWitness: Buffer | Buffer[] | undefined;
  } => {
    if (!internalPubkey || !scriptTree || !script)
      throw new Error(`Can not finalize taproot input #${inputIndex}`);

    try {
      const tapscriptSpend = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(internalPubkey),
        scriptTree,
        redeem: { output: script },
        network,
      });
      const sigs = (input.partialSig || []).map(ps => ps.signature) as Buffer[];
      const finalScriptWitness = sigs.concat(
        tapscriptSpend.witness as Buffer[],
      );
      return { finalScriptWitness, finalScriptSig: undefined };
    } catch (err) {
      throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
    }
  };
};

const toXOnly = (pubKey: Buffer) => pubKey.slice(1, 33);

export { buildTapscriptFinalizer, toXOnly };
