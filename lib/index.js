
"use strict";

var requireIndex = require("requireindex");

module.exports.rules = requireIndex(__dirname + "/rules");

module.exports.configs = {
  recommended: {
    plugins: ["eslint-plugin-lang2"],
    rules: {
      'lang2/no-literal-string': [2, {
        ignore: ['^[^\u4e00-\u9fa5]+$'],
        ignoreCallee: ['describe', 'test', 'it', '\\$t', 'console.*', 'log.*'],
        validateTemplate: true,
        useCallee: 'lang.t',
      }]
    }
  }
};