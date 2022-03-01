// SegWit version 1 P2TR output type for Taproot defined in
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki

import { bitcoin as BITCOIN_NETWORK } from '../networks';
import { isXOnlyPoint } from '../schnorrBip340';
import * as bscript from '../script';
import * as taproot from '../taproot';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
const typef = require('typeforce');
const OPS = bscript.OPS;

const { bech32m } = require('bech32');

/**
 * A secp256k1 x coordinate with unknown discrete logarithm used for eliminating
 * keypath spends, equal to SHA256(uncompressedDER(SECP256K1_GENERATOR_POINT)).
 */
const H = Buffer.from(
  '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
  'hex',
);
const EMPTY_BUFFER = Buffer.alloc(0);

// output: OP_1 {witnessProgram}
export function p2tr(a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.address &&
    !a.pubkey &&
    !a.pubkeys &&
    !(a.redeems && a.redeems.length) &&
    !a.output &&
    !a.witness
  )
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      network: typef.maybe(typef.Object),

      address: typef.maybe(typef.String),
      // the output script should be a fixed 34 bytes.
      // 1 byte for OP_1 indicating segwit version 1, one byte for 0x20 to push
      // the next 32 bytes, followed by the 32 byte witness program
      output: typef.maybe(typef.BufferN(34)),
      // a single pubkey
      pubkey: typef.maybe(isXOnlyPoint),
      // the pub key(s) used for keypath signing.
      // aggregated with MuSig2* if > 1
      pubkeys: typef.maybe(typef.arrayOf(isXOnlyPoint)),

      redeems: typef.maybe(
        typef.arrayOf({
          network: typef.maybe(typef.Object),
          output: typef.maybe(typef.Buffer),
          weight: typef.maybe(typef.Number),
          witness: typef.maybe(typef.arrayOf(typef.Buffer)),
        }),
      ),
      redeemIndex: typef.maybe(typef.Number), // Selects the redeem to spend

      signature: typef.maybe(bscript.isCanonicalSchnorrSignature),
      controlBlock: typef.maybe(typef.Buffer),
      annex: typef.maybe(typef.Buffer),
    },
    a,
  );

  const _address = lazy.value(() => {
    if (!a.address) return undefined;

    const result = bech32m.decode(a.address);
    const version = result.words.shift();
    const data = bech32m.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Buffer.from(data),
    };
  });
  const _outputPubkey = lazy.value(() => {
    // we remove the first two bytes (OP_1 0x20) from the output script to
    // extract the 32 byte taproot pubkey (aka witness program)
    return a.output && a.output.slice(2);
  });
  const _taptree = lazy.value(() => {
    if (!a.redeems) return;
    const outputs: Array<Buffer | undefined> = a.redeems.map(
      ({ output }) => output,
    );
    if (!outputs.every(output => output)) return;
    return taproot.getHuffmanTaptree(
      outputs as Buffer[],
      a.redeems.map(({ weight }) => weight),
    );
  });
  const _parsedWitness = lazy.value(() => {
    if (!a.witness) return;
    return taproot.parseTaprootWitness(a.witness);
  });
  const _parsedControlBlock = lazy.value(() => {
    // Can't use o.controlBlock, because it could be circular
    if (a.controlBlock) return taproot.parseControlBlock(a.controlBlock);
    const parsedWitness = _parsedWitness();
    if (parsedWitness && parsedWitness.spendType === 'Script')
      return taproot.parseControlBlock(parsedWitness.controlBlock);
  });
  const _internalPubkey = lazy.value(() => {
    if (a.pubkey) {
      // single pubkey
      return a.pubkey;
    } else if (a.pubkeys && a.pubkeys.length === 1) {
      return a.pubkeys[0];
    } else if (a.pubkeys && a.pubkeys.length > 1) {
      // multiple pubkeys
      return taproot.aggregateMuSigPubkeys(a.pubkeys);
    } else if (_parsedControlBlock()) {
      return _parsedControlBlock()!.internalPubkey;
    } else {
      // If there is no key path spending condition, we use an internal key with unknown secret key.
      // TODO: In order to avoid leaking the information that key path spending is not possible it
      // is recommended to pick a fresh integer r in the range 0...n-1 uniformly at random and use
      // H + rG as internal key. It is possible to prove that this internal key does not have a
      // known discrete logarithm with respect to G by revealing r to a verifier who can then
      // reconstruct how the internal key was created.
      return H;
    }
  });
  const _taprootPubkey = lazy.value(() => {
    const parsedControlBlock = _parsedControlBlock();
    const parsedWitness = _parsedWitness();
    // Refuse to create an unspendable key
    if (
      !a.pubkey &&
      !(a.pubkeys && a.pubkeys.length) &&
      !a.redeems &&
      !parsedControlBlock
    )
      return;
    let taptreeRoot;
    // Prefer to get the root via the control block because not all redeems may
    // be available
    if (parsedControlBlock) {
      let tapscript;
      if (parsedWitness && parsedWitness.spendType === 'Script') {
        tapscript = parsedWitness.tapscript;
      } else if (o.redeem && o.redeem.output) {
        tapscript = o.redeem.output;
      }
      if (tapscript)
        taptreeRoot = taproot.getTaptreeRoot(parsedControlBlock, tapscript);
    }
    if (!taptreeRoot && _taptree()) taptreeRoot = _taptree()!.root;

    return taproot.tapTweakPubkey(_internalPubkey(), taptreeRoot);
  });

  const network = a.network || BITCOIN_NETWORK;

  const o: Payment = { network };

  lazy.prop(o, 'address', () => {
    const pubkey =
      _outputPubkey() || (_taprootPubkey() && _taprootPubkey()!.pubkey);
    // only encode the 32 byte witness program as bech32m
    const words = bech32m.toWords(pubkey);
    words.unshift(0x01);
    return bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'controlBlock', () => {
    const parsedWitness = _parsedWitness();
    if (parsedWitness && parsedWitness.spendType === 'Script')
      return parsedWitness.controlBlock;
    const taprootPubkey = _taprootPubkey();
    const taptree = _taptree();
    if (!taptree || !taprootPubkey || a.redeemIndex === undefined) return;
    return taproot.getControlBlock(
      taprootPubkey.parity,
      _internalPubkey(),
      taptree.paths[a.redeemIndex],
    );
  });
  lazy.prop(o, 'signature', () => {
    const parsedWitness = _parsedWitness();
    if (parsedWitness && parsedWitness.spendType === 'Key')
      return parsedWitness.signature;
  });
  lazy.prop(o, 'annex', () => {
    if (!_parsedWitness()) return;
    return _parsedWitness()!.annex;
  });
  lazy.prop(o, 'output', () => {
    if (a.address) {
      const { data } = _address()!;
      return bscript.compile([OPS.OP_1, data]);
    }

    const taprootPubkey = _taprootPubkey();
    if (!taprootPubkey) return;

    // OP_1 indicates segwit version 1
    return bscript.compile([OPS.OP_1, taprootPubkey.pubkey]);
  });
  lazy.prop(o, 'witness', () => {
    if (!a.redeems) {
      if (a.signature) return [a.signature]; // Keypath spend
      return;
    } else if (!o.redeem) {
      return; // No chosen redeem script, can't make witness
    } else if (!o.controlBlock) {
      return;
    }

    let redeemWitness;
    // some callers may provide witness elements in the input script
    if (
      o.redeem.input &&
      o.redeem.input.length > 0 &&
      o.redeem.output &&
      o.redeem.output.length > 0
    ) {
      // transform redeem input to witness stack
      redeemWitness = bscript.toStack(bscript.decompile(o.redeem.input)!);

      // assigns a new object to o.redeem
      o.redeems![a.redeemIndex!] = Object.assign(
        { witness: redeemWitness },
        o.redeem,
      );
      o.redeem.input = EMPTY_BUFFER;
    } else if (
      o.redeem.output &&
      o.redeem.output.length > 0 &&
      o.redeem.witness &&
      o.redeem.witness.length > 0
    ) {
      redeemWitness = o.redeem.witness;
    } else {
      return;
    }

    const witness = [...redeemWitness, o.redeem.output, o.controlBlock];

    if (a.annex) {
      witness.push(a.annex);
    }

    return witness;
  });
  lazy.prop(o, 'name', () => {
    const nameParts = ['p2tr'];
    return nameParts.join('-');
  });
  lazy.prop(o, 'redeem', () => {
    if (a.redeems) {
      if (a.redeemIndex === undefined) return;
      return a.redeems[a.redeemIndex];
    }
    const parsedWitness = _parsedWitness();
    if (parsedWitness && parsedWitness.spendType === 'Script')
      return {
        witness: parsedWitness.scriptSig,
        output: parsedWitness.tapscript,
      };
  });

  // extended validation
  if (opts.validate) {
    const taprootPubkey = _taprootPubkey();

    if (a.output) {
      if (a.output[0] !== OPS.OP_1 || a.output[1] !== 0x20)
        throw new TypeError('Output is invalid');

      // if we're passed both an output script and an address, ensure they match
      if (a.address && !_outputPubkey()!.equals(_address()!.data))
        throw new TypeError('mismatch between address & output');

      if (taprootPubkey && !_outputPubkey()!.equals(taprootPubkey.pubkey))
        throw new TypeError('mismatch between output and taproot pubkey');
    }

    if (a.address)
      if (taprootPubkey && !_address()!.data.equals(taprootPubkey.pubkey))
        throw new TypeError('mismatch between address and taproot pubkey');

    const parsedControlBlock = _parsedControlBlock();
    if (parsedControlBlock) {
      if (!parsedControlBlock.internalPubkey.equals(_internalPubkey()))
        throw new TypeError('Internal pubkey mismatch');
      if (taprootPubkey && parsedControlBlock.parity !== taprootPubkey.parity)
        throw new TypeError('Parity mismatch');
    }

    if (a.redeems) {
      if (!a.redeems.length) throw new TypeError('Empty redeems');
      if (
        a.redeemIndex !== undefined &&
        (a.redeemIndex < 0 || a.redeemIndex >= a.redeems.length)
      ) {
        throw new TypeError('invalid redeem index');
      }
      a.redeems.forEach(redeem => {
        if (redeem.network && redeem.network !== network)
          throw new TypeError('Network mismatch');
      });
    }

    const chosenRedeem =
      a.redeems && a.redeemIndex !== undefined && a.redeems[a.redeemIndex];

    const parsedWitness = _parsedWitness();
    if (parsedWitness && parsedWitness.spendType === 'Key') {
      if (a.controlBlock)
        throw new TypeError('unexpected control block for key path');

      if (a.signature && !a.signature.equals(parsedWitness.signature))
        throw new TypeError('mismatch between witness & signature');
    }
    if (parsedWitness && parsedWitness.spendType === 'Script') {
      if (a.signature)
        throw new TypeError('unexpected signature with script path witness');

      if (a.controlBlock && !a.controlBlock.equals(parsedWitness.controlBlock))
        throw new TypeError('control block mismatch');

      if (
        a.annex &&
        parsedWitness.annex &&
        !a.annex.equals(parsedWitness.annex)
      )
        throw new TypeError('annex mismatch');

      if (
        chosenRedeem &&
        chosenRedeem.output &&
        !chosenRedeem.output.equals(parsedWitness.tapscript)
      )
        throw new TypeError('tapscript mismatch');
    }
  }

  return Object.assign(o, a);
}
