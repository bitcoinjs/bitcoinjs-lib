/** 
 * These types were originally written by 
 * Mohamed Hegazy https://github.com/mhegazy,
 * Daniel https://github.com/dlebrecht, 
 * Ron Buckton https://github.com/rbuckton, 
 * Satana Charuwichitratana https://github.com/micksatana, 
 * Youssef GHOUBACH https://github.com/youssefgh, 
 * Kento https://github.com/kento1218.
 */

import { Network } from './network'

export namespace address {
  function fromBase58Check(address: string): { hash: Buffer; version: number }

  function fromBech32(
    address: string
  ): { data: Buffer; prefix: string; version: number }

  function fromOutputScript(output: Buffer, network?: Network): string

  function toBase58Check(hash: Buffer, version: number): string

  function toBech32(data: Buffer, version: number, prefix: string): string

  function toOutputScript(address: string, network?: Network): Buffer
}
