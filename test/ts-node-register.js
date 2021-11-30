// This file is required to run mocha tests on the TS files directly

require("ts-node").register({
  project: "test/tsconfig.json",
});
