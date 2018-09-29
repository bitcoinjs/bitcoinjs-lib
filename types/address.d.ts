import { Network } from './network'

export namespace address {
  function fromBase58Check(address: string): { hash: Buffer; version: number }

  /** @since 3.2.0 */
  function fromBech32(
    address: string
  ): { data: Buffer; prefix: string; version: number }

  function fromOutputScript(output: Buffer, network?: Network): string

  function toBase58Check(hash: Buffer, version: number): string

  /** @since 3.2.0 */
  function toBech32(data: Buffer, version: number, prefix: string): string

  function toOutputScript(address: string, network?: Network): Buffer
}
