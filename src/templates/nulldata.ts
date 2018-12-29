// OP_RETURN {data}
import * as bscript from '../script'
import { OPS } from '../script'

export function check (script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script)

  return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}
check.toJSON = function () { return 'null data output' }

const output = { check }

export {
  output
}
