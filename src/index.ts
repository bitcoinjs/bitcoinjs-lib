const opcodes = require('bitcoin-ops')
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
