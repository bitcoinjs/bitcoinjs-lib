# Contributing to bitcoinjs-lib

Firstly in terms of structure, there is no particular concept of "bitcoinjs developers" in the sense of privileged people.
Open source often naturally revolves around meritocracy where longer term contributors gain more trust from the developer community.

However, for practical purpose, there are repository "maintainers" who are responsible for merging pull requests.

We are always accepting of pull requests, but we do adhere to specific standards in regards to coding style, test driven development and commit messages.


## Communication Channels
GitHub is the preferred method of communication between members.

Otherwise, in order of preference:
* bitcoinjs.slack.com
* #bitcoinjs-dev on Freenode IRC


## Workflow
The codebase is maintained using the "contributor workflow" where everyone without exception contributes patch proposals using "pull requests".
This facilitates social contribution, easy testing and peer review.

To contribute a patch, the workflow is as follows:

  1. Fork repository
  1. Create topic branch
  1. Commit patches
  1. Push changes to your fork
  1. Submit a pull request to https://github.com/bitcoinjs/bitcoinjs-lib

[Commits should be atomic](https://en.wikipedia.org/wiki/Atomic_commit#Atomic_commit_convention) and diffs easy to read.

If your pull request is accepted for merging, you may be asked by a maintainer to squash and or [rebase](https://git-scm.com/docs/git-rebase) your commits before it will be merged.

Please refrain from creating several pull requests for the same change.

Patchsets should be focused:

	* Adding a feature, or
	* Fixing a bug, or
	* Refactoring code.

If you combine these, the PR may be rejected or asked to be split up.

The length of time required for peer review is unpredictable and will vary from pull request to pull request.

Refer to the [Git manual](https://git-scm.com/doc) for any information about `git`.

## We adhere to Bitcoin-Core policy
- `bitcoinjs.template.*` functions should follow the script "templates" typically used in the community (and consequently, the bitcoin blockchain).

This is a matter of community consensus,  but is probably going to always be closely related to what bitcoin core does by default.
They are quite plainly just pattern matching functions, and should be treated as such.

`bitcoinjs.script.decompile` is consensus bound only,  it does not reject based on policy.
`bitcoinjs.script.compile` will adhere to bitcoin-core `IsStandard` policies rules. (eg. minimalpush in https://github.com/bitcoinjs/bitcoinjs-lib/pull/638)

ECDSA `sign` operations will adhere to `IsStandard` policies such as `LOW_S`, but `verify` will not reject them.

For rejecting non-standard `decoding`, you should use external modules to this library.

**TLDR:**
Where "standards compliant" refers to the default policies of bitcoin-core,  we adhere to the following:
- Any "creation" event must create standards-compliant data (standards bound)
- Any "validation" event must allow for non-standards compliant data (consensus bound)

For stricter validation,  use an external module which we [might have] provided.


## Release Policy
TODO
