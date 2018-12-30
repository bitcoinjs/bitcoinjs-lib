const bip32 = require('bip32')

import { Block } from './block'
import * as ECPair from './ecpair'
import { Transaction } from './transaction'
import { TransactionBuilder } from './transaction_builder'
import * as address from './address'
import * as crypto from './crypto'
import * as networks from './networks'
import * as payments from './payments'
import * as script from './script'
import { OPS as opcodes } from './script'

export {
  Block,
  ECPair,
  Transaction,
  TransactionBuilder,
  address,
  bip32,
  crypto,
  networks,
  opcodes,
  payments,
  script,
}

export { Payment, PaymentOpts } from './payments'
export { Input as TxInput, Output as TxOutput } from './transaction'
export { Network } from './networks'
export { OpCode } from './script'
