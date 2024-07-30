/**
 * @fileoverview disallow literal string
 * @author edvardchen
 */
"use strict";
const fse = require('fs-extra');
const path = require('path');
const { translate } = require("@vitalets/google-translate-api");

const {
  generateFullMatchRegExp,
  isAllowedDOMAttr,
  textReplacer,
} = require("../helper");

const defauleConfig = {
  ignore: ['^[^\u4e00-\u9fa5]+$'],
  ignoreCallee: ['describe', 'test', 'it', '\\$t', 'console.*', 'log.*', '\\$D'],
  validateTemplate: true,
  templateTags: ['{', '}'],
  useCallee: 'lang.t',
  i18nFilePath: path.resolve(process.cwd(), './src/locales/auto-translate')
};

async function translateText(text, targetLang = "en") {
  try {
    const response = await translate(text, { from: "zh-CN", to: targetLang });
    return response.text;
  } catch (error) {
    // console.error("Error translating text:", error);
  }
}
/**
 * 往指定的JSON文件追加一个键值对。
 * 如果文件不存在，将会创建一个新的JSON文件。
 * 如果键已存在，将不做任何操作并返回一个提示。
 * 
 * @param {string} filePath JSON文件的路径。
 * @param {string} key 要追加的键。
 * @param {*} value 要追加的值。
 * @return {Promise<void>} 一个表示操作完成的Promise。
 */
function appendToJSONFile(filePath, key, value) {
  try {
      let data = {};

      // 判断文件是否存在
      if (fse.pathExistsSync(filePath)) {
          data = fse.readJSONSync(filePath);
      }

      // 检查键是否已存在
      if (data.hasOwnProperty(key)) {
          // console.log('该键已存在于JSON文件中，未进行任何操作。');
          return;
      }

      // 追加键值对
      data[key] = value;

      // 确保目录存在
      fse.ensureDirSync(path.dirname(filePath));

      // 将对象写回到文件
      fse.writeJSONSync(filePath, data, { spaces: 2 });
      
      // console.log('键值对已追加到JSON文件！');
  } catch (error) {
      console.error('操作文件时发生错误:', error);
  }
}

function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  })
}

function isValidNs(namespace) {
  const regex = /^[a-zA-Z0-9_.-]+$/;
  return regex.test(namespace);
}

const langList = [
  'en-US',
  'zh-CN',
  'zh-HK',
]

// 兜底文案
const fallbackText = '【待翻译】'

function autoTranslate(zhCnText, i18nFilePath, nsWithFile) {
  if (!zhCnText) {
    return;
  }
  // 去掉换行符，空格符
  zhCnText = zhCnText.replace(/[\r\n]/g, '').trim();
  // 判断 i18nFilePath 是否包含模板变量
  let filePathList;
  if (i18nFilePath.includes('{LANG}')) {
    // 如果有注释
    if (nsWithFile) {
      filePathList = langList.map(lang => path.resolve(i18nFilePath.replace('{LANG}', lang), `${nsWithFile}.json`));
    } else {
      filePathList = langList.map(lang => path.resolve(i18nFilePath.replace('{LANG}', lang), 'translation.json'));
    }
  } else {
    filePathList = langList.map(lang => path.resolve(i18nFilePath, `${lang}.json`)); 
  }
  for (let i = 0; i < langList.length; i++) {
    const filePath = filePathList[i];
    if (langList[i] === 'zh-CN') {
      appendToJSONFile(filePath, zhCnText, zhCnText);
      continue;
    }
    translateText(zhCnText, langList[i]).then((translatedText = fallbackText) => {
      // 输出 translatedText 作为翻译结果
      // 格式为 zhCnText: translatedText
      // 找到默认的配置文件
      // 写入到文件中
      appendToJSONFile(filePath, zhCnText, translatedText);
    }).catch((e) => {
      console.error(e)
      appendToJSONFile(filePath, zhCnText, fallbackText);
    });
  }
}

