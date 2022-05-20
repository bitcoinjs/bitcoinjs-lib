import {
  PsbtInput,
  TapLeafScript,
  TapScriptSig,
} from 'bip174/src/lib/interfaces';

import {
  witnessStackToScriptWitness,
  pubkeyPositionInScript,
  isP2TR,
} from './psbtutils';
import {
  tweakKey,
  tapleafHash,
  rootHashFromPath,
} from '../payments/taprootutils';

export const toXOnly = (pubKey: Buffer) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

/**
 * Default tapscript finalizer. It searches for the `tapLeafHashToFinalize` if provided.
 * Otherwise it will search for the tapleaf that has at least one signature and has the shortest path.
 * @param inputIndex the position of the PSBT input.
 * @param input the PSBT input.
 * @param tapLeafHashToFinalize optional, if provided the finalizer will search for a tapleaf that has this hash
 *                              and will try to build the finalScriptWitness.
 * @returns the finalScriptWitness or throws an exception if no tapleaf found.
 */
export function tapScriptFinalizer(
  inputIndex: number,
  input: PsbtInput,
  tapLeafHashToFinalize?: Buffer,
): {
  finalScriptWitness: Buffer | undefined;
} {
  const tapLeaf = findTapLeafToFinalize(
    input,
    inputIndex,
    tapLeafHashToFinalize,
  );

  try {
    const sigs = sortSignatures(input, tapLeaf);
    const witness = sigs.concat(tapLeaf.script).concat(tapLeaf.controlBlock);
    return { finalScriptWitness: witnessStackToScriptWitness(witness) };
  } catch (err) {
    throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
  }
}

export function serializeTaprootSignature(
  sig: Buffer,
  sighashType?: number,
): Buffer {
  const sighashTypeByte = sighashType
    ? Buffer.from([sighashType!])
    : Buffer.from([]);

  return Buffer.concat([sig, sighashTypeByte]);
}

export function isTaprootInput(input: PsbtInput): boolean {
  return (
    input &&
    !!(
      input.tapInternalKey ||
      input.tapMerkleRoot ||
      (input.tapLeafScript && input.tapLeafScript.length) ||
      (input.tapBip32Derivation && input.tapBip32Derivation.length) ||
      (input.witnessUtxo && isP2TR(input.witnessUtxo.script))
    )
  );
}

export function checkTaprootInputFields(
  inputData: PsbtInput,
  newInputData: PsbtInput,
  action: string,
): void {
  checkMixedTaprootAndNonTaprootFields(inputData, newInputData, action);
  checkIfTapLeafInTree(inputData, newInputData, action);
}

export function tweakInternalPubKey(
  inputIndex: number,
  input: PsbtInput,
): Buffer {
  const tapInternalKey = input.tapInternalKey;
  const outputKey =
    tapInternalKey && tweakKey(tapInternalKey, input.tapMerkleRoot);

  if (!outputKey)
    throw new Error(
      `Cannot tweak tap internal key for input #${inputIndex}. Public key: ${tapInternalKey &&
        tapInternalKey.toString('hex')}`,
    );
  return outputKey.x;
}

function checkMixedTaprootAndNonTaprootFields(
  inputData: PsbtInput,
  newInputData: PsbtInput,
  action: string,
): void {
  const isBadTaprootUpdate =
    isTaprootInput(inputData) && hasNonTaprootInputFields(newInputData);
  const isBadNonTaprootUpdate =
    hasNonTaprootInputFields(inputData) && isTaprootInput(newInputData);
  const hasMixedFields =
    inputData === newInputData &&
    (isTaprootInput(newInputData) && hasNonTaprootInputFields(newInputData));

  if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
    throw new Error(
      `Invalid arguments for Psbt.${action}. ` +
        `Cannot use both taproot and non-taproot fields.`,
    );
}

function checkIfTapLeafInTree(
  inputData: PsbtInput,
  newInputData: PsbtInput,
  action: string,
): void {
  if (newInputData.tapMerkleRoot) {
    const newLeafsInTree = (newInputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, newInputData.tapMerkleRoot),
    );
    const oldLeafsInTree = (inputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, newInputData.tapMerkleRoot),
    );
    if (!newLeafsInTree || !oldLeafsInTree)
      throw new Error(
        `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`,
      );
  } else if (inputData.tapMerkleRoot) {
    const newLeafsInTree = (newInputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, inputData.tapMerkleRoot),
    );
    if (!newLeafsInTree)
      throw new Error(
        `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`,
      );
  }
}

function isTapLeafInTree(tapLeaf: TapLeafScript, merkleRoot?: Buffer): boolean {
  if (!merkleRoot) return true;

  const leafHash = tapleafHash({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });

  const rootHash = rootHashFromPath(tapLeaf.controlBlock, leafHash);
  return rootHash.equals(merkleRoot);
}

function sortSignatures(input: PsbtInput, tapLeaf: TapLeafScript): Buffer[] {
  const leafHash = tapleafHash({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });

  return (input.tapScriptSig || [])
    .filter(tss => tss.leafHash.equals(leafHash))
    .map(tss => addPubkeyPositionInScript(tapLeaf.script, tss))
    .sort((t1, t2) => t2.positionInScript - t1.positionInScript)
    .map(t => t.signature) as Buffer[];
}

function addPubkeyPositionInScript(
  script: Buffer,
  tss: TapScriptSig,
): TapScriptSigWitPosition {
  return Object.assign(
    {
      positionInScript: pubkeyPositionInScript(tss.pubkey, script),
    },
    tss,
  ) as TapScriptSigWitPosition;
}

/**
 * Find tapleaf by hash, or get the signed tapleaf with the shortest path.
 */
function findTapLeafToFinalize(
  input: PsbtInput,
  inputIndex: number,
  leafHashToFinalize?: Buffer,
): TapLeafScript {
  if (!input.tapScriptSig || !input.tapScriptSig.length)
    throw new Error(
      `Can not finalize taproot input #${inputIndex}. No tapleaf script signature provided.`,
    );
  const tapLeaf = (input.tapLeafScript || [])
    .sort((a, b) => a.controlBlock.length - b.controlBlock.length)
    .find(leaf =>
      canFinalizeLeaf(leaf, input.tapScriptSig!, leafHashToFinalize),
    );

  if (!tapLeaf)
    throw new Error(
      `Can not finalize taproot input #${inputIndex}. Signature for tapleaf script not found.`,
    );

  return tapLeaf;
}

function canFinalizeLeaf(
  leaf: TapLeafScript,
  tapScriptSig: TapScriptSig[],
  hash?: Buffer,
): boolean {
  const leafHash = tapleafHash({
    output: leaf.script,
    version: leaf.leafVersion,
  });
  const whiteListedHash = !hash || hash.equals(leafHash);
  return (
    whiteListedHash &&
    tapScriptSig!.find(tss => tss.leafHash.equals(leafHash)) !== undefined
  );
}

function hasNonTaprootInputFields(input: PsbtInput): boolean {
  return (
    input &&
    !!(
      input.redeemScript ||
      input.witnessScript ||
      (input.bip32Derivation && input.bip32Derivation.length)
    )
  );
}

interface TapScriptSigWitPosition extends TapScriptSig {
  positionInScript: number;
}
