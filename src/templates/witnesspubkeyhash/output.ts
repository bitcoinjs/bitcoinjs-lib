// OP_0 {pubKeyHash}

import * as bscript from '../../script'
const OPS = require('bitcoin-ops')

export function check (script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script)

  return buffer.length === 22 &&
    buffer[0] === OPS.OP_0 &&
    buffer[1] === 0x14
}
check.toJSON = function () { return 'Witness pubKeyHash output' }
