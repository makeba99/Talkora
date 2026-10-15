const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("teamspilot", { desktop: true });
