'use strict';

module.exports = [{
  files: ['src/**/*.js', 'test/**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    eqeqeq: ['error', 'always']
  }
}];
