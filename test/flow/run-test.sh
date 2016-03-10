#!/usr/bin/env bash

set -x
cd "$(dirname "$0")"/..
$(npm bin)/flow check > flow/result

# diff returns >0 on difference
diff flow/result flow/expected > flow/diff
