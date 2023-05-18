import * as bitcoin from '../../src/index';
import { RegtestUtils } from '@bitcoin-computer/nakamotojs-client';

const APIPASS = process.env.APIPASS || 'satoshi';
const APIURL = process.env.APIURL || 'http://localhost:5001/1';

export const regtestUtils = new RegtestUtils({ APIPASS, APIURL });
export const regtestLitecoinUtils = new RegtestUtils({
  APIPASS,
  APIURL,
  network: bitcoin.networks.litecoinregtest,
});
