import { decodePsbt } from 'bip174';
import { Network } from './networks';
import * as networks from './networks';
import { decompile } from './script';
import { Transaction } from './transaction';
import { TransactionBuilder } from './transaction_builder';

export class TransactionBuilderV2 extends TransactionBuilder {
  static fromPsbtString(
    psbtString: string,
    network?: Network,
  ): TransactionBuilder {
    const { unsigned_transaction, inputs } = decodePsbt({
      psbt: Buffer.from(psbtString, 'base64').toString('hex'),
    });

    const tx = Transaction.fromHex(unsigned_transaction!);

    inputs.forEach((input, vin) => {
      if (input.final_scriptsig) {
        tx.setInputScript(vin, Buffer.from(input.final_scriptsig, 'hex'));
      }

      if (input.final_scriptwitness) {
        const finalScriptWitness = Buffer.from(
          input.final_scriptwitness,
          'hex',
        );

        const witnessElements = (decompile(finalScriptWitness) as []).map(
          chunk => {
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
          },
        );

        tx.setWitness(vin, decompile(witnessElements) as []);
      }
    });

    // TODO: Store reference to imported PSBT so we we can merge metadata into the PSBT we export from toPsbtString()

    return TransactionBuilder.fromTransaction(tx, network);
  }

  constructor(
    public network: Network = networks.bitcoin,
    public maximumFeeRate: number = 2500,
  ) {
    super(network, maximumFeeRate);
  }
}
