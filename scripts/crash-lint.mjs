// Krasch-grind for deploy: fangar de tva fel som ger vit skarm i prod men
// som bygget slapper igenom - TDZ (no-use-before-define) och dubblerade
// objektnycklar (no-dupe-keys). Kor ESLint programmatiskt med BARA dessa
// tva regler, sa inga plugins/disable-kommentarer stor. Exit 1 vid traff.
import { ESLint } from 'eslint'

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-use-before-define': ['error', { variables: true, functions: false, classes: true }],
      'no-dupe-keys': 'error',
    },
  },
})

const results = await eslint.lintFiles(['src/**/*.{js,jsx}'])
const CRASH_RULES = new Set(['no-use-before-define', 'no-dupe-keys'])
let hits = 0
for (const r of results) {
  for (const m of r.messages) {
    if (m.ruleId && CRASH_RULES.has(m.ruleId)) {
      hits++
      console.error(`${r.filePath}:${m.line}:${m.column}  ${m.ruleId}  ${m.message}`)
    }
  }
}
if (hits > 0) {
  console.error(`\nKrasch-lint: ${hits} fel som skulle ge vit skarm i prod. Deploy stoppad.`)
  process.exit(1)
}
console.log('Krasch-lint: inga TDZ- eller dubblettfel. OK.')
