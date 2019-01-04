"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NETWORKS = require("./networks");
const types = require("./types");
const ecc = require('tiny-secp256k1');
const randomBytes = require('randombytes');
const typeforce = require('typeforce');
const wif = require('wif');
const isOptions = typeforce.maybe(typeforce.compile({
    compressed: types.maybe(types.Boolean),
    network: types.maybe(types.Network)
}));
class ECPair {
    constructor(d, Q, options) {
        if (options === undefined)
            options = {};
        this.compressed = options.compressed === undefined ? true : options.compressed;
        this.network = options.network || NETWORKS.bitcoin;
        this.__d = undefined;
        this.__Q = undefined;
        if (d !== undefined)
            this.__d = d;
        if (Q !== undefined)
            this.__Q = ecc.pointCompress(Q, this.compressed);
    }
    get privateKey() {
        return this.__d;
    }
    get publicKey() {
        if (!this.__Q)
            this.__Q = ecc.pointFromScalar(this.__d, this.compressed);
        return this.__Q;
    }
    toWIF() {
        if (!this.__d)
            throw new Error('Missing private key');
        return wif.encode(this.network.wif, this.__d, this.compressed);
    }
    sign(hash) {
        if (!this.__d)
            throw new Error('Missing private key');
        return ecc.sign(hash, this.__d);
    }
    verify(hash, signature) {
        return ecc.verify(hash, this.publicKey, signature);
    }
}
function fromPrivateKey(buffer, options) {
    typeforce(types.Buffer256bit, buffer);
    if (!ecc.isPrivate(buffer))
        throw new TypeError('Private key not in range [1, n)');
    typeforce(isOptions, options);
    return new ECPair(buffer, undefined, options);
}
exports.fromPrivateKey = fromPrivateKey;
function fromPublicKey(buffer, options) {
    typeforce(ecc.isPoint, buffer);
    typeforce(isOptions, options);
    return new ECPair(undefined, buffer, options);
}
exports.fromPublicKey = fromPublicKey;
function fromWIF(string, network) {
    const decoded = wif.decode(string);
    const version = decoded.version;
    // list of networks?
    if (types.Array(network)) {
        network = network.filter(function (x) {
            return version === x.wif;
        }).pop();
        if (!network)
            throw new Error('Unknown network version');
        // otherwise, assume a network object (or default to bitcoin)
    }
    else {
        network = network || NETWORKS.bitcoin;
        if (version !== network.wif)
            throw new Error('Invalid network version');
    }
    return fromPrivateKey(decoded.privateKey, {
        compressed: decoded.compressed,
        network: network
    });
}
exports.fromWIF = fromWIF;
function makeRandom(options) {
    typeforce(isOptions, options);
    if (options === undefined)
        options = {};
    const rng = options.rng || randomBytes;
    let d;
    do {
        d = rng(32);
        typeforce(types.Buffer256bit, d);
    } while (!ecc.isPrivate(d));
    return fromPrivateKey(d, options);
}
exports.makeRandom = makeRandom;
