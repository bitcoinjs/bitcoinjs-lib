// {signature} {pubKey}

import * as bscript from '../../script'

function isCompressedCanonicalPubKey (pubKey: Buffer): boolean {
  return bscript.isCanonicalPubKey(pubKey) && pubKey.length === 33
}

export function check (script: Buffer | Array<number | Buffer>): boolean {
  const chunks = <Array<number | Buffer>>bscript.decompile(script)

  return chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(<Buffer>chunks[0]) &&
    isCompressedCanonicalPubKey(<Buffer>chunks[1])
}
check.toJSON = function () { return 'witnessPubKeyHash input' }
