// Lint for the app scripts (npm run lint). The www/js files are classic scripts that share one scope, so every
// top-level name declared in any of them is a global for the others. They are read with ESLint's own parser and
// listed here, so no-undef still catches typos and names that exist nowhere.
const fs = require('fs'), path = require('path'), globals = require('globals'), espree = require('espree');
const dir = path.join(__dirname, 'www', 'js');
const shared = {};
const names = p => p.type === 'Identifier' ? [p.name] : p.type === 'ObjectPattern' ? p.properties.flatMap(x => names(x.value || x.argument))
  : p.type === 'ArrayPattern' ? p.elements.filter(Boolean).flatMap(names) : p.type === 'AssignmentPattern' ? names(p.left) : p.type === 'RestElement' ? names(p.argument) : [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const ast = espree.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'script' });
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') shared[n.id.name] = 'writable';
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => names(d.id).forEach(x => { shared[x] = 'writable'; }));
  }
}
module.exports = [{
  files: ['www/js/**/*.js'],
  languageOptions: {
    ecmaVersion: 2022, sourceType: 'script',
    globals: { ...globals.browser, ...shared, Capacitor: 'readonly' },
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    'no-dupe-keys': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error',
    'no-dupe-else-if': 'error', 'no-cond-assign': ['error', 'except-parens'], 'use-isnan': 'error', 'valid-typeof': 'error',
  },
}];
