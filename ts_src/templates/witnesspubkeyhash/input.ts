// {signature} {pubKey}

import { Stack } from '../../payments';
import * as bscript from '../../script';

function isCompressedCanonicalPubKey(pubKey: Buffer): boolean {
  return bscript.isCanonicalPubKey(pubKey) && pubKey.length === 33;
}

export function check(script: Buffer | Stack): boolean {
  const chunks = bscript.decompile(script) as Stack;

  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(chunks[0] as Buffer) &&
    isCompressedCanonicalPubKey(chunks[1] as Buffer)
  );
}
check.toJSON = (): string => {
  return 'witnessPubKeyHash input';
};
