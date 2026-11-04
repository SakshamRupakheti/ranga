import { contextBridge, ipcRenderer } from "electron";
import type { Command, Mode, Site, WorkspaceState } from "./policy";

contextBridge.exposeInMainWorld("rangaWorkspace", {
  select: (site: Site) => ipcRenderer.send("workspace:select", site),
  command: (command: Command) => ipcRenderer.send("workspace:command", command),
  mode: (mode: Mode) => ipcRenderer.send("workspace:mode", mode),
  search: (query: string, projectKey: string | null) =>
    ipcRenderer.send("workspace:search", { query, projectKey }),
  resize: (ratio: number) => ipcRenderer.send("workspace:resize", ratio),
  ready: () => ipcRenderer.send("workspace:ready"),
  subscribe: (callback: (state: WorkspaceState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: WorkspaceState,
    ) => callback(state);
    ipcRenderer.on("workspace:state", listener);
    return () => ipcRenderer.removeListener("workspace:state", listener);
  },
});
