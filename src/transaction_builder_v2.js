'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
const networks = require('./networks');
const script_1 = require('./script');
const transaction_1 = require('./transaction');
const transaction_builder_1 = require('./transaction_builder');
class TransactionBuilderV2 extends transaction_builder_1.TransactionBuilder {
  constructor(network = networks.bitcoin, maximumFeeRate = 2500) {
    super(network, maximumFeeRate);
    this.network = network;
    this.maximumFeeRate = maximumFeeRate;
  }
  static fromPsbtString(psbtString, network) {
    const { unsigned_transaction, inputs } = bip174_1.decodePsbt({
      psbt: Buffer.from(psbtString, 'base64').toString('hex'),
    });
    const tx = transaction_1.Transaction.fromHex(unsigned_transaction);
    inputs.forEach((input, vin) => {
      if (input.final_scriptsig) {
        tx.setInputScript(vin, Buffer.from(input.final_scriptsig, 'hex'));
      }
      if (input.final_scriptwitness) {
        const finalScriptWitness = Buffer.from(
          input.final_scriptwitness,
          'hex',
        );
        const witnessElements = script_1
          .decompile(finalScriptWitness)
          .map(chunk => {
            if (!chunk) {
              // TODO: Check why/if this is needed.
              // Do we really want to return <Buffer > instead of <Buffer 00> when `chunk` is 0/0x00/OP_0/OP_FALSE?
              // tslint:disable-next-line:max-line-length
              // Copied from: https://github.com/bitcoinjs/bip174/blob/a00379750b41be799d822d060457a6580b7e41db/src/extract_transaction.js#L42
              return Buffer.from([]);
            }
            if (Buffer.isBuffer(chunk)) {
              return chunk;
            }
            return Buffer.from([chunk]);
          });
        tx.setWitness(vin, script_1.decompile(witnessElements));
      }
    });
    // TODO: Store reference to imported PSBT so we we can merge metadata into the PSBT we export from toPsbtString()
    return transaction_builder_1.TransactionBuilder.fromTransaction(
      tx,
      network,
    );
  }
}
exports.TransactionBuilderV2 = TransactionBuilderV2;
