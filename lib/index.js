/**
 * @fileoverview ESLint plugin for i18n
 * @author edvardchen
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var requireIndex = require("requireindex");

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

// import all rules in lib/rules
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