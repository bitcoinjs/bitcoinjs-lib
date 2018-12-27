const opcodes = require('bitcoin-ops')

import { Block } from './block'
import * as ECPair from './ecpair'
import * as Transaction from './transaction'
import * as TransactionBuilder from './transaction_builder'
import * as address from './address'
import * as bip32 from 'bip32'
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
