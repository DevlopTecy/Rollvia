// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function pass(msg) {
  passedTests++;
  console.log(`[PASS] ${msg}`);
}

function fail(msg, err) {
  failedTests++;
  console.error(`[FAIL] ${msg}`, err || '');
}

console.log('========================================================');
console.log('TEST SUITE: ATTENDLY LOGO INTEGRATION');
console.log('========================================================\n');

const projectRoot = path.join(__dirname, '..');

// 1. Logo Asset Check
try {
  const logoPath = path.join(projectRoot, 'src', 'assets', 'attendly-logo.png');
  assert(fs.existsSync(logoPath), 'attendly-logo.png must exist in src/assets');
  const stats = fs.statSync(logoPath);
  assert(stats.size > 10000, `Logo file size must be valid (found ${stats.size} bytes)`);
  pass('Attendly logo asset exists in src/assets with valid file size');
} catch (err) {
  fail('Logo asset check failed', err);
}

// 2. WorkspaceHeader Logo and Navigation
try {
  const wsHeaderPath = path.join(projectRoot, 'src', 'components', 'workspace', 'WorkspaceHeader.tsx');
  const wsHeaderContent = fs.readFileSync(wsHeaderPath, 'utf8');

  assert(wsHeaderContent.includes('attendly-logo.png'), 'WorkspaceHeader must import attendly-logo.png');
  assert(wsHeaderContent.includes('updateSessionState({ appPhase: \'setup\' })'), 'Clicking logo must navigate back to setup');
  assert(wsHeaderContent.includes('cursor: \'pointer\''), 'Logo must have pointer cursor');
  assert(wsHeaderContent.includes('onMouseEnter'), 'Logo must have subtle hover effect');
  assert(wsHeaderContent.includes('width: \'24px\'') || wsHeaderContent.includes('width: "24px"'), 'Logo must be sized appropriately (not dominating header)');
  pass('WorkspaceHeader contains clickable, hoverable, appropriately sized Attendly logo');

  // Verify Setup button was removed completely
  assert(!wsHeaderContent.includes('>Setup</button>'), 'Setup button in top-right header must be completely removed');
  assert(!wsHeaderContent.includes('> Setup </button>'), 'Setup button in top-right header must be completely removed');
  pass('Setup button was completely removed from WorkspaceHeader');
} catch (err) {
  fail('WorkspaceHeader logo check failed', err);
}

// 3. SetupWizard Main Screen Logo
try {
  const setupPath = path.join(projectRoot, 'src', 'components', 'screens', 'SetupWizard.tsx');
  const setupContent = fs.readFileSync(setupPath, 'utf8');

  assert(setupContent.includes('attendly-logo.png'), 'SetupWizard must import attendly-logo.png');
  assert(setupContent.includes('<img') && (setupContent.includes('alt="Rollvia Logo"') || setupContent.includes('alt="Attendly Logo"')), 'Setup screen must render Rollvia logo');
  assert(setupContent.includes('enterWorkspace()'), 'Clicking logo in setup should navigate to workspace when ready');
  pass('Setup screen displays Rollvia logo as primary visual identity');
} catch (err) {
  fail('Setup screen logo check failed', err);
}

// 4. TitleBar Native Integration
try {
  const titleBarPath = path.join(projectRoot, 'src', 'components', 'layout', 'TitleBar.tsx');
  const titleBarContent = fs.readFileSync(titleBarPath, 'utf8');

  assert(titleBarContent.includes('attendly-logo.png'), 'TitleBar must import attendly-logo.png');
  assert(titleBarContent.includes('<img') && (titleBarContent.includes('alt="Rollvia"') || titleBarContent.includes('alt="Attendly"')), 'TitleBar must render logo');
  pass('TitleBar uses Rollvia logo for unified desktop branding');
} catch (err) {
  fail('TitleBar logo check failed', err);
}

// Summary
console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
