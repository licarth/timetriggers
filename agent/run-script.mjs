#!/usr/bin/env zx
import _ from "lodash";
import "zx/globals";

const scriptName = argv._[0];
const options = _.omit(argv, "_");

console.log(argv);
console.log(options);

await $`npm run build`;

const optionsFromCommandLine = _(options)
  .mapKeys((_value, key) => _.snakeCase(key).toUpperCase())
  .value();

console.log(optionsFromCommandLine);
$.env = {
  ...process.env,
  ...optionsFromCommandLine,
};

await $`node ./built/scripts/${scriptName}.js`;

const toUnderscoreCase = (str) =>
  str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
