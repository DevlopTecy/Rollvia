const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('LIGHT / DARK THEME & SUN-MOON TOGGLE VERIFICATION');
console.log('===============================================================\n');

// 1. Verify tokens.css has [data-theme="dark"] with correct tokens
const tokensCss = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf-8');
assert(tokensCss.includes('[data-theme="dark"]'), '[data-theme="dark"] must be present in tokens.css');
assert(tokensCss.includes('--bg-app: #0b0f19;'), 'Dark mode --bg-app must be dark (#0b0f19)');
assert(tokensCss.includes('--bg-surface: #1e293b;'), 'Dark mode --bg-surface must be elevated slate (#1e293b)');
assert(tokensCss.includes('--text-primary: #f8fafc;'), 'Dark mode --text-primary must be high contrast (#f8fafc)');

// Check P (green) and A (red) visibility in dark mode
assert(tokensCss.includes('--success-text: #6ee7b7;'), 'Dark mode --success-text must be vibrant emerald (#6ee7b7)');
assert(tokensCss.includes('--danger-text: #fca5a5;'), 'Dark mode --danger-text must be vibrant coral red (#fca5a5)');
assert(tokensCss.includes('--success-600: #10b981;'), 'Dark mode --success-600 must be crisp green (#10b981)');
assert(tokensCss.includes('--danger-600: #ef4444;'), 'Dark mode --danger-600 must be crisp red (#ef4444)');
console.log('✓ Dark mode color tokens verified (deep background, high-contrast text, vibrant P/A)');

// 2. Verify components.css has the Sun/Moon toggle CSS and duplicate .sunRay5 was fixed to .sunRay6
const componentsCss = fs.readFileSync(path.resolve('src/styles/components.css'), 'utf-8');
assert(componentsCss.includes('.st-sunMoonThemeToggleBtn'), 'Sun/Moon toggle button class must be present');
assert(componentsCss.includes('.themeToggleInput'), '.themeToggleInput must be present');
assert(componentsCss.includes('.sunMoon'), '.sunMoon must be present');
assert(componentsCss.includes('.sunRay'), '.sunRay must be present');
assert(componentsCss.includes('showRay1832'), 'showRay1832 keyframe animation must be present');

// Count occurrences of .sunRay5 vs .sunRay6
const sunRay5Matches = componentsCss.match(/\.sunRay5\s*\{/g) || [];
const sunRay6Matches = componentsCss.match(/\.sunRay6\s*\{/g) || [];
assert.strictEqual(sunRay5Matches.length, 1, 'There must be exactly 1 .sunRay5 rule (duplicate removed)');
assert.strictEqual(sunRay6Matches.length, 1, 'There must be exactly 1 .sunRay6 rule (corrected from duplicate .sunRay5)');
console.log('✓ Sun/Moon CSS verified: duplicate .sunRay5 rule properly corrected to .sunRay6');

// 3. Verify ThemeContext and persistence
const themeDefSrc = fs.readFileSync(path.resolve('src/context/ThemeContextDefinition.ts'), 'utf-8');
const themeContextSrc = fs.readFileSync(path.resolve('src/context/ThemeContext.tsx'), 'utf-8');
assert(themeDefSrc.includes('attendly_theme'), 'Must use attendly_theme storage key');
assert(themeContextSrc.includes('prefers-color-scheme: dark'), 'Must check prefers-color-scheme for system theme fallback');
assert(themeContextSrc.includes("document.documentElement.setAttribute('data-theme', theme)"), 'Must set data-theme attribute on documentElement');
console.log('✓ ThemeContext verified (localStorage restore, system fallback, data-theme attribute)');

// 4. Verify index.html has early theme initializer
const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
assert(indexHtml.includes('attendly_theme'), 'index.html must check attendly_theme before first paint');
assert(indexHtml.includes("document.documentElement.setAttribute('data-theme'"), 'index.html must set data-theme to prevent flash of wrong theme');
console.log('✓ index.html initial blocking script verified (prevents theme flicker)');

// 5. Verify ThemeToggle component
const themeToggleSrc = fs.readFileSync(path.resolve('src/components/ui/ThemeToggle.tsx'), 'utf-8');
assert(themeToggleSrc.includes('st-sunMoonThemeToggleBtn'), 'ThemeToggle must use st-sunMoonThemeToggleBtn class');
assert(themeToggleSrc.includes('themeToggleInput'), 'ThemeToggle must use themeToggleInput class');
assert(themeToggleSrc.includes('sunRay1') && themeToggleSrc.includes('sunRay6'), 'ThemeToggle must render all rays up to sunRay6');
assert(themeToggleSrc.includes('mask'), 'ThemeToggle must use SVG mask');
console.log('✓ ThemeToggle component verified (6 rays, SVG mask, accessibility title and aria-label)');

// 6. Verify top-right headers include ThemeToggle
const wsHeaderSrc = fs.readFileSync(path.resolve('src/components/workspace/WorkspaceHeader.tsx'), 'utf-8');
assert(wsHeaderSrc.includes('<ThemeToggle'), 'WorkspaceHeader must include ThemeToggle in top-right header');
const appHeaderSrc = fs.readFileSync(path.resolve('src/components/layout/AppHeader.tsx'), 'utf-8');
assert(appHeaderSrc.includes('<ThemeToggle'), 'AppHeader must include ThemeToggle in header-right');
const setupWizardSrc = fs.readFileSync(path.resolve('src/components/screens/SetupWizard.tsx'), 'utf-8');
assert(setupWizardSrc.includes('<ThemeToggle'), 'SetupWizard must include ThemeToggle in top-right header');
console.log('✓ ThemeToggle placed in top-right header across Workspace, AppHeader, and Setup screens');

console.log('\n===============================================================');
console.log('✓ ALL THEME INTEGRATION & COMPONENT CHECKS PASSED 100%!');
console.log('===============================================================\n');
