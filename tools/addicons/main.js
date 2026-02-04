const { app, BrowserWindow } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadURL(pathToFileURL(path.join(__dirname, "index.html")).href);
}

app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
