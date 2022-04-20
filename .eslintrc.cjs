module.exports = {
  extends: [
    //
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
  ],

  rules: {
    // 'no-param-reassign': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    // '@typescript-eslint/explicit-member-accessibility': 'off',
    // '@typescript-eslint/no-parameter-properties': 'off',
    'import/order': [
      'error',
      {
        groups: [
          ['builtin', 'external'],
          ['internal', 'parent', 'sibling', 'index', 'object', 'type'],
        ],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'never',
      },
    ],
  },
};
