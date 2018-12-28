// m [pubKeys ...] n OP_CHECKMULTISIG

import * as bscript from '../../script'
import * as types from '../../types'
const OPS = require('bitcoin-ops')
const OP_INT_BASE = OPS.OP_RESERVED // OP_1 - 1

export function check (script: Buffer | Array<number | Buffer>, allowIncomplete?: boolean): boolean {
  const chunks = bscript.decompile(script)

  if (chunks.length < 4) return false
  if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG) return false
  if (!types.Number(chunks[0])) return false
  if (!types.Number(chunks[chunks.length - 2])) return false
  const m = <number>chunks[0] - OP_INT_BASE
  const n = <number>chunks[chunks.length - 2] - OP_INT_BASE

  if (m <= 0) return false
  if (n > 16) return false
  if (m > n) return false
  if (n !== chunks.length - 3) return false
  if (allowIncomplete) return true

  const keys = <Array<Buffer>> chunks.slice(1, -2)
  return keys.every(bscript.isCanonicalPubKey)
}
check.toJSON = function () { return 'multi-sig output' }
