// @ts-check
const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerGoogleSheetsIPC } = require('./googleSheets.cjs');

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

/** @param {string} [theme] */
function getAppIcon(theme) {
  const icoName = theme === 'light' ? 'icon-light.ico' : (theme === 'dark' ? 'icon-dark.ico' : 'icon.ico');
  const pngName = theme === 'light' ? 'icon-light.png' : (theme === 'dark' ? 'icon-dark.png' : 'icon.png');
  const candidates = process.platform === 'win32'
    ? [
        path.join(__dirname, 'assets', icoName),
        path.join(__dirname, '../build', icoName),
        path.join(__dirname, '../public', icoName),
        path.join(__dirname, 'assets', pngName),
        path.join(__dirname, '../build', pngName),
        path.join(__dirname, '../public', pngName),
        path.join(__dirname, 'assets/icon.ico'),
        path.join(__dirname, '../build/icon.ico'),
        path.join(__dirname, '../public/icon.ico'),
        path.join(__dirname, 'assets/icon.png'),
        path.join(__dirname, '../build/icon.png'),
        path.join(__dirname, '../public/icon.png'),
      ]
    : [
        path.join(__dirname, 'assets', pngName),
        path.join(__dirname, '../build', pngName),
        path.join(__dirname, '../public', pngName),
        path.join(__dirname, 'assets', icoName),
        path.join(__dirname, 'assets/icon.png'),
        path.join(__dirname, '../build/icon.png'),
        path.join(__dirname, '../public/icon.png'),
        path.join(__dirname, 'assets/icon.ico'),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const img = nativeImage.createFromPath(candidate);
        if (!img.isEmpty()) {
          return { image: img, path: candidate };
        }
      } catch {
        // fallback to next candidate
      }
    }
  }
  return { image: undefined, path: undefined };
}

function createWindow() {
  const appIconInfo = getAppIcon();
  const iconPath = appIconInfo.image || appIconInfo.path;
  mainWindow = new BrowserWindow({
    title: 'Rollvia',
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0f172a',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (appIconInfo.image && typeof mainWindow.setIcon === 'function') {
    try {
      mainWindow.setIcon(appIconInfo.image);
    } catch {
      // ignore
    }
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && !process.env.SERVE_DIST) {
    mainWindow.loadURL(devUrl).catch(() => {
      // If dev server hasn't started yet, wait and retry
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.loadURL(devUrl);
        }
      }, 1500);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('app-set-theme', (_event, theme) => {
  if (mainWindow && typeof mainWindow.setIcon === 'function') {
    const iconInfo = getAppIcon(theme);
    if (iconInfo.image) {
      try {
        mainWindow.setIcon(iconInfo.image);
      } catch {
        // ignore
      }
    }
  }
});

// Excel file operations IPC handlers
ipcMain.handle('excel-select-file', async () => {
  if (!mainWindow) return { canceled: true };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Existing Attendance Workbook',
      filters: [
        { name: 'Excel Workbooks', extensions: ['xlsx', 'xlsm', 'xls'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  } catch (err) {
    return { canceled: true, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('excel-save-dialog', async (_event, defaultName) => {
  if (!mainWindow) return { canceled: true };
  try {
    const defaultFilename = defaultName || 'Rollvia_Attendance.xlsx';
    const documentsDir = app.getPath('documents') || app.getPath('userData') || process.cwd();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Create or Choose Attendance Workbook Location',
      defaultPath: path.join(documentsDir, defaultFilename),
      filters: [
        { name: 'Excel Workbook (.xlsx)', extensions: ['xlsx'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  } catch (err) {
    return { canceled: true, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('excel-read-buffer', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found on disk at: ${filePath}` };
    }
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: new Uint8Array(buffer) };
  } catch (err) {
    return { success: false, error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}` };
  }
});

ipcMain.handle('excel-write-buffer', async (_event, filePath, bufferData) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const buffer = Buffer.from(bufferData);
    fs.writeFileSync(filePath, buffer);

    // Verify written file exists immediately
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Verification failed: File was not created at ${filePath}` };
    }
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { success: false, error: `Verification failed: File at ${filePath} was created with 0 bytes` };
    }

    return { success: true, bytesWritten: stats.size };
  } catch (err) {
    return { success: false, error: `File write failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

ipcMain.handle('excel-verify-file', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, error: 'File does not exist on disk' };
    }
    const stats = fs.statSync(filePath);
    return { exists: true, size: stats.size, mtime: stats.mtime.toISOString() };
  } catch (err) {
    return { exists: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('excel-get-default-path', async (_event, fileName) => {
  const documentsDir = app.getPath('documents') || app.getPath('userData') || process.cwd();
  return path.join(documentsDir, fileName || 'Rollvia_Attendance.xlsx');
});

ipcMain.handle('excel-show-in-folder', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('open-external', async (_event, url) => {
  try {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      await shell.openExternal(url);
      return { success: true };
    }
    return { success: false, error: 'Invalid URL format' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.rollvia.app');
  }
  createWindow();
  registerGoogleSheetsIPC(ipcMain, app, mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
