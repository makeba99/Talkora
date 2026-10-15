const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.NODE_ENV = "production";
process.chdir(path.join(__dirname, ".."));

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "TeamsPilot",
    backgroundColor: "#101410",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  const allowed = new URL(url).origin;
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    openIfMicrosoft(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(allowed)) {
      event.preventDefault();
      openIfMicrosoft(target);
    }
  });
  win.loadURL(url);
}

function openIfMicrosoft(target) {
  try {
    const host = new URL(target).hostname;
    if (host === "microsoft.com" || host.endsWith(".microsoft.com") || host.endsWith(".microsoftonline.com")) {
      shell.openExternal(target);
    }
  } catch {
    // Ignore malformed links.
  }
}

app.whenReady().then(async () => {
  try {
    const serverUrl = pathToFileURL(path.join(__dirname, "..", "dist", "server.js")).href;
    const { ready } = await import(serverUrl);
    const { url } = await ready;
    createWindow(url);
  } catch (error) {
    dialog.showErrorBox("TeamsPilot", error instanceof Error ? error.message : "TeamsPilot could not start.");
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
