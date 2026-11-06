import { contextBridge, ipcRenderer } from "electron";
import type { ProjectContext } from "./policy";

// Installed only on the configured first-party view, never on remote sites or
// authentication popups. Main validates the exact WebContents, frame and route.
contextBridge.exposeInMainWorld("rangaBridge", {
  context: (value: ProjectContext | null) =>
    ipcRenderer.send("ranga:context", value),
  openChatGPT: () => ipcRenderer.send("ranga:chatgpt"),
  focusCanvas: (key: string) => ipcRenderer.send("ranga:canvas", key),
  subscribe: (
    callback: (
      value:
        | { type: "query"; key: string; query: string }
        | { type: "references"; key: string }
        | { type: "bring"; key: string }
        | {
            type: "download";
            key: string;
            file: { name: string; type: string; data: string };
          }
        | { type: "layout"; key: string; referenceOnly: boolean },
    ) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: Parameters<typeof callback>[0],
    ) => callback(value);
    ipcRenderer.on("ranga:discovery", listener);
    return () => ipcRenderer.removeListener("ranga:discovery", listener);
  },
});
