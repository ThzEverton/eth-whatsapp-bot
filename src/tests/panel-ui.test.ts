import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { defaults } from "../config/settings.js";
const html = await readFile(new URL("../../monitor/index.html", import.meta.url), "utf8");
const monitorScript = await readFile(new URL("../../monitor/monitor-ui.js", import.meta.url), "utf8");
const managementScript = await readFile(new URL("../../monitor/management.js", import.meta.url), "utf8");
let dom: JSDOM | undefined;
afterEach(() => { dom?.window.close(); vi.restoreAllMocks(); });
const panelState = () => ({
  ready: true, connection: { status: "connected", qr: "" },
  variants: [{ id: "classico", name: "Clássico" }],
  messages: [], chats: [{ id: "123@g.us", name: "Grupo teste", group: true, allowed: true, session: null, settings: defaults() }]
});
const monitorState = () => ({
  running: true, pid: 123, restarts: 0, connection: "connected",
  connectedAt: Date.now() - 60000, now: Date.now(), groups: [{id:"123@g.us",name:"Grupo teste"}],
  events: [], errors: [], supervisorError: ""
});
async function setup(compact = false) {
  dom = new JSDOM(html.replace("<body>", compact ? '<body class="compact">' : "<body>"), {
    url: "http://localhost:3100/", runScripts: "outside-only"
  });
  const window = dom.window;
  Object.defineProperty(window, "lucide", { value: { createIcons: () => {} } });
  Object.defineProperty(window, "Option", { value: function(text: string, value: string) { const option = window.document.createElement("option"); option.textContent = text; option.value = value; return option; } });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const fetch = vi.fn(async (url: unknown) => ({
    ok: true, json: async () => String(url).includes("/api/status") ? monitorState() :
      String(url).includes("/api/panel") ? panelState() : {ok:true}
  }));
  window.fetch = fetch as unknown as typeof window.fetch;
  window.eval(monitorScript);
  window.eval(managementScript);
  await vi.waitFor(() => expect(window.document.querySelectorAll("#chat-list button")).toHaveLength(1));
  return {window, fetch};
}
it("organiza a desconexao no menu da conexao e nao no conteudo principal", async () => {
  const {window} = await setup();
  const d=window.document;
  expect(d.querySelector("#connection-menu #account-disconnect")).not.toBeNull();
  expect(d.querySelector("#connection-menu-toggle")).not.toBeNull();
  expect(d.querySelector("#connection-menu")?.hasAttribute("hidden")).toBe(true);
});
it("mantem os controles do bot dentro do dialogo", async () => {
  const {window} = await setup();
  const d=window.document;
  for (const id of ["bot-start","bot-stop","bot-restart"]) {
    expect(d.querySelector("#bot-dialog #" + id)).not.toBeNull();
  }
  expect(d.querySelector('[data-open="bot-dialog"]')).not.toBeNull();
});
it("abre o gerenciamento do grupo por modal", async () => {
  const {window} = await setup();
  const d=window.document;
  const button=d.querySelector('[data-open="group-dialog"]') as HTMLElement;
  button.click();
  expect((d.querySelector("#group-dialog") as HTMLDialogElement).open).toBe(true);
  expect(d.querySelector("#group-picker")).not.toBeNull();
});
it("exibe as mesmas configuracoes e indicadores na visualizacao compacta", async () => {
  const {window} = await setup(true);
  const d=window.document;
  expect(d.querySelector(".compact-only.summary-control")).not.toBeNull();
  expect(d.querySelector("#connection")).not.toBeNull();
  expect(d.querySelector("#process")).not.toBeNull();
  expect(d.querySelector("#all-activity")).not.toBeNull();
});
it("preserva documentos e instalacao da extensao", async () => {
  const {window} = await setup();
  const d=window.document;
  expect(d.querySelectorAll("[data-legal]")).toHaveLength(4);
  expect(d.querySelector('#extension-install a[href="/extension.zip"]')).not.toBeNull();
  expect(d.querySelector("#install-extension")).not.toBeNull();
});

it("permite voltar do gerenciamento para configuracoes gerais", async () => {
  const {window} = await setup();
  const d = window.document;
  (d.querySelector('[data-open="general-dialog"]') as HTMLElement).click();
  expect((d.querySelector("#general-dialog") as HTMLDialogElement).open).toBe(true);
  (d.querySelector('#general-dialog [data-open="group-dialog"]') as HTMLElement).click();
  expect((d.querySelector("#group-dialog") as HTMLDialogElement).open).toBe(true);
  (d.querySelector("#group-dialog .modal-back") as HTMLElement).click();
  expect((d.querySelector("#general-dialog") as HTMLDialogElement).open).toBe(true);
  expect((d.querySelector("#group-dialog") as HTMLDialogElement).open).toBe(false);
});

it("mostra o convite de reconexao apenas quando o WhatsApp esta desconectado", async () => {
  const {window} = await setup(true);
  const d = window.document;
  const prompt = d.getElementById("reconnect-prompt")!;
  expect(prompt.hidden).toBe(true);
  d.dispatchEvent(new window.CustomEvent("eth:status", {detail: {running: true, connection: "disconnected"}}));
  expect(prompt.hidden).toBe(false);
  (d.getElementById("reconnect-now") as HTMLElement).click();
  expect((d.getElementById("connection-dialog") as HTMLDialogElement).open).toBe(true);
  d.dispatchEvent(new window.CustomEvent("eth:status", {detail: {running: true, connection: "connected"}}));
  expect(prompt.hidden).toBe(true);
});
