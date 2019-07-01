import { Psbt as PsbtBase } from 'bip174';
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { checkForInput } from 'bip174/src/lib/utils';
import * as classify from './classify';
import { Signer } from './ecpair';
import { Network } from './networks';
import * as payments from './payments';
import * as bscript from './script';
import { Transaction } from './transaction';

type ScriptCheckerFunction = (idx: number, spk: Buffer, rs: Buffer) => void;

const scriptCheckerFactory = (
  payment: any,
  paymentScriptName: string,
): ScriptCheckerFunction => (
  inputIndex: number,
  scriptPubKey: Buffer,
  redeemScript: Buffer,
): void => {
  const redeemScriptOutput = payment({
    redeem: { output: redeemScript },
  }).output as Buffer;

  if (!scriptPubKey.equals(redeemScriptOutput)) {
    throw new Error(
      `${paymentScriptName} for input #${inputIndex} doesn't match the scriptPubKey in the prevout`,
    );
  }
};

const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);

const isPayment = (script: Buffer, payment: any): boolean => {
  try {
    payment({ output: script });
    return true;
  } catch (err) {
    return false;
  }
};

function getScriptFromInput(
  inputIndex: number,
  input: PsbtInput,
  _unsignedTx: Buffer,
): Buffer | undefined {
  let script: Buffer;
  if (input.nonWitnessUtxo) {
    if (input.redeemScript) {
      script = input.redeemScript;
    } else {
      const unsignedTx = Transaction.fromBuffer(_unsignedTx);
      const nonWitnessUtxoTx = Transaction.fromBuffer(input.nonWitnessUtxo);
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    }
  } else if (input.witnessUtxo) {
    if (input.witnessScript) {
      script = input.witnessScript;
    } else if (input.redeemScript) {
      script = payments.p2pkh({ hash: input.redeemScript.slice(2) }).output!;
    } else {
      script = payments.p2pkh({ hash: input.witnessUtxo.script.slice(2) })
        .output!;
    }
  } else {
    return;
  }
  return script;
}

export class Psbt extends PsbtBase {
  constructor(public network?: Network) {
    super();
  }

  canFinalize(inputIndex: number): boolean {
    const input = checkForInput(this.inputs, inputIndex);
    const script = getScriptFromInput(
      inputIndex,
      input,
      this.globalMap.unsignedTx!,
    );
    if (!script) return false;
    const scriptType = classify.output(script);
    switch (scriptType) {
      case 'pubkey':
        return false;
      case 'pubkeyhash':
        return false;
      case 'multisig':
        return false;
      case 'witnesspubkeyhash':
        return false;
      default:
        return false;
    }
  }

  signInput(inputIndex: number, keyPair: Signer): Psbt {
    // TODO: Implement BIP174 pre-sign checks:
    // https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#signer
    //
    // if non_witness_utxo.exists:
    //     assert(sha256d(non_witness_utxo) == psbt.tx.innput[i].prevout.hash)
    //     if redeemScript.exists:
    //         assert(non_witness_utxo.vout[psbt.tx.input[i].prevout.n].scriptPubKey == P2SH(redeemScript))
    //         sign_non_witness(redeemScript)
    //     else:
    //         sign_non_witness(non_witness_utxo.vout[psbt.tx.input[i].prevout.n].scriptPubKey)
    // else if witness_utxo.exists:
    //     if redeemScript.exists:
    //         assert(witness_utxo.scriptPubKey == P2SH(redeemScript))
    //         script = redeemScript
    //     else:
    //         script = witness_utxo.scriptPubKey
    //     if IsP2WPKH(script):
    //         sign_witness(P2PKH(script[2:22]))
    //     else if IsP2WSH(script):
    //         assert(script == P2WSH(witnessScript))
    //         sign_witness(witnessScript)
    // else:
    //     assert False

    const input = this.inputs[inputIndex];
    if (input === undefined) throw new Error(`No input #${inputIndex}`);

    const unsignedTx = Transaction.fromBuffer(this.globalMap.unsignedTx!);
    const sighashType = input.sighashType || 0x01;
    let hash: Buffer;

    if (input.nonWitnessUtxo) {
      const nonWitnessUtxoTx = Transaction.fromBuffer(input.nonWitnessUtxo);

      const prevoutHash = unsignedTx.ins[inputIndex].hash;
      const utxoHash = nonWitnessUtxoTx.getHash();

      // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
      if (!prevoutHash.equals(utxoHash)) {
        throw new Error(
          `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
        );
      }

      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      const prevout = nonWitnessUtxoTx.outs[prevoutIndex];

      if (input.redeemScript) {
        // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
        checkRedeemScript(inputIndex, prevout.script, input.redeemScript);
        hash = unsignedTx.hashForSignature(
          inputIndex,
          input.redeemScript,
          sighashType,
        );
      } else {
        hash = unsignedTx.hashForSignature(
          inputIndex,
          prevout.script,
          sighashType,
        );
      }
    } else if (input.witnessUtxo) {
      let script: Buffer;
      if (input.redeemScript) {
        // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
        checkRedeemScript(
          inputIndex,
          input.witnessUtxo.script,
          input.redeemScript,
        );
        script = input.redeemScript;
      } else {
        script = input.witnessUtxo.script;
      }
      if (isPayment(script, payments.p2wpkh)) {
        // P2WPKH uses the P2PKH template for prevoutScript when signing
        const signingScript = payments.p2pkh({ hash: script.slice(2) }).output!;
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          signingScript,
          input.witnessUtxo.value,
          sighashType,
        );
      } else {
        if (!input.witnessScript)
          throw new Error('Segwit input needs witnessScript if not P2WPKH');
        checkWitnessScript(inputIndex, script, input.witnessScript);
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          script,
          input.witnessUtxo.value,
          sighashType,
        );
      }
    } else {
      throw new Error('Need a Utxo input item for signing');
    }

    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };

    return this.addPartialSigToInput(inputIndex, partialSig);
  }
}
