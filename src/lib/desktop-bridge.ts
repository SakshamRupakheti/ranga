// No bridge is required for the web app. Electron installs this narrow surface
// on its first-party Ranga view; remote panes never receive it.
export type DiscoveryEvent = {
  type: "query" | "references";
  key: string;
  query?: string;
};
declare global {
  interface Window {
    rangaBridge?: {
      context: (
        value: {
          key: string;
          name: string;
          query: string;
          prompt: string;
          editable: boolean;
        } | null,
      ) => void;
      openChatGPT: () => void;
      subscribe: (callback: (value: DiscoveryEvent) => void) => () => void;
    };
  }
}
export {};
