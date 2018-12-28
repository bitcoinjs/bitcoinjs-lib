// {pubKey} OP_CHECKSIG

import * as bscript from '../../script'
const OPS = require('bitcoin-ops')

export function check (script: Buffer | Array<number | Buffer>): boolean {
  const chunks = <Array<number | Buffer>>bscript.decompile(script)

  return chunks.length === 2 &&
    bscript.isCanonicalPubKey(<Buffer>chunks[0]) &&
    chunks[1] === OPS.OP_CHECKSIG
}
check.toJSON = function () { return 'pubKey output' }
