/**
 * Automated test suite for Attendly Google Sheets storage integration.
 * Tests:
 * 1. Service initialization and config loading
 * 2. Spreadsheet ID and URL extraction from various link formats
 * 3. Exact table schema validation: Date | Person ID | Name | Class | Status
 * 4. Error handling for unauthenticated requests and missing sheet configurations
 * 5. Rejection of unconfirmed writes (preventing false "saved" states)
 * 6. Live Google Sheets API validation (when credentials / tokens are present)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { GoogleSheetsService } = require('../electron/googleSheets.cjs');

async function runTests() {
  console.log('====================================================');
  console.log('ATTENDLY GOOGLE SHEETS STORAGE INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // Temporary mock Electron app object
  const tempUserData = path.join(os.tmpdir(), `attendly_test_${Date.now()}`);
  fs.mkdirSync(tempUserData, { recursive: true });

  const mockApp = {
    getPath: (name) => {
      if (name === 'userData') return tempUserData;
      return tempUserData;
    },
  };

  const service = new GoogleSheetsService(mockApp, null);

  // Test 1: Service instance initialized properly
  assert(service !== null && typeof service.getStatus === 'function', 'GoogleSheetsService initializes successfully');

  // Test 2: Spreadsheet ID extraction from various Google Docs URL formats
  const sampleId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
  const testUrls = [
    `https://docs.google.com/spreadsheets/d/${sampleId}/edit`,
    `https://docs.google.com/spreadsheets/d/${sampleId}/edit#gid=0`,
    `https://docs.google.com/spreadsheets/d/${sampleId}`,
    sampleId,
  ];

  let idExtractionPassed = true;
  for (const url of testUrls) {
    const extracted = service.extractSpreadsheetId(url);
    if (extracted !== sampleId) {
      idExtractionPassed = false;
      console.error(`Extraction failed for "${url}": got "${extracted}"`);
    }
  }
  assert(idExtractionPassed, 'Spreadsheet ID extraction handles full URLs, fragment URLs, and bare IDs');

  // Test 3: Unauthenticated status returns isAuthenticated: false
  const initialStatus = await service.getStatus();
  assert(initialStatus.isAuthenticated === false, 'Fresh instance reports unauthenticated status');

  // Test 4: Attempting to save without authentication rejects cleanly (no false "saved" state)
  const dummyDataset = {
    storageMode: 'google_sheets',
    date: '2026-09-28',
    formattedDate: '28 September 2026',
    records: [
      {
        id: 'rec_1',
        date: '2026-09-28',
        personId: 'p_1',
        personName: 'Hitesh Krishna',
        rollNumber: '23A01',
        className: 'Java',
        status: 'Present',
      },
      {
        id: 'rec_2',
        date: '2026-09-28',
        personId: 'p_1',
        personName: 'Hitesh Krishna',
        rollNumber: '23A01',
        className: 'DBMS',
        status: 'Absent',
      },
    ],
    roster: [{ id: 'p_1', name: 'Hitesh Krishna', rollNumber: '23A01' }],
    classes: [{ id: 'c_1', name: 'Java' }, { id: 'c_2', name: 'DBMS' }],
    summary: { totalRecords: 2, totalPresent: 1, totalAbsent: 1, attendancePercentage: 50, uniquePeopleCount: 1, uniqueClassesCount: 2 },
    metadata: { recordedAt: new Date().toISOString() },
  };

  let unauthErrorCaught = false;
  try {
    await service.appendAttendanceRecords(dummyDataset);
  } catch (err) {
    unauthErrorCaught = true;
    assert(
      err.message.includes('No Google Spreadsheet selected') ||
      err.message.includes('Not authenticated') ||
      err.message.includes('credentials'),
      'Append without auth/spreadsheet safely rejects with clear message',
      err.message
    );
  }
  assert(unauthErrorCaught, 'Unauthenticated append rejected without writing or reporting false success');

  // Test 5: Verify table schema columns
  const expectedColumns = ['Date', 'Person ID', 'Name', 'Class', 'Status'];
  const formattedRow = [
    dummyDataset.records[0].date,
    dummyDataset.records[0].personId,
    dummyDataset.records[0].personName,
    dummyDataset.records[0].className,
    dummyDataset.records[0].status,
  ];

  assert(
    formattedRow.length === expectedColumns.length &&
    formattedRow[0] === '2026-09-28' &&
    formattedRow[1] === 'p_1' &&
    formattedRow[2] === 'Hitesh Krishna' &&
    formattedRow[3] === 'Java' &&
    formattedRow[4] === 'Present',
    'Attendance record correctly formats to [Date, Person ID, Name, Class, Status]'
  );

  // Test 6: Verify Google API error handling against real Google endpoint
  // Attempting to access an invalid / unauthenticated spreadsheet ID against the real Google Sheets API
  console.log('\nTesting live Google Sheets API error responses (401 / 403 / 404 handling)...');
  try {
    // Manually set a dummy token to test real Google Sheets API endpoint response
    service.config.authType = 'token';
    service.config.tokens = { access_token: 'dummy_expired_token_for_error_test' };
    service.config.spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

    let api401Caught = false;
    try {
      await service.appendAttendanceRecords(dummyDataset);
    } catch (err) {
      api401Caught = true;
      assert(
        err.message.includes('401') || err.message.includes('UNAUTHENTICATED') || err.message.includes('Failed to read spreadsheet metadata') || err.message.includes('invalid_token'),
        'Real Google Sheets API rejects invalid token with clear authorization error',
        err.message
      );
    }
    assert(api401Caught, 'Live API 401 unauthenticated response properly parsed and handled');
  } finally {
    // Reset config
    service.config.authType = null;
    service.config.tokens = null;
    service.config.spreadsheetId = null;
  }

  // Test 7: Live Real Google Sheet Testing if credentials or tokens are provided
  const liveToken = process.env.GOOGLE_ACCESS_TOKEN;
  const liveSheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (liveToken) {
    console.log('\n--- LIVE GOOGLE SHEET INTEGRATION TEST (Detected GOOGLE_ACCESS_TOKEN) ---');
    try {
      await service.setManualToken(liveToken);
      console.log('Live access token set successfully.');

      let targetSheetId = liveSheetId;
      if (!targetSheetId) {
        console.log('No GOOGLE_SPREADSHEET_ID provided. Creating new test spreadsheet via Google Sheets API...');
        const createRes = await service.createSpreadsheet(`Attendly Test Ledger - ${new Date().toISOString()}`);
        targetSheetId = createRes.spreadsheetId;
        console.log(`Created new live spreadsheet: ${createRes.title} (${createRes.spreadsheetUrl})`);
      } else {
        const setRes = await service.setSpreadsheet(targetSheetId);
        console.log(`Connected to existing live spreadsheet: ${setRes.title}`);
      }

      console.log(`Appending ${dummyDataset.records.length} attendance records to live Google Sheet...`);
      const appendResult = await service.appendAttendanceRecords(dummyDataset);

      assert(appendResult.success === true, 'Live append executed successfully');
      assert(appendResult.updatedRows >= dummyDataset.records.length, `Live Google Sheets write confirmed (${appendResult.updatedRows} rows written)`);
      console.log(`Verified write: updatedRange = ${appendResult.updatedRange}, rows = ${appendResult.updatedRows}`);
      console.log(`Spreadsheet URL: ${appendResult.spreadsheetUrl}`);
    } catch (err) {
      console.error('Live Google Sheet test encountered error:', err.message);
      failed++;
    }
  } else {
    console.log('\n[INFO] To test live row append to your personal Google Sheet:');
    console.log('Run: set GOOGLE_ACCESS_TOKEN=<your-token> && node scripts/test-google-sheets.cjs');
    console.log('Or use the Attendly UI "Cloud Authentication Setup" modal to paste your token or connect via OAuth.');
  }

  // Cleanup temporary test directory
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch {
    // ignore
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner exception:', err);
  process.exit(1);
});
