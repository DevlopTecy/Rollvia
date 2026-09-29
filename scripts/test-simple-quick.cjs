// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  passedTests++;
  console.log(`  [PASS] ${name}`);
}

function fail(name, err) {
  failedTests++;
  console.error(`  [FAIL] ${name}:`, err);
}

console.log('================================================================');
console.log('TEST SUITE: ROLLVIA SIMPLE QUICK RANGE COMMAND PARSER');
console.log('================================================================\n');

// 1. Transpile and load quickCommandParser.ts directly
const parserTsPath = path.join(__dirname, '../src/utils/quickCommandParser.ts');
const parserCode = ts.transpileModule(fs.readFileSync(parserTsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const parserModule = { exports: {} };
new Function('exports', 'module', 'require', parserCode)(parserModule.exports, parserModule, require);
const { validateQuickCommand } = parserModule.exports;

// Create standard test roster with students 100 through 120
/** @type {Array<{ id: string; name: string; rollNumber: string }>} */
const fullRoster = [];
for (let i = 100; i <= 120; i++) {
  fullRoster.push({
    id: `student_${i}`,
    name: `Student ${i}`,
    rollNumber: String(i),
  });
}
// Also add standard legacy IDs for backward compatibility tests
fullRoster.push(
  { id: 'p1', name: 'A', rollNumber: '113' },
  { id: 'p2', name: 'B', rollNumber: '144' },
  { id: 'p3', name: 'C', rollNumber: '102' },
  { id: 'p4', name: 'D', rollNumber: '155' },
  { id: 'p5', name: 'E', rollNumber: '222' },
  { id: 'p6', name: 'F', rollNumber: '109' }
);

// ─────────────────────────────────────────────────────────────────────────────
// RANGE SYNTAX TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Basic Range Syntax:');

// Test 1: P:100:105
try {
  const res = validateQuickCommand('P:100:105', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105']);
  pass('P:100:105 marks 100-105 inclusive as Present');
} catch (err) {
  fail('P:100:105', err);
}

// Test 2: A:100:105
try {
  const res = validateQuickCommand('A:100:105', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105']);
  pass('A:100:105 marks 100-105 inclusive as Absent');
} catch (err) {
  fail('A:100:105', err);
}

// Test 3: P:100:100 (Single item range)
try {
  const res = validateQuickCommand('P:100:100', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['100']);
  pass('P:100:100 single-number range valid');
} catch (err) {
  fail('P:100:100', err);
}

// Test 4: A:100:100 (Single item range)
try {
  const res = validateQuickCommand('A:100:100', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, ['100']);
  pass('A:100:100 single-number range valid');
} catch (err) {
  fail('A:100:100', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// MIXED COMMANDS TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Mixed Commands:');

// Test 5: P:100:105,110
try {
  const res = validateQuickCommand('P:100:105,110', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105', '110']);
  pass('P:100:105,110 mixed range and single number');
} catch (err) {
  fail('P:100:105,110', err);
}

// Test 6: P:100:105,115:118
try {
  const res = validateQuickCommand('P:100:105,115:118', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, [
    '100', '101', '102', '103', '104', '105',
    '115', '116', '117', '118'
  ]);
  pass('P:100:105,115:118 multiple ranges mixed');
} catch (err) {
  fail('P:100:105,115:118', err);
}

// Test 7: A:100:105,110,115:118
try {
  const res = validateQuickCommand('A:100:105,110,115:118', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, [
    '100', '101', '102', '103', '104', '105',
    '110',
    '115', '116', '117', '118'
  ]);
  pass('A:100:105,110,115:118 mixed ranges and single roll numbers');
} catch (err) {
  fail('A:100:105,110,115:118', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// REVERSED & MALFORMED RANGES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Reversed and Malformed Ranges:');

// Test 8: Reversed range P:105:100 -> invalid
try {
  const res = validateQuickCommand('P:105:100', fullRoster);
  assert.strictEqual(res.isValid, false);
  assert(res.error && res.error.toLowerCase().includes('less than or equal'), 'Reversed range error message');
  pass('reversed range P:105:100 rejected as invalid');
} catch (err) {
  fail('reversed range P:105:100', err);
}

// Test 9: Malformed P:100: (trailing colon)
try {
  const res = validateQuickCommand('P:100:', fullRoster);
  assert.strictEqual(res.isValid, false);
  pass('malformed P:100: rejected');
} catch (err) {
  fail('malformed P:100:', err);
}

// Test 10: Malformed P::105 (missing start)
try {
  const res = validateQuickCommand('P::105', fullRoster);
  assert.strictEqual(res.isValid, false);
  pass('malformed P::105 rejected');
} catch (err) {
  fail('malformed P::105', err);
}

// Test 11: Malformed range within list: P:100:105,110:
try {
  const res = validateQuickCommand('P:100:105,110:', fullRoster);
  assert.strictEqual(res.isValid, false);
  pass('malformed range P:100:105,110: rejected');
} catch (err) {
  fail('malformed range P:100:105,110:', err);
}

// Test 12: Triple colon in range P:100:105:110
try {
  const res = validateQuickCommand('P:100:105:110', fullRoster);
  assert.strictEqual(res.isValid, false);
  pass('triple colon P:100:105:110 rejected');
} catch (err) {
  fail('triple colon P:100:105:110', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// NONEXISTENT IDS & ATOMIC VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Nonexistent IDs and Atomic Execution:');

// Test 13: Nonexistent ID inside a range
try {
  // Roster with gap: 100, 101, 102, 104, 105 (missing 103)
  const rosterWithGap = fullRoster.filter((p) => p.rollNumber !== '103');
  const res = validateQuickCommand('P:100:105', rosterWithGap);
  assert.strictEqual(res.isValid, false);
  assert(res.error && res.error.includes('103'), 'Error must specifically mention nonexistent roll number 103');
  pass('nonexistent ID inside a range fails entire command');
} catch (err) {
  fail('nonexistent ID inside a range', err);
}

// Test 14: Nonexistent ID in mixed command P:100:105,999
try {
  const res = validateQuickCommand('P:100:105,999', fullRoster);
  assert.strictEqual(res.isValid, false);
  assert(res.error && res.error.includes('999'), 'Error must mention nonexistent ID 999');
  pass('nonexistent ID in mixed command P:100:105,999 fails without partial execution');
} catch (err) {
  fail('nonexistent ID in mixed command P:100:105,999', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. Duplicate IDs Deduplication:');

// Test 15: Duplicate IDs in range + single numbers: P:100:105,103,105
try {
  const res = validateQuickCommand('P:100:105,103,105', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105']);
  pass('duplicate IDs P:100:105,103,105 deduplicated cleanly');
} catch (err) {
  fail('duplicate IDs P:100:105,103,105', err);
}

// Test 16: Duplicate single IDs: P:100,100,105
try {
  const res = validateQuickCommand('P:100,100,105', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.deepStrictEqual(res.rollNumbers, ['100', '105']);
  pass('duplicate single IDs P:100,100,105 deduplicated cleanly');
} catch (err) {
  fail('duplicate single IDs P:100,100,105', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// INVALID CHARACTERS & SPACES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6. Strict Validation (Characters & Spaces):');

const invalidCases = [
  { cmd: 'P:100 105', reason: 'Space instead of separator' },
  { cmd: 'P:100: 105', reason: 'Space after colon' },
  { cmd: 'P:100 ,105', reason: 'Space before comma' },
  { cmd: 'P:100, 105', reason: 'Space after comma' },
  { cmd: 'P:100-105', reason: 'Hyphen range separator' },
  { cmd: 'P:100:abc', reason: 'Alpha characters in range' },
  { cmd: 'P:abc:105', reason: 'Alpha characters in range start' },
  { cmd: 'P:100::105', reason: 'Double colon' },
  { cmd: 'P:100:105,', reason: 'Trailing comma' },
  { cmd: 'P:100,,105', reason: 'Double comma' },
  { cmd: 'p:100:105', reason: 'Lowercase action p:' },
  { cmd: 'a:100:105', reason: 'Lowercase action a:' },
  { cmd: 'X:100:105', reason: 'Invalid action prefix X:' },
  { cmd: 'P:', reason: 'Empty command body' },
];

for (const { cmd, reason } of invalidCases) {
  try {
    const res = validateQuickCommand(cmd, fullRoster);
    assert.strictEqual(res.isValid, false);
    pass(`Invalid rejected: '${cmd}' (${reason})`);
  } catch (err) {
    fail(`Invalid not rejected: '${cmd}' (${reason})`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING COMMA SYNTAX (PRESERVED)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7. Existing Comma Syntax Preserved:');

// Test 17: Existing comma syntax P:100,105,110
try {
  const res = validateQuickCommand('P:100,105,110', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['100', '105', '110']);
  pass('Existing comma syntax P:100,105,110 preserved');
} catch (err) {
  fail('Existing comma syntax P:100,105,110', err);
}

// Test 18: Existing comma syntax A:100,105,110
try {
  const res = validateQuickCommand('A:100,105,110', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, ['100', '105', '110']);
  pass('Existing comma syntax A:100,105,110 preserved');
} catch (err) {
  fail('Existing comma syntax A:100,105,110', err);
}

// Test 19: Legacy test case P:113,144,102
try {
  const res = validateQuickCommand('P:113,144,102', fullRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['113', '144', '102']);
  pass('Legacy test case P:113,144,102 preserved');
} catch (err) {
  fail('Legacy test case P:113,144,102', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELP & EXAMPLES VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n8. UI Help & Examples Verification:');

try {
  const panelPath = path.join(__dirname, '../src/components/workspace/SimpleQuickPanel.tsx');
  const panelContent = fs.readFileSync(panelPath, 'utf8');

  assert(panelContent.includes('P:100,105,110'), 'SimpleQuickPanel contains P:100,105,110 example');
  assert(panelContent.includes('A:100,105,110'), 'SimpleQuickPanel contains A:100,105,110 example');
  assert(panelContent.includes('P:100:105'), 'SimpleQuickPanel contains P:100:105 example');
  assert(panelContent.includes('A:100:105'), 'SimpleQuickPanel contains A:100:105 example');
  assert(panelContent.includes('P:100:105,110,115:118'), 'SimpleQuickPanel contains mixed example');
  pass('SimpleQuickPanel contains all 5 required syntax examples');
} catch (err) {
  fail('SimpleQuickPanel UI help text verification', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\nAll Simple Quick range command tests passed successfully!\n');
}
