/**
 * @fileoverview disallow literal string
 * @author edvardchen
 */
"use strict";

const {
  generateFullMatchRegExp,
  isAllowedDOMAttr,
  textReplacer
} = require("../helper");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: "disallow literal string",
      category: "Best Practices",
      recommended: true
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          ignore: {
            type: "array"
            // string or regexp
          },
          ignoreAttribute: {
            type: "array",
            items: {
              type: "string"
            }
          },
          ignoreCallee: {
            type: "array"
            // string or regexp
          },
          ignoreProperty: {
            type: "array",
            items: {
              type: "string"
            }
          },
          ignoreComponent: {
            type: "array",
            items: {
              type: "string"
            }
          },
          markupOnly: {
            type: "boolean"
          },
          onlyAttribute: {
            type: "array",
            items: {
              type: "string"
            }
          },
          validateTemplate: {
            type: "boolean"
          },
          useCallee: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    // variables should be defined here
    const {
      parserServices,
      options: [
        {
          onlyAttribute = [],
          markupOnly: _markupOnly,
          validateTemplate,
          ignoreComponent = [],
          ignoreAttribute = [],
          ignoreProperty = [],
          ignoreCallee = [],
          ignore = [],
          useCallee = "lang.t",
          ignoreConstructors = ["Error"]
        } = {}
      ]
    } = context;
    const whitelists = [
      /^[0-9!-/:-@[-`{-~]+$/, // ignore not-word string
      ...ignore
    ].map(item => new RegExp(item));

    const message = "disallow literal string";
    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    const indicatorStack = [];

    /**
     * detect if current "scope" is valid
     */
    function isValidScope() {
      return indicatorStack.some(item => item);
    }

    function match(str) {
      return whitelists.some(item => item.test(str));
    }

    function isValidConstructor(str) {
      return ignoreConstructors.some(item => item === str);
    }

    const popularCallee = [
      /^i18n(ext)?$/,
      "t",
      "require",
      "addEventListener",
      "removeEventListener",
      "postMessage",
      "getElementById",
      //
      // ─── VUEX CALLEE ────────────────────────────────────────────────────────────────
      //
      "dispatch",
      "commit",
      // ────────────────────────────────────────────────────────────────────────────────

      "includes",
      "indexOf",
      "endsWith",
      "startsWith"
    ];

    const validCalleeList = [...popularCallee, ...ignoreCallee].map(
      generateFullMatchRegExp
    );

    function isValidFunctionCall({ callee }) {
      let calleeName = callee.name;
      if (callee.type === "Import") return true;

      const sourceText = context.getSourceCode().getText(callee);

      return validCalleeList.some(item => {
        return item.test(sourceText);
      });
    }

    const ignoredClassProperties = ["displayName"];

    const userJSXAttrs = [
      "className",
      "styleName",
      "style",
      "type",
      "key",
      "id",
      "width",
      "height",

      ...ignoreAttribute
    ];
    function isValidAttrName(name) {
      if (onlyAttribute.length) {
        // only validate those attributes in onlyAttribute option
        return !onlyAttribute.includes(name);
      }
      return userJSXAttrs.includes(name);
    }

    // Ignore the Trans component for react-lang compatibility
    const ignoredComponents = ["Trans", ...ignoreComponent];

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------
    const visited = new WeakSet();

    function getNearestAncestor(node, type) {
      let temp = node.parent;
      while (temp) {
        if (temp.type === type) {
          return temp;
        }
        temp = temp.parent;
      }
      return temp;
    }

    function isString(node) {
      return typeof node.value === "string";
    }

    const { esTreeNodeToTSNodeMap, program } = parserServices;
    let typeChecker;
    if (program && esTreeNodeToTSNodeMap)
      typeChecker = program.getTypeChecker();

    function isValidLiteral(str) {
      const trimed = str.trim();
      if (!trimed) return true;

      // allow statements like const a = "FOO"
      // if (isUpperCase(trimed)) return true;

      if (match(trimed)) return true;
    }

    function validateLiteralNode(node) {
      // make sure node is string literal
      if (!isString(node)) return;
      if (isValidLiteral(node.value)) {
        return;
      }

      //
      // TYPESCRIPT
      //
      // TODO: TypeChecker is a mess. Does not need this for now, fix this if API references can be found --ziofatli
      // if (typeChecker) {
      //   const tsNode = esTreeNodeToTSNodeMap.get(node);
      //   const typeObj = typeChecker.getTypeAtLocation(tsNode.parent);

      //   // var a: 'abc' = 'abc'
      //   if (typeObj.isStringLiteral()) {
      //     return;
      //   }

      //   // var a: 'abc' | 'name' = 'abc'
      //   if (typeObj.isUnion() && node.parent.type !== "ConditionalExpression") {
      //     const found = typeObj.types.some(item => {
      //       if (item.isStringLiteral() && item.value === node.value) {
      //         return true;
      //       }
      //     });
      //     if (found) return;
      //   }
      // }
      // • • • • •

      context.report({
        node,
        message,
        fix(fixer) {
          return fixer.replaceText(
            node,
            `${useCallee}('${textReplacer(node.value)}')`
          );
        }
      });
    }

    // onlyAttribute would turn on markOnly
    const markupOnly = _markupOnly || !!onlyAttribute.length;

    function endIndicator() {
      indicatorStack.pop();
    }

    const scriptVisitor = {
      //
      // ─── EXPORT AND IMPORT ───────────────────────────────────────────
      //

      ImportExpression(node) {
        // allow (import('abc'))
        indicatorStack.push(true);
      },
      "ImportExpression:exit": endIndicator,

      ImportDeclaration(node) {
        // allow (import abc form 'abc')
        indicatorStack.push(true);
      },
      "ImportDeclaration:exit": endIndicator,

      ExportAllDeclaration(node) {
        // allow export * from 'mod'
        indicatorStack.push(true);
      },
      "ExportAllDeclaration:exit": endIndicator,

      "ExportNamedDeclaration[source]"(node) {
        // allow export { named } from 'mod'
        indicatorStack.push(true);
      },
      "ExportNamedDeclaration[source]:exit": endIndicator,
      // ─────────────────────────────────────────────────────────────────

      //
      // ─── JSX ─────────────────────────────────────────────────────────
      //

      JSXElement(node) {
        indicatorStack.push(
          ignoredComponents.includes(node.openingElement.name.name)
        );
      },
      "JSXElement:exit": endIndicator,

      "JSXElement > Literal"(node) {
        scriptVisitor.JSXText(node);
      },

      "JSXFragment > Literal"(node) {
        scriptVisitor.JSXText(node);
      },

      JSXAttribute(node) {
        const attrName = node.name.name;

        // allow <MyComponent className="active" />
        if (isValidAttrName(attrName)) {
          indicatorStack.push(true);
          return;
        }

        const jsxElement = getNearestAncestor(node, "JSXOpeningElement");
        const tagName = jsxElement.name.name;
        if (isAllowedDOMAttr(tagName, attrName)) {
          indicatorStack.push(true);
          return;
        }
        indicatorStack.push(false);
      },
      "JSXAttribute:exit": endIndicator,

      "JSXAttribute > Literal:exit"(node) {
        if (markupOnly) {
          if (isValidScope()) return;
          validateLiteralNode(node);
        }
      },

      "JSXExpressionContainer > Literal:exit"(node) {
        scriptVisitor["JSXAttribute > Literal:exit"](node);
      },

      // @typescript-eslint/parser would parse string literal as JSXText node
      JSXText(node) {
        if (isValidScope()) return;

        const trimed = node.value.trim();
        if (!trimed || match(trimed)) {
          return;
        }


        context.report({ 
          node, 
          message,        
          fix(fixer) {
            const trimNodeValue = node.value.trim();
            const rangeStart = node.value.indexOf(trimNodeValue) + node.range[0];
            const rangeEnd = rangeStart + trimNodeValue.length;

            return fixer.replaceTextRange([rangeStart, rangeEnd], `{${useCallee}('${trimNodeValue}')}`);
          } 
        });
      },
      // ─────────────────────────────────────────────────────────────────

      //
      // ─── TYPESCRIPT ──────────────────────────────────────────────────
      //

      TSModuleDeclaration() {
        indicatorStack.push(true);
      },
      "TSModuleDeclaration:exit": endIndicator,

      TSLiteralType(node) {
        // allow var a: Type['member'];
        indicatorStack.push(true);
      },
      "TSLiteralType:exit": endIndicator,
      TSEnumMember(node) {
        // allow enum E { "a b" = 1 }
        indicatorStack.push(true);
      },
      "TSEnumMember:exit": endIndicator,
      // ─────────────────────────────────────────────────────────────────

      ClassProperty(node) {
        indicatorStack.push(
          !!(node.key && ignoredClassProperties.includes(node.key.name))
        );
      },
      "ClassProperty:exit": endIndicator,

      Property(node) {
        const result = ignoreProperty.includes(node.key.name);
        indicatorStack.push(result);
      },
      "Property:exit": endIndicator,

      BinaryExpression(node) {
        const { operator } = node;
        // allow name === 'Android'
        indicatorStack.push(operator !== "+");
      },
      "BinaryExpression:exit": endIndicator,

      AssignmentPattern(node) {
        // allow function bar(input = 'foo') {}
        indicatorStack.push(true);
      },
      "AssignmentPattern:exit": endIndicator,

      CallExpression(node) {
        indicatorStack.push(isValidFunctionCall(node));
      },
      "CallExpression:exit": endIndicator,

      "SwitchCase > Literal"(node) {
        indicatorStack.push(true);
      },
      "SwitchCase > Literal:exit": endIndicator,

      MemberExpression(node) {
        // allow Enum['value']
        indicatorStack.push(true);
      },
      "MemberExpression:exit": endIndicator,

      NewExpression(node) {
        indicatorStack.push(isValidConstructor(node.callee.name));
      },

      "NewExpression:exit": endIndicator,

      TemplateLiteral(node) {
        if (!validateTemplate) {
          return;
        }
        const getName = (index) => {
          const expression = expressions[index];
          const type = expression.type;
          if (expression.name) {
            return expression.name;
          }
          return expressions.length > 1 ? `value${index}` : 'value';
        }

        const getPropertyAndValue = (index) => {
          const expression = expressions[index];
          if (expression.name) {
            return expression.name;
          }
          const value = context.getSourceCode().getText().slice(expression.range[0], expression.range[1]);
          return expressions.length > 1 ? `value${index}: ${value}` : `value: ${value}`;
        }

        if (isValidScope()) return;
        const { quasis = [], expressions = [] } = node;
        const text = quasis.reduce((acc, { value: { raw }, tail }, index) => {
          return acc + raw + (!tail ? `{{${getName(index)}}}` : "");
        }, "");
        quasis.some(({ value: { raw } }) => {
          const trimed = raw.trim();
          if (!trimed) return;
          if (match(trimed)) return;
          context.report({
            node,
            message,
            fix(fixer) {
              const replaceValue = `${useCallee}(\`${text}\`, { ${expressions
                .map((_, index) => getPropertyAndValue(index))
                .join(", ")} })`;

              return fixer.replaceText(
                node,
                replaceValue
              );
            }
          });
          return true; // break
        });
      },

      "Literal:exit"(node) {
        // ignore `var a = { "foo": 123 }`
        if (node.parent.key === node) {
          return;
        }
        if (markupOnly) {
          return;
        }
        if (node.parent && node.parent.type === "JSXElement") return;
        if (isValidScope()) return;
        validateLiteralNode(node);
      }
    };

    return (
      (parserServices.defineTemplateBodyVisitor &&
        parserServices.defineTemplateBodyVisitor(
          {
            VText(node) {
              scriptVisitor["JSXText"](node);
            },
            "VExpressionContainer CallExpression"(node) {
              scriptVisitor["CallExpression"](node);
            },
            "VExpressionContainer CallExpression:exit"(node) {
              scriptVisitor["CallExpression:exit"](node);
            },
            "VExpressionContainer Literal:exit"(node) {
              scriptVisitor["Literal:exit"](node);
            }
          },
          scriptVisitor
        )) ||
      scriptVisitor
    );
  }
};
