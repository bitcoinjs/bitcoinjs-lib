# Verify an npm release against reviewed Git source

The `bitcoinjs-lib` published npm package is not automatically proven identical to its GitHub release by a version string. `tools/verify-npm-release.mjs` independently packs a **clean checkout of the exact release tag** and fetches the same version from npm, then compares SHA-256 for **every package file**. The comparison fails if either tarball has a missing, additional or changed file. It refuses unexpected tar paths, symlinks and hardlinks, and never extracts those tarballs to disk.

## Verify an existing release

Use an independently reviewed source checkout and an audited copy of the verifier. For a historic release whose tag does not contain this tool, keep the verifier **outside** that checkout:

```sh
# Obtain and inspect the verifier from a trusted review of this repository.
cp path/to/reviewed/verify-npm-release.mjs /tmp/verify-npm-release.mjs

git clone https://github.com/bitcoinjs/bitcoinjs-lib.git bitcoinjs-audit
cd bitcoinjs-audit
git switch --detach v7.0.1
# Review the tag's commit ID and verify it through an independent channel.
git rev-parse HEAD
node /tmp/verify-npm-release.mjs 7.0.1
```

The tool requires a clean Git checkout at tag `vX.Y.Z` or `X.Y.Z` with the same version in `package.json`. It uses `npm pack --ignore-scripts --json` for the local checkout and for the registry version, then compares package entries by name and SHA-256. Package lifecycle scripts are never executed. No registry write token or Bitcoin wallet/private key is required. The command exits `0` on a match, `1` for missing/extra/different files, and `2` for malformed input or tool failure.

You can also compare **two already downloaded** package tarballs offline:

```sh
node /tmp/verify-npm-release.mjs --compare reviewed-source.tgz npm-downloaded.tgz
```

Run the source-only regression suite with:

```sh
node --test tools/verify-npm-release.test.mjs
```

## Trust limits

A successful comparison means these two *package archives* contain identical regular-file names and bytes. It does **not** prove the Git release tag was signed by a maintainer, that the tag or verifier was independently authenticated, that the dependencies were safe, or that no build-time modifications occur later. The user must review the exact Git revision and verifier first. A mismatch must be investigated before installing or using the package for wallet software.

This approach avoids claiming deterministic gzip archive identity: tar entry ordering, compression headers, and packaging metadata can differ even when file contents match. It complements, rather than replaces, registry Trusted Publishing, provenance attestations, code review, and dependency pinning.
