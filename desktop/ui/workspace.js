/* Only this local toolbar receives the workspace bridge. No remote DOM access. */
const bridge = window.rangaWorkspace;
const byId = (id) => document.getElementById(id);
let projectKey = null;
let previousQuery;
document.querySelectorAll("[data-site]").forEach((button) => {
  button.addEventListener("click", () => bridge.select(button.dataset.site));
});
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () =>
    bridge.command(button.dataset.command),
  );
});
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => bridge.mode(button.dataset.mode));
});
byId("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  bridge.search(byId("query").value, projectKey);
});
byId("pane-ratio").addEventListener("input", (event) =>
  bridge.resize(Number(event.target.value) / 100),
);
const names = { ranga: "Ranga", chatgpt: "ChatGPT", pinterest: "Pinterest" };
bridge.subscribe((state) => {
  // Loading/focus notifications must not overwrite a query being typed.
  if (projectKey !== state.projectKey || previousQuery !== state.query)
    byId("query").value = state.query;
  projectKey = state.projectKey;
  previousQuery = state.query;
  document.querySelectorAll("[data-site]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.site === state.focused),
    );
    button.title = `${names[button.dataset.site]}: ${state.pages[button.dataset.site]}`;
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.mode === state.mode),
    );
  });
  byId("project").textContent = state.projectName;
  byId("import-download").hidden = !state.downloadName;
  byId("import-download").disabled = state.downloadBusy;
  byId("import-download").title =
    `Preview ${state.downloadName} in ${state.projectName}`;
  byId("dismiss-download").hidden = !state.downloadName;
  byId("dismiss-download").disabled = state.downloadBusy;
  byId("project").title = state.projectKey
    ? `${state.projectName}${state.editable ? "" : " (read-only)"}`
    : "Open a project in Ranga to keep its query";
  byId("split").setAttribute("aria-pressed", String(state.split));
  byId("back").disabled = !state.back;
  byId("forward").disabled = !state.forward;
  byId("origin").textContent = state.origin;
  byId("pane").textContent =
    `${names[state.focused]} · ${state.pages[state.focused]}`;
  byId("activity").classList.toggle("loading", state.loading);
  byId("message").textContent =
    state.message ||
    (state.mode === "discover"
      ? `Pinterest: ${state.pages.pinterest}. ChatGPT: ${state.pages.chatgpt}. Click a pane to use its navigation controls.`
      : "Select a tool, open a project, or start a new discovery query.");
  byId("message").title = byId("message").textContent;
  byId("open-link").hidden = !state.hasLink;
  byId("dismiss").hidden = !state.message;
  byId("prompt-panel").hidden = !state.promptOpen;
  byId("prompt-toggle").setAttribute("aria-expanded", String(state.promptOpen));
  byId("references").setAttribute(
    "aria-expanded",
    String(state.referenceTrayOpen),
  );
  byId("references").textContent = state.referenceTrayOpen
    ? "Close references"
    : "References";
  byId("references").title =
    state.mode === "discover"
      ? "Toggle the project reference tray below both tools"
      : "Open the active project's reference board";
  if (byId("prompt").value !== state.prompt)
    byId("prompt").value = state.prompt;
  byId("copy-prompt").disabled = !state.prompt;
  byId("copy-query").disabled = !state.query;
  byId("retry-search").disabled = !state.query;
  byId("context-note").textContent =
    state.projectKey && !state.prompt
      ? "Full prompt available in Ranga's Creative tools"
      : state.projectKey
        ? `${state.projectName}${state.editable ? "" : " · read-only"}`
        : "No project context";
  byId("pane-ratio").value = Math.round(state.ratio * 100);
  byId("pane-ratio").disabled = !state.split;
  byId("swap").disabled = !state.split;
});
bridge.ready();
