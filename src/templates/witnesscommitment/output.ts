// OP_RETURN {aa21a9ed} {commitment}

import * as bscript from '../../script'
import * as types from '../../types'
const Buffer = require('safe-buffer').Buffer
const typeforce = require('typeforce')
const OPS = require('bitcoin-ops')

const HEADER: Buffer = Buffer.from('aa21a9ed', 'hex')

export function check (script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script)

  return buffer.length > 37 &&
    buffer[0] === OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).equals(HEADER)
}

check.toJSON = function () { return 'Witness commitment output' }

export function encode (commitment: Buffer): Buffer {
  typeforce(types.Hash256bit, commitment)

  const buffer = Buffer.allocUnsafe(36)
  HEADER.copy(buffer, 0)
  commitment.copy(buffer, 4)

  return bscript.compile([OPS.OP_RETURN, buffer])
}

export function decode (buffer: Buffer): Buffer {
  typeforce(check, buffer)

  return (<Buffer>bscript.decompile(buffer)[1]).slice(4, 36)
}
