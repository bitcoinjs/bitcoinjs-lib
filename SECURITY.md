# Security policy

## Supported versions

Security fixes are released for the latest 7.x version, published on npm
under the `latest` tag.

Fixes for 6.x and 5.x are published under the npm tags `maintenance-v6`
and `maintenance-v5`, not under `latest`.

## Reporting a vulnerability

Report a vulnerability privately, through GitHub's
[private vulnerability reporting](https://github.com/bitcoinjs/bitcoinjs-lib/security/advisories/new).
Do not open a public issue or pull request: it is visible to everyone
before a fix exists.

Include:

- the affected versions;
- what an attacker can do, and under which conditions;
- a minimal reproduction, such as a test case or a transaction;
- a suggested fix, if you have one.

A flaw in a dependency, such as `bip174` or `bech32`, is reported to that
project.

## What to expect

The maintainers acknowledge the report in the advisory and discuss it
with you there. They coordinate the fix, its release on npm, and the
publication of the advisory.
