import streamr from 'eslint-config-streamr-ts'

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'public/**'
        ]
    },
    ...streamr,
    {
        rules: {
            'class-methods-use-this': 'error',
            'eol-last': 'error',
            'no-console': ['error', {
                allow: ['warn', 'error', 'info']
            }],
            'no-restricted-imports': ['error', {
                patterns: ["*/dist"]
            }],
            'no-unused-vars': 'off',
            'prefer-arrow-callback': 'error',
            '@typescript-eslint/consistent-indexed-object-style': 'error',
            '@typescript-eslint/consistent-type-assertions': 'error',
            '@typescript-eslint/consistent-type-definitions': 'error',
            '@typescript-eslint/default-param-last': 'error',
            '@typescript-eslint/no-confusing-non-null-assertion': 'error',
            '@typescript-eslint/no-duplicate-enum-values': 'error',
            '@typescript-eslint/no-empty-function': 'error',
            '@typescript-eslint/no-extraneous-class': 'error',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-invalid-this': 'error',
            '@typescript-eslint/no-invalid-void-type': 'error',
            '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
            '@typescript-eslint/no-require-imports': 'error',
            '@typescript-eslint/no-unused-expressions': 'error',
            '@typescript-eslint/no-unused-vars': ['error', {
                vars: 'all',
                args: 'all',
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-useless-constructor': 'error',
            '@typescript-eslint/no-useless-empty-export': 'error',
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/prefer-function-type': 'error',
            '@typescript-eslint/prefer-literal-enum-member': 'error',
            '@stylistic/brace-style': ['error', '1tbs', {
                allowSingleLine: true
            }],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/func-call-spacing': 'error',
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/member-delimiter-style': ['error', {
                singleline: { delimiter: 'comma' },
                multiline: { delimiter: 'none' }
            }],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@typescript-eslint/restrict-template-expressions': ['error', {
                allowAny: false,
                allowBoolean: true,
                allowNullish: true,
                allowNumber: true,
                allowRegExp: true,
                allowNever: true,
                allow: [{ from: 'lib', name: ['Error'] }]
            }],
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always'
            }],
            '@stylistic/space-infix-ops': 'error',
            'promise/no-promise-in-callback': 'error',

            // TODO maybe we could enable some of these
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/require-await': 'off'
        }
    }
]
