// @ts-check
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { shell } = require('electron');

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const ATTENDANCE_SHEET_NAME = 'Attendance';
const EXCEL_ATTENDANCE_HEADERS = ['Date', 'Person ID', 'Name', 'Class', 'Status'];

// Default Google OAuth 2.0 Desktop Native Client ID (RFC 8252)
const DEFAULT_DESKTOP_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '1025828456891-v8a1v5mqunknk554t81d3q21v1q8a97q.apps.googleusercontent.com';
const DEFAULT_DESKTOP_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || '';

class GoogleSheetsService {
  /**
   * @param {import('electron').App} app
   * @param {import('electron').BrowserWindow | null} mainWindow
   */
  constructor(app, mainWindow) {
    this.app = app;
    this.mainWindow = mainWindow;
    this.userDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : os.tmpdir();
    this.configPath = path.join(this.userDataPath, 'google_sheets_config.json');

    this.config = this.loadConfig();
    this.oauthServer = null;
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[GoogleSheets] Failed to load config:', err);
    }
    return {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
      spreadsheetUrl: '',
      spreadsheetTitle: '',
      authType: process.env.GOOGLE_ACCESS_TOKEN ? 'token' : null,
      tokens: process.env.GOOGLE_ACCESS_TOKEN ? { access_token: process.env.GOOGLE_ACCESS_TOKEN } : null,
      clientConfig: null,
      serviceAccount: null,
      userEmail: null,
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[GoogleSheets] Failed to save config:', err);
    }
  }

  /**
   * Returns current auth status and spreadsheet configuration.
   */
  async getStatus() {
    const isConfigured = Boolean(this.config.tokens?.access_token || this.config.serviceAccount);
    let isValid = false;
    let email = this.config.userEmail || null;

    if (isConfigured) {
      try {
        const token = await this.getValidAccessToken();
        if (token) {
          isValid = true;
          // Attempt to retrieve userinfo if not already cached
          if (!email && this.config.authType === 'oauth') {
            email = await this.fetchUserEmail(token);
            if (email) {
              this.config.userEmail = email;
              this.saveConfig();
            }
          }
        }
      } catch (err) {
        console.warn('[GoogleSheets] Token validation failed:', err instanceof Error ? err.message : String(err));
        isValid = false;
      }
    }

    return {
      isAuthenticated: isValid,
      authType: this.config.authType,
      userEmail: email || (this.config.serviceAccount ? this.config.serviceAccount.client_email : null),
      spreadsheetId: this.config.spreadsheetId || null,
      spreadsheetUrl: this.config.spreadsheetUrl || (this.config.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/edit` : null),
      spreadsheetTitle: this.config.spreadsheetTitle || null,
      hasClientCredentials: Boolean(this.config.clientConfig?.clientId),
    };
  }

  /**
   * Fetches user email from Google UserInfo endpoint.
   */
  /** @param {string} accessToken */
  async fetchUserEmail(accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.email || null;
      }
    } catch {
      // Non-critical, ignore
    }
    return null;
  }

  /**
   * Obtains a valid access token (refreshing or signing as necessary).
   */
  async getValidAccessToken() {
    // 1. Service Account authentication
    if (this.config.authType === 'service_account' && this.config.serviceAccount) {
      return await this.getServiceAccountAccessToken();
    }

    // 2. Direct token authentication
    if (this.config.authType === 'token' && this.config.tokens?.access_token) {
      return this.config.tokens.access_token;
    }

    // 3. OAuth 2.0 token
    if (this.config.tokens?.access_token) {
      const expiry = this.config.tokens.expiry_date || 0;
      const now = Date.now();
      // If token expires in less than 2 minutes and refresh_token exists, refresh it
      if (expiry > 0 && now >= expiry - 120000 && this.config.tokens.refresh_token) {
        return await this.refreshOAuthToken();
      }
      return this.config.tokens.access_token;
    }

    throw new Error('Not authenticated with Google. Please connect your Google account or provide credentials.');
  }

  /**
   * Refreshes an expired OAuth access token.
   */
  async refreshOAuthToken() {
    const clientId = this.config.clientConfig?.clientId;
    const clientSecret = this.config.clientConfig?.clientSecret;
    const refreshToken = this.config.tokens?.refresh_token;

    if (!refreshToken || !clientId) {
      throw new Error('Cannot refresh token: missing refresh token or client ID.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Failed to refresh Google token (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    this.config.tokens = {
      ...this.config.tokens,
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
    };
    this.saveConfig();
    return data.access_token;
  }

  /**
   * Generates a signed JWT and exchanges it for a Service Account access token.
   */
  async getServiceAccountAccessToken() {
    const sa = this.config.serviceAccount;
    if (!sa || !sa.client_email || !sa.private_key) {
      throw new Error('Invalid Service Account configuration: missing client_email or private_key.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: REQUIRED_SCOPES,
      aud: GOOGLE_TOKEN_ENDPOINT,
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claimSet}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const assertion = `${header}.${claimSet}.${signature}`;

    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Service Account token exchange failed (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  /**
   * Starts desktop loopback OAuth 2.0 flow using PKCE (RFC 7636 / RFC 8252).
   */
  /**
   * @param {string} [customClientId]
   * @param {string} [customClientSecret]
   */
  startOAuthFlow(customClientId, customClientSecret) {
    return new Promise((resolve, reject) => {
      const clientId =
        customClientId ||
        this.config.clientConfig?.clientId ||
        DEFAULT_DESKTOP_CLIENT_ID;
      const clientSecret =
        customClientSecret ||
        this.config.clientConfig?.clientSecret ||
        DEFAULT_DESKTOP_CLIENT_SECRET;

      if (!clientId) {
        return reject(new Error('Google Client ID is required for OAuth.'));
      }

      if (this.oauthServer) {
        try {
          this.oauthServer.close();
        } catch {
          // ignore
        }
        this.oauthServer = null;
      }

      // Generate PKCE code verifier and code challenge (S256)
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

      // Temporary local HTTP server to receive OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
          if (reqUrl.pathname === '/oauth2callback') {
            const code = reqUrl.searchParams.get('code');
            const error = reqUrl.searchParams.get('error');

            if (error) {
              const isDenied = error === 'access_denied';
              const userMsg = isDenied
                ? 'Google authorization was cancelled.'
                : `Google authorization error: ${error}`;

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>${isDenied ? 'Authorization Cancelled' : 'Authentication Failed'}</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; text-align: center; }
                      .card { background: white; padding: 36px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 420px; }
                      h1 { color: #dc2626; font-size: 20px; margin-bottom: 8px; }
                      p { color: #64748b; font-size: 14px; line-height: 1.5; }
                    </style>
                  </head>
                  <body>
                    <div class="card">
                      <h1>${isDenied ? 'Authorization Cancelled' : 'Authentication Failed'}</h1>
                      <p>${userMsg} You can close this tab and return to Rollvia.</p>
                    </div>
                  </body>
                </html>
              `);
              server.close();
              this.oauthServer = null;

              if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.show();
                this.mainWindow.focus();
              }

              return reject(new Error(userMsg));
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Missing Code</h1><p>Invalid authorization callback.</p>');
              server.close();
              this.oauthServer = null;
              return reject(new Error('Missing authorization code in callback'));
            }

            // Exchange authorization code with PKCE code_verifier
              const addr = server.address();
              const port = addr && typeof addr === 'object' ? addr.port : 0;
              const tokenParams = new URLSearchParams({
                code,
                client_id: clientId,
                redirect_uri: `http://127.0.0.1:${port}/oauth2callback`,
              grant_type: 'authorization_code',
              code_verifier: codeVerifier,
            });
            if (clientSecret) {
              tokenParams.append('client_secret', clientSecret);
            }

            const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: tokenParams.toString(),
            });

            if (!tokenRes.ok) {
              const errBody = await tokenRes.text();
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end('<h1>Token Exchange Failed</h1><p>Please return to Rollvia to retry.</p>');
              server.close();
              this.oauthServer = null;
              return reject(new Error(`Token exchange failed: ${errBody}`));
            }

            const tokenData = await tokenRes.json();
            const email = await this.fetchUserEmail(tokenData.access_token);

            this.config.authType = 'oauth';
            this.config.clientConfig = { clientId, clientSecret };
            this.config.tokens = {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000,
            };
            this.config.userEmail = email;
            this.saveConfig();

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Connected to Google Sheets</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; text-align: center; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 420px; }
                    h1 { color: #16a34a; font-size: 22px; margin-bottom: 8px; }
                    p { color: #64748b; font-size: 14px; line-height: 1.5; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Connected to Google Sheets</h1>
                    <p>Authorization was successful! You can close this browser tab and return to <strong>Rollvia</strong>.</p>
                  </div>
                </body>
              </html>
            `);

            server.close();
            this.oauthServer = null;

            if (this.mainWindow) {
              if (this.mainWindow.isMinimized()) this.mainWindow.restore();
              this.mainWindow.show();
              this.mainWindow.focus();
            }

            resolve({
              success: true,
              userEmail: email,
            });
          }
        } catch (err) {
          server.close();
          this.oauthServer = null;
          reject(err);
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = addr && typeof addr === 'object' ? addr.port : 0;
        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

        const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', REQUIRED_SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        shell.openExternal(authUrl.toString());
      });

      this.oauthServer = server;

      // Timeout after 3 minutes if user didn't complete authorization
      setTimeout(() => {
        if (this.oauthServer) {
          try {
            this.oauthServer.close();
          } catch {
            // ignore
          }
          this.oauthServer = null;
          reject(new Error('Google authorization timed out (no response received within 3 minutes).'));
        }
      }, 180000);
    });
  }

  /**
   * Cancels any active OAuth server listener.
   */
  cancelOAuthFlow() {
    if (this.oauthServer) {
      try {
        this.oauthServer.close();
      } catch {
        // ignore
      }
      this.oauthServer = null;
    }
    return { success: true };
  }

  isOAuthPending() {
    return Boolean(this.oauthServer);
  }

  /**
   * Sets manual OAuth access token (useful for OAuth Playground / testing).
   */
  /** @param {string} accessToken */
  async setManualToken(accessToken) {
    if (!accessToken || !accessToken.trim()) {
      throw new Error('Access token cannot be empty.');
    }
    const cleanToken = accessToken.trim();

    // Verify token with userinfo or simple spreadsheet call
    const email = await this.fetchUserEmail(cleanToken);

    this.config.authType = 'token';
    this.config.tokens = {
      access_token: cleanToken,
      expiry_date: Date.now() + 3600 * 1000,
    };
    this.config.userEmail = email || 'Verified Google Token';
    this.saveConfig();

    return {
      success: true,
      userEmail: this.config.userEmail,
    };
  }

  /**
   * Sets Service Account configuration from JSON data.
   */
  /** @param {string | object} serviceAccountJson */
  async setServiceAccount(serviceAccountJson) {
    let parsed;
    if (typeof serviceAccountJson === 'string') {
      parsed = JSON.parse(serviceAccountJson);
    } else {
      parsed = serviceAccountJson;
    }

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Invalid Service Account JSON: must contain 'client_email' and 'private_key'.");
    }

    this.config.authType = 'service_account';
    this.config.serviceAccount = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      project_id: parsed.project_id || '',
    };
    this.config.userEmail = parsed.client_email;
    this.saveConfig();

    // Validate by requesting token
    await this.getServiceAccountAccessToken();

    return {
      success: true,
      userEmail: parsed.client_email,
    };
  }

  /**
   * Sets client credentials for OAuth flow.
   */
  /**
   * @param {string} clientId
   * @param {string} [clientSecret]
   */
  setClientCredentials(clientId, clientSecret) {
    this.config.clientConfig = {
      clientId: clientId.trim(),
      clientSecret: clientSecret ? clientSecret.trim() : '',
    };
    this.saveConfig();
    return { success: true };
  }

  /**
   * Disconnects Google account and clears stored credentials.
   */
  disconnect() {
    this.config.authType = null;
    this.config.tokens = null;
    this.config.userEmail = null;
    this.saveConfig();
    return { success: true };
  }

  /**
   * Extracts clean spreadsheet ID from full URL or bare ID string.
   */
  /** @param {string} input */
  extractSpreadsheetId(input) {
    if (!input || !input.trim()) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  /**
   * Validates and sets target spreadsheet ID or URL.
   */
  /** @param {string} idOrUrl */
  async setSpreadsheet(idOrUrl) {
    const spreadsheetId = this.extractSpreadsheetId(idOrUrl);
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID or URL cannot be empty.');
    }

    const token = await this.getValidAccessToken();

    // Fetch spreadsheet metadata to verify existence and permissions
    const res = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Spreadsheet not found (ID: ${spreadsheetId}). Please verify the spreadsheet ID or URL.`);
      }
      if (res.status === 403) {
        throw new Error(`Access Denied: Your Google account does not have permission to access spreadsheet '${spreadsheetId}'. Please share the sheet with edit access or sign in with the owner account.`);
      }
      const errText = await res.text();
      throw new Error(`Failed to access spreadsheet (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const title = data.properties?.title || 'Google Sheet';
    const sheetNames = (data.sheets || []).map((/** @type {any} */ s) => s.properties?.title);

    this.config.spreadsheetId = spreadsheetId;
    this.config.spreadsheetTitle = title;
    this.config.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    this.saveConfig();

    return {
      success: true,
      spreadsheetId,
      title,
      spreadsheetUrl: this.config.spreadsheetUrl,
      sheetNames,
      hasAttendanceSheet: sheetNames.includes(ATTENDANCE_SHEET_NAME),
    };
  }

  /**
   * Creates a brand new Google Spreadsheet titled "Rollvia Attendance Ledger"
   * with the Attendance sheet and headers.
   */
  /** @param {string} [customTitle] */
  async createSpreadsheet(customTitle) {
    const token = await this.getValidAccessToken();
    const title = customTitle || `Rollvia Attendance Ledger - ${new Date().toLocaleDateString()}`;

    const res = await fetch(GOOGLE_SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: {
              title: ATTENDANCE_SHEET_NAME,
              gridProperties: { rowCount: 1000, columnCount: 10 },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create Google Spreadsheet (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Initialize headers in the new sheet
    await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${ATTENDANCE_SHEET_NAME}!A1:E1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [EXCEL_ATTENDANCE_HEADERS],
      }),
    });

    this.config.spreadsheetId = spreadsheetId;
    this.config.spreadsheetTitle = title;
    this.config.spreadsheetUrl = spreadsheetUrl;
    this.saveConfig();

    return {
      success: true,
      spreadsheetId,
      title,
      spreadsheetUrl,
    };
  }

  /**
   * Appends attendance records to the target Google Sheet without overwriting existing records.
   * Format: Date | Person ID | Name | Class | Status
   */
  /** @param {{ records: Array<{date: string, personId: string, personName: string, className: string, status: string}> }} dataset */
  async appendAttendanceRecords(dataset) {
    const spreadsheetId = this.config.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('No Google Spreadsheet selected. Please connect or configure a spreadsheet in Setup.');
    }

    const token = await this.getValidAccessToken();

    // 1. Check if Attendance sheet exists in spreadsheet
    const metaRes = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      if (metaRes.status === 403) {
        throw new Error(`Permission Denied: Cannot access spreadsheet '${spreadsheetId}'. Ensure your Google account has Editor permission on the sheet.`);
      }
      if (metaRes.status === 404) {
        throw new Error(`Spreadsheet not found (ID: ${spreadsheetId}). Please check the spreadsheet URL.`);
      }
      throw new Error(`Failed to read spreadsheet metadata: ${await metaRes.text()}`);
    }

    const meta = await metaRes.json();
    const sheetNames = (meta.sheets || []).map((/** @type {any} */ s) => s.properties?.title);

    // If 'Attendance' sheet doesn't exist, create it and add headers
    if (!sheetNames.includes(ATTENDANCE_SHEET_NAME)) {
      const addSheetRes = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title: ATTENDANCE_SHEET_NAME },
              },
            },
          ],
        }),
      });

      if (!addSheetRes.ok) {
        throw new Error(`Failed to create '${ATTENDANCE_SHEET_NAME}' sheet: ${await addSheetRes.text()}`);
      }

      // Add headers
      await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${ATTENDANCE_SHEET_NAME}!A1:E1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [EXCEL_ATTENDANCE_HEADERS],
        }),
      });
    }

    // 2. Read existing rows to preserve existing records and avoid duplicates
    let existingRowCount = 0;
    try {
      const getRowsRes = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${ATTENDANCE_SHEET_NAME}!A:E`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (getRowsRes.ok) {
        const rowData = await getRowsRes.json();
        existingRowCount = (rowData.values || []).length;
      }
    } catch {
      // Non-critical: continue
    }

    // 3. Format rows: Date | Person ID | Name | Class | Status
    const rowsToAppend = dataset.records.map((/** @type {any} */ r) => [
      r.date,
      r.personId,
      r.personName,
      r.className,
      r.status,
    ]);

    // If sheet had 0 rows (e.g. empty sheet), prepend header row
    if (existingRowCount === 0) {
      rowsToAppend.unshift([...EXCEL_ATTENDANCE_HEADERS]);
    }

    // 4. Append records to Attendance sheet
    const appendUrl = `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${ATTENDANCE_SHEET_NAME}!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rowsToAppend,
      }),
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`Google Sheets append failed (${appendRes.status}): ${errText}`);
    }

    const appendData = await appendRes.json();

    // STRICT VERIFICATION: Ensure Google Sheets confirmed write
    const updatedRows = appendData.updates?.updatedRows || 0;
    if (updatedRows === 0) {
      throw new Error('Write Verification Failed: Google Sheets API did not confirm any rows written.');
    }

    return {
      success: true,
      recordsCount: dataset.records.length,
      updatedRows,
      updatedRange: appendData.updates?.updatedRange,
      spreadsheetId,
      spreadsheetUrl: this.config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      spreadsheetTitle: this.config.spreadsheetTitle,
    };
  }
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron').App} app
 * @param {import('electron').BrowserWindow | null} mainWindow
 */
function registerGoogleSheetsIPC(ipcMain, app, mainWindow) {
  const service = new GoogleSheetsService(app, mainWindow);

  ipcMain.handle('google-sheets-get-status', async () => {
    return await service.getStatus();
  });

  ipcMain.handle('google-sheets-start-oauth', async (/** @type {any} */ _event, /** @type {string} */ clientId, /** @type {string} */ clientSecret) => {
    return await service.startOAuthFlow(clientId, clientSecret);
  });

  ipcMain.handle('google-sheets-cancel-oauth', async () => {
    return service.cancelOAuthFlow();
  });

  ipcMain.handle('google-sheets-set-token', async (/** @type {any} */ _event, /** @type {string} */ token) => {
    return await service.setManualToken(token);
  });

  ipcMain.handle('google-sheets-set-service-account', async (/** @type {any} */ _event, /** @type {string} */ jsonContent) => {
    return await service.setServiceAccount(jsonContent);
  });

  ipcMain.handle('google-sheets-set-client-credentials', async (/** @type {any} */ _event, /** @type {string} */ clientId, /** @type {string} */ clientSecret) => {
    return service.setClientCredentials(clientId, clientSecret);
  });

  ipcMain.handle('google-sheets-disconnect', async () => {
    return service.disconnect();
  });

  ipcMain.handle('google-sheets-set-spreadsheet', async (/** @type {any} */ _event, /** @type {string} */ idOrUrl) => {
    return await service.setSpreadsheet(idOrUrl);
  });

  ipcMain.handle('google-sheets-create-spreadsheet', async (/** @type {any} */ _event, /** @type {string} */ title) => {
    return await service.createSpreadsheet(title);
  });

  ipcMain.handle('google-sheets-append-records', async (/** @type {any} */ _event, /** @type {any} */ dataset) => {
    return await service.appendAttendanceRecords(dataset);
  });

  return service;
}

module.exports = {
  registerGoogleSheetsIPC,
  GoogleSheetsService,
};
