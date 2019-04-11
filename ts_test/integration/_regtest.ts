import * as assert from 'assert';
import * as bitcoin from '../..';
import { Network } from '../..';

interface ECPairInterface {
  compressed: boolean;
  network: Network;
  privateKey?: Buffer;
  publicKey?: Buffer;
  toWIF(): string;
  sign(hash: Buffer): Buffer;
  verify(hash: Buffer, signature: Buffer): Buffer;
  getPublicKey?(): Buffer;
}

type DhttpResponse = Unspent[] | Request | string | number | void | null;

interface Unspent {
  value: number;
  txId: string;
  vout: number;
  address?: string;
  height?: number;
}

interface Input {
  txId: string;
  vout: number;
  script: string;
  sequence: string;
}

interface Output {
  value: number;
  script: string;
  address?: string;
}

interface Request {
  method?: string;
  url?: string;
  body?: string;
}

interface Transaction {
  txId: string;
  txHex: string;
  vsize: number;
  version: number;
  locktime: number;
  ins: Input[];
  outs: Output[];
}

const dhttpCallback = require('dhttp/200');
// use Promises
export const dhttp = (options: Request): Promise<DhttpResponse> =>
  // @ts-ignore
  new Promise(
    (resolve, reject): void => {
      return dhttpCallback(options, (err: Error, data: DhttpResponse) => {
        if (err) return reject(err);
        else return resolve(data);
      });
    },
  );

const APIPASS = process.env.APIPASS || 'satoshi';
const APIURL = process.env.APIURL || 'https://regtest.bitbank.cc/1';
const NETWORK = bitcoin.networks.testnet;

export function broadcast(txHex: string): Promise<null> {
  return dhttp({
    method: 'POST',
    url: APIURL + '/t/push',
    body: txHex,
  }) as Promise<null>;
}

export function mine(count: number): Promise<string[]> {
  return dhttp({
    method: 'POST',
    url: `${APIURL}/r/generate?count=${count}&key=${APIPASS}`,
  }) as Promise<string[]>;
}

export function height(): Promise<number> {
  return dhttp({
    method: 'GET',
    url: APIURL + '/b/best/height',
  }) as Promise<number>;
}

export function fetch(txId: string): Promise<Transaction> {
  return dhttp({
    method: 'GET',
    url: `${APIURL}/t/${txId}/json`,
  }) as Promise<Transaction>;
}

export function unspents(address: string): Promise<Unspent[]> {
  return dhttp({
    method: 'GET',
    url: `${APIURL}/a/${address}/unspents`,
  }) as Promise<Unspent[]>;
}

function _faucetRequest(address: string, value: number): Promise<string> {
  return dhttp({
    method: 'POST',
    url: `${APIURL}/r/faucet?address=${address}&value=${value}&key=${APIPASS}`,
  }) as Promise<string>;
}

// @ts-ignore
export async function faucet(address: string, value: number): Promise<Unspent> {
  let count = 0;
  let _unspents: Unspent[] = [];
  const sleep = (ms: number): Promise<void> =>
    // @ts-ignore
    new Promise((resolve): number => setTimeout(resolve, ms));
  const randInt = (min: number, max: number): number =>
    min + Math.floor((max - min + 1) * Math.random());
  while (_unspents.length === 0) {
    if (count > 0) {
      if (count >= 5) throw new Error('Missing Inputs');
      console.log('Missing Inputs, retry #' + count);
      await sleep(randInt(150, 250));
    }

    const txId = await _faucetRequest(address, value).then(
      v => v, // Pass success value as is
      async err => {
        // Bad Request error is fixed by making sure height is >= 432
        const currentHeight = (await height()) as number;
        if (err.message === 'Bad Request' && currentHeight < 432) {
          await mine(432 - currentHeight);
          return _faucetRequest(address, value);
        } else if (err.message === 'Bad Request' && currentHeight >= 432) {
          return _faucetRequest(address, value);
        } else {
          throw err;
        }
      },
    );

    await sleep(randInt(50, 150));

    const results = await unspents(address);

    _unspents = results.filter(x => x.txId === txId);

    count++;
  }

  return _unspents.pop()!;
}

export async function faucetComplex(
  output: string | Buffer,
  value: number,
  // @ts-ignore
): Promise<Unspent> {
  const keyPair = bitcoin.ECPair.makeRandom({ network: NETWORK });
  const p2pkh = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: NETWORK,
  });

  const unspent = await faucet(p2pkh.address!, value * 2);

  const txvb = new bitcoin.TransactionBuilder(NETWORK);
  txvb.addInput(unspent.txId, unspent.vout, undefined, p2pkh.output!);
  txvb.addOutput(output, value);
  txvb.sign(0, keyPair);
  const txv = txvb.build();

  await broadcast(txv.toHex());

  return {
    height: -1,
    txId: txv.getId(),
    vout: 0,
    value,
  };
}

// @ts-ignore
export async function verify(txo: Unspent): Promise<void> {
  const tx = await fetch(txo.txId);

  const txoActual = tx.outs[txo.vout];
  if (txo.address) assert.strictEqual(txoActual.address, txo.address);
  if (txo.value) assert.strictEqual(txoActual.value, txo.value);
}

function getAddress(node: ECPairInterface, myNetwork: Network): string {
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network: myNetwork })
    .address!;
}

export function randomAddress(): string {
  return getAddress(
    bitcoin.ECPair.makeRandom({
      network: bitcoin.networks.testnet,
    }),
    bitcoin.networks.testnet,
  );
}

export const RANDOM_ADDRESS = randomAddress();

export const network = NETWORK;
