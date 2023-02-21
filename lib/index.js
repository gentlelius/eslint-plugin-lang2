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
    plugins: ["eslint-plugin-lang"],
    rules: {
      "lang/no-literal-string": [2]
    }
  }
};
