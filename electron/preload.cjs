// @ts-check
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  /** @param {function(boolean): void} callback */
  onMaximizeChange: (callback) => {
    /** @param {unknown} _event @param {boolean} isMax */
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window-maximize-changed', handler);
    return () => ipcRenderer.removeListener('window-maximize-changed', handler);
  },
  /** @param {string} theme */
  setTheme: (theme) => ipcRenderer.send('app-set-theme', theme),
  isElectron: true,

  // Excel workbook file operations
  selectExcelFile: () => ipcRenderer.invoke('excel-select-file'),
  /** @param {string} [defaultName] */
  saveExcelDialog: (defaultName) => ipcRenderer.invoke('excel-save-dialog', defaultName),
  /** @param {string} filePath */
  readExcelBuffer: (filePath) => ipcRenderer.invoke('excel-read-buffer', filePath),
  /** @param {string} filePath @param {unknown} buffer */
  writeExcelBuffer: (filePath, buffer) => ipcRenderer.invoke('excel-write-buffer', filePath, buffer),
  /** @param {string} filePath */
  verifyExcelFile: (filePath) => ipcRenderer.invoke('excel-verify-file', filePath),
  /** @param {string} [fileName] */
  getDefaultExcelPath: (fileName) => ipcRenderer.invoke('excel-get-default-path', fileName),
  /** @param {string} filePath */
  showItemInFolder: (filePath) => ipcRenderer.invoke('excel-show-in-folder', filePath),
  /** @param {string} url */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Google Sheets integration operations
  googleSheetsGetStatus: () => ipcRenderer.invoke('google-sheets-get-status'),
  /** @param {string} clientId @param {string} clientSecret */
  googleSheetsStartOAuth: (clientId, clientSecret) => ipcRenderer.invoke('google-sheets-start-oauth', clientId, clientSecret),
  googleSheetsCancelOAuth: () => ipcRenderer.invoke('google-sheets-cancel-oauth'),
  /** @param {string} token */
  googleSheetsSetToken: (token) => ipcRenderer.invoke('google-sheets-set-token', token),
  /** @param {string} jsonContent */
  googleSheetsSetServiceAccount: (jsonContent) => ipcRenderer.invoke('google-sheets-set-service-account', jsonContent),
  /** @param {string} clientId @param {string} clientSecret */
  googleSheetsSetClientCredentials: (clientId, clientSecret) => ipcRenderer.invoke('google-sheets-set-client-credentials', clientId, clientSecret),
  googleSheetsDisconnect: () => ipcRenderer.invoke('google-sheets-disconnect'),
  /** @param {string} idOrUrl */
  googleSheetsSetSpreadsheet: (idOrUrl) => ipcRenderer.invoke('google-sheets-set-spreadsheet', idOrUrl),
  /** @param {string} title */
  googleSheetsCreateSpreadsheet: (title) => ipcRenderer.invoke('google-sheets-create-spreadsheet', title),
  /** @param {unknown} dataset */
  googleSheetsAppendRecords: (dataset) => ipcRenderer.invoke('google-sheets-append-records', dataset),
});
