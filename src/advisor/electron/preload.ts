// Typed IPC bridge exposed to the overlay as window.advisor.
import { contextBridge, ipcRenderer } from "electron";
import type { AdvisorApi, ClassData, Meta, ViewState } from "../../shared/types";

const api: AdvisorApi = {
  onState: (cb) => ipcRenderer.on("state", (_e, s: ViewState) => cb(s)),
  onMeta: (cb) => ipcRenderer.on("meta", (_e, m: Meta) => cb(m)),
  onToggleEditor: (cb) => ipcRenderer.on("toggle-editor", () => cb()),
  setRole: (id) => ipcRenderer.send("set-role", id),
  openSettings: () => ipcRenderer.send("open-settings"),
  saveClass: (data: ClassData) => ipcRenderer.send("save-class", data),
  restartToUpdate: () => ipcRenderer.send("restart-to-update"),
};

contextBridge.exposeInMainWorld("advisor", api);
