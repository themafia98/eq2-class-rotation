// Safe IPC bridge from the Electron main process to the overlay page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("advisor", {
  onState: (cb) => ipcRenderer.on("state", (_e, s) => cb(s)),
  onMeta: (cb) => ipcRenderer.on("meta", (_e, m) => cb(m)),
  setRole: (id) => ipcRenderer.send("set-role", id),
  openSettings: () => ipcRenderer.send("open-settings"),
});