module.exports = {
  meta: {
    docs: {
      description: "disallow literal string",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          autoFix: {
            type: "boolean",
          },
          templateTags: {
            type: "array",
            items: {
              type: "string",
            },
          },
          i18nFilePath: {
            type: "string",
          },
          ignore: {
            type: "array",
            // string or regexp
          },
          ignoreAttribute: {
            type: "array",
            items: {
              type: "string",
            },
          },
          ignoreCallee: {
            type: "array",
            // string or regexp
          },
          ignoreProperty: {
            type: "array",
            items: {
              type: "string",
            },
          },
          ignoreComponent: {
            type: "array",
            items: {
              type: "string",
            },
          },
          markupOnly: {
            type: "boolean",
          },
          onlyAttribute: {
            type: "array",
            items: {
              type: "string",
            },
          },
          validateTemplate: {
            type: "boolean",
          },
          useCallee: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const filename = context.getFilename();
    const extname = path.extname(filename);
    // 如果文件扩展名为 .json，则抛出错误
    if (extname === '.json') {
      throw new Error("This ESLint rule does not support JSON files.");
    }
    
    // variables should be defined here
    const {
      parserServices,
      options: [
        {
          i18nFilePath = defauleConfig.i18nFilePath,
          ignoreCallee = defauleConfig.ignoreCallee,
          ignore = defauleConfig.ignore,
          useCallee = defauleConfig.useCallee,
          validateTemplate = defauleConfig.validateTemplate,
          templateTags = defauleConfig.templateTags,
          onlyAttribute = [],
          markupOnly: _markupOnly,
          ignoreComponent = [],
          ignoreAttribute = [],
          ignoreProperty = [],
          ignoreConstructors = ["Error"],
          autoFix = true,
        } = {},
      ],
    } = context;
    const whitelists = [
      /^[0-9!-/:-@[-`{-~]+$/, // ignore not-word string
      ...ignore,
    ].map((item) => new RegExp(item));

    const message = "disallow literal string";
    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    const indicatorStack = [];
    let nsWithFile = '';

    /**
     * detect if current "scope" is valid
     */
    function isValidScope() {
      return indicatorStack.some((item) => item);
    }

    function match(str) {
      return whitelists.some((item) => item.test(str));
    }

    function isValidConstructor(str) {
      return ignoreConstructors.some((item) => item === str);
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
      "startsWith",
    ];

    const validCalleeList = [...popularCallee, ...ignoreCallee].map(
      generateFullMatchRegExp
    );

    function isValidFunctionCall({ callee }) {
      let calleeName = callee.name;
      if (callee.type === "Import") return true;

      const sourceText = context.getSourceCode().getText(callee);

      return validCalleeList.some((item) => {
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

      ...ignoreAttribute,
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
      context.report({
        node,
        message,
        fix(fixer) {
          if (!autoFix) {
            return;
          }
          autoTranslate(node.value, i18nFilePath, nsWithFile);
          return fixer.replaceText(
            node,
            nsWithFile ? `${useCallee}('${textReplacer(node.value)}', { ns: '${nsWithFile}' })` : `${useCallee}('${textReplacer(node.value)}')`

          );
        },
      });
    }

    function validateLiteralNode4JsxAttr(node) {
      // make sure node is string literal
      if (!isString(node)) return;
      if (isValidLiteral(node.value)) {
        return;
      }
      context.report({
        node,
        message,
        fix(fixer) {
          if (!autoFix) {
            return;
          }
          autoTranslate(node.value, i18nFilePath, nsWithFile);
          return fixer.replaceText(
            node,
            nsWithFile ? `{${useCallee}('${textReplacer(node.value)}', { ns: '${nsWithFile}' })}` : `{${useCallee}('${textReplacer(node.value)}')}`
          );
        },
      });
    }

    // onlyAttribute would turn on markOnly
    const markupOnly = _markupOnly || !!onlyAttribute.length;

    function endIndicator() {
      indicatorStack.pop();
    }

    const scriptVisitor = {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();
        comments.forEach(comment => {
          if (comment.type === 'Block' && comment.value.includes('i18n-ns')) {
            const i18nNs = comment.value.split('i18n-ns:')[1].trim();
            if (isValidNs(i18nNs)) {
              nsWithFile = i18nNs;
            }
          }
        });
      },
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
        if (!markupOnly) {
          if (isValidScope()) return;
          // 如果有大括号，就不检测
          if (node.parent.type === 'JSXExpressionContainer') {
            validateLiteralNode(node);
          } else if (node.parent.type === 'JSXAttribute') {
            validateLiteralNode4JsxAttr(node);
          }
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
            if (!autoFix) {
              return;
            }
            autoTranslate(node.value, i18nFilePath, nsWithFile);
            const trimNodeValue = node.value.trim();
            const rangeStart =
              node.value.indexOf(trimNodeValue) + node.range[0];
            const rangeEnd = rangeStart + trimNodeValue.length;

            return fixer.replaceTextRange(
              [rangeStart, rangeEnd],
              nsWithFile ? `{${useCallee}('${trimNodeValue}', { ns: '${nsWithFile}' })}` : `{${useCallee}('${trimNodeValue}')}`
            );
          },
        });
      },

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
          return expressions.length > 1 ? `value${index}` : "value";
        };

        const getPropertyAndValue = (index) => {
          const expression = expressions[index];
          if (expression.name) {
            return expression.name;
          }
          const value = context
            .getSourceCode()
            .getText()
            .slice(expression.range[0], expression.range[1]);
          return expressions.length > 1
            ? `value${index}: ${value}`
            : `value: ${value}`;
        };

        if (isValidScope()) return;
        const { quasis = [], expressions = [] } = node;
        const text = quasis.reduce((acc, { value: { raw }, tail }, index) => {
          return acc + raw + (!tail ? `${templateTags[0]}${getName(index)}${templateTags[1]}` : "");
        }, "");
        quasis.some(({ value: { raw } }) => {
          const trimed = raw.trim();
          if (!trimed) return;
          if (match(trimed)) return;
          context.report({
            node,
            message,
            fix(fixer) {
              if (!autoFix) {
                return;
              }
              const replaceValue = `${useCallee}(\`${text}\`, { ${expressions
                .map((_, index) => getPropertyAndValue(index))
                .join(", ")} })`;
                
              autoTranslate(text, i18nFilePath, nsWithFile);

              return fixer.replaceText(node, replaceValue);
            },
          });
          return true; // break
        });
      },

      "Literal:exit"(node) {
        if (node.parent.key === node) {
          return;
        }
        if (markupOnly) {
          return;
        }
        if (node.parent && node.parent.type === "JSXElement" || node.parent.type === 'JSXAttribute') return;
        if (isValidScope()) return;
        validateLiteralNode(node);
      },
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
            },
          },
          scriptVisitor
        )) ||
      scriptVisitor
    );
  },
};
