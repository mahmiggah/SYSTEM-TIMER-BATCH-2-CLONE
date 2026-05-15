const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // If you want to enable service workers (optional), set:
      // webSecurity: false,
      // allowRunningInsecureContent: true
    }
  });
  // Load your local index.html file (adjust the path if needed)
  win.loadFile(path.join(__dirname, 'my-timer', 'index.html'));
  // To open DevTools, uncomment next line:
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
