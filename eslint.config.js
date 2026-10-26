import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.amd,
        ...globals.node,
      },
    },

    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          endOfLine: 'auto',
          arrowParens: 'avoid',
          tabWidth: 2,
        },
      ],

      'arrow-body-style': 'off',
      'prefer-arrow-callback': 'off',
      '@typescript-eslint/array-type': 0,
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'arrow-parens': 'off',
      curly: 'off',
      'no-case-declarations': 'off',

      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      'prefer-rest-params': 'off',
      'no-bitwise': 'off',
      'no-console': 'off',

      'no-empty': [
        'error',
        {
          allowEmptyCatch: true,
        },
      ],

      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'space-before-function-paren': 'off',

      // Added to eslint:recommended in ESLint 10; both report existing code.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
];
