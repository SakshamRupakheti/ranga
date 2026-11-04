/* The bridge exists only in this local toolbar, never inside the website panes. */
const bridge = window.rangaWorkspace;
document.querySelectorAll("[data-site]").forEach((button) => {
  button.addEventListener("click", () => bridge.select(button.dataset.site));
});
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () =>
    bridge.command(button.dataset.command),
  );
});
const names = { ranga: "Ranga", chatgpt: "ChatGPT", pinterest: "Pinterest" };
bridge.subscribe((state) => {
  document.querySelectorAll("[data-site]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.site === state.selected),
    );
  });
  document
    .getElementById("split")
    .setAttribute("aria-pressed", String(state.split));
  document.getElementById("back").disabled = !state.back;
  document.getElementById("forward").disabled = !state.forward;
  document.getElementById("origin").textContent = state.origin;
  document.getElementById("pane").textContent = names[state.focused];
  document
    .getElementById("activity")
    .classList.toggle("loading", state.loading);
  document.getElementById("message").textContent =
    state.message ||
    (state.split
      ? `Ranga + ${names[state.selected]} · Click a pane to use its navigation controls.`
      : "Separate sessions · Copy, download, and import when you choose.");
  document.getElementById("open-link").hidden = !state.hasLink;
  document.getElementById("dismiss").hidden = !state.message;
  document.getElementById("note").hidden = Boolean(state.message);
});
bridge.ready();
