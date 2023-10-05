/// <reference types="node" />
/**
 * bitcoin address decode and encode tools, include base58、bech32 and output script
 *
 * networks support bitcoin、litecoin、bitcoin testnet、litecoin testnet、bitcoin regtest、litecoin regtest and so on
 *
 * addresses support P2PKH、P2SH、P2WPKH、P2WSH、P2TR and so on
 *
 * @packageDocumentation
 */
import { Network } from './networks';
/** base58check decode result */
export interface Base58CheckResult {
    /** address hash */
    hash: Buffer;
    /** address version: 0x00 for P2PKH, 0x05 for P2SH */
    version: number;
}
/** bech32 decode result */
export interface Bech32Result {
    /** address version: 0x00 for P2WPKH、P2WSH, 0x01 for P2TR*/
    version: number;
    /** address prefix: bc for P2WPKH、P2WSH、P2TR */
    prefix: string;
    /** address data：20 bytes for P2WPKH, 32 bytes for P2WSH、P2TR */
    data: Buffer;
}
/**
 * decode address with base58 specification,  return address version and address hash if valid
 * @example
 * ```ts
 * // valid case
 * fromBase58Check('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH')
 * // => {version: 0, hash: <Buffer 75 1e 76 e8 19 91 96 d4 54 94 1c 45 d1 b3 a3 23 f1 43 3b d6>}
 *
 * // invalid case: address is too short
 * fromBase58Check('7SeEnXWPaCCALbVrTnszCVGfRU8cGfx')
 * // => throw new TypeError('7SeEnXWPaCCALbVrTnszCVGfRU8cGfx is too short')
 *
 * // invalid case: address is too long
 * fromBase58Check('j9ywUkWg2fTQrouxxh5rSZhRvrjMkEUfuiKe')
 * // => throw new TypeError('j9ywUkWg2fTQrouxxh5rSZhRvrjMkEUfuiKe is too long')
 * ```
 */
export declare function fromBase58Check(address: string): Base58CheckResult;
/**
 * decode address with bech32 specification,  return address version、address prefix and address data if valid
 * @example
 * ```ts
 * // valid case
 * fromBech32('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')
 * // => {version: 0, prefix: 'bc', data: <Buffer 75 1e 76 e8 19 91 96 d4 54 94 1c 45 d1 b3 a3 23 f1 43 3b d6>}
 *
 * // invalid case
 * fromBase58Check('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')
 * // => Invalid checksum
 *
 * // invalid case
 * fromBase58Check('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sL5k7')
 * // => Mixed-case string
 *
 * // invalid case
 * fromBase58Check('tb1pw508d6qejxtdg4y5r3zarquvzkan')
 * // => Excess padding
 *
 * // invalid case
 * fromBase58Check('bc1zw508d6qejxtdg4y5r3zarvaryvq37eag7')
 * // => Excess padding
 *
 * // invalid case
 * fromBase58Check('bc1zw508d6qejxtdg4y5r3zarvaryvq37eag7')
 * // => Non-zero padding
 *
 * // invalid case
 * fromBase58Check('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3pjxtptv')
 * // => uses wrong encoding
 *
 * // invalid case
 * fromBase58Check('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd')
 * // => uses wrong encoding
 * ```
 */
export declare function fromBech32(address: string): Bech32Result;
/**
 * encode address hash to base58 address with version
 *
 * @example
 * ```ts
 * // valid case
 * toBase58Check('751e76e8199196d454941c45d1b3a323f1433bd6', 0)
 * // => 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH
 * ```
 */
export declare function toBase58Check(hash: Buffer, version: number): string;
/**
 * encode address hash to bech32 address with version and prefix
 *
 * @example
 * ```ts
 * // valid case
 * toBech32('000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433', 0, 'tb)
 * // => tb1qqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesrxh6hy
 * ```
 */
export declare function toBech32(data: Buffer, version: number, prefix: string): string;
/**
 * decode address from output script with network, return address if matched
 * @example
 * ```ts
 * // valid case
 * fromOutputScript('OP_DUP OP_HASH160 751e76e8199196d454941c45d1b3a323f1433bd6 OP_EQUALVERIFY OP_CHECKSIG', 'bicoin)
 * // => 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH
 *
 * // invalid case
 * fromOutputScript('031f1e68f82112b373f0fe980b3a89d212d2b5c01fb51eb25acb8b4c4b4299ce95 OP_CHECKSIG', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_TRUE 032487c2a32f7c8d57d2a93906a6457afd00697925b0e6e145d89af6d3bca33016 02308673d16987eaa010e540901cc6fe3695e758c19f46ce604e174dac315e685a OP_2 OP_CHECKMULTISIG', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_RETURN 06deadbeef03f895a2ad89fb6d696497af486cb7c644a27aa568c7a18dd06113401115185474', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_0 75', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_0 751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd675', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 75', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd675', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', undefined)
 * // => has no matching Address
 *
 * ```
 */
export declare function fromOutputScript(output: Buffer, network?: Network): string;
/**
 * encodes address to output script with network, return output script if address matched
 * @example
 * ```ts
 * // valid case
 * toOutputScript('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 'bicoin)
 * // => OP_DUP OP_HASH160 751e76e8199196d454941c45d1b3a323f1433bd6 OP_EQUALVERIFY OP_CHECKSIG
 *
 * // invalid case
 * toOutputScript('24kPZCmVgzfkpGdXExy56234MRHrsqQxNWE', undefined)
 * // => has no matching Script
 *
 * // invalid case
 * toOutputScript('BC1SW50QGDZ25J', { "bech32": "foo" })
 * // => has an invalid prefix
 *
 * // invalid case
 * toOutputScript('bc1rw5uspcuh', undefined)
 * // => has no matching Script
 * ```
 */
export declare function toOutputScript(address: string, network?: Network): Buffer;
