const origin = "https://eth-whatsapp-bot.onrender.com";
const storageKey = "ethDemoExtensionKey";
const modeStorageKey = "ethPanelMode";
const setup = document.getElementById("setup");
const localOffline = document.getElementById("local-offline");
const active = document.getElementById("active");
const iframe = document.getElementById("manager");
const pairForm = document.getElementById("pair-form");
const feedback = document.getElementById("pair-feedback");
const activeFeedback = document.getElementById("active-feedback");
const pairButton = document.getElementById("pair-button");
const unlink = document.getElementById("unlink");
let key = null;
let mode = "online";

function selectMode(next) {
  mode = next;
  document.getElementById("mode-online").setAttribute("aria-pressed", String(next === "online"));
  document.getElementById("mode-local").setAttribute("aria-pressed", String(next === "local"));
}
async function validate(candidate) {
  const response = await fetch(origin + "/api/demo/me", {
    headers: { "x-demo-key": candidate },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Falha ao consultar sua instalação. Tente novamente.");
  const state = await response.json();
  return Boolean(state.active);
}
function hidePanels() {
  setup.hidden = true;
  localOffline.hidden = true;
  active.hidden = true;
  iframe.hidden = true;
  iframe.removeAttribute("src");
}
function showSetup(message = "") {
  hidePanels();
  selectMode("online");
  setup.hidden = false;
  feedback.textContent = message;
}
function showPanel(candidate) {
  hidePanels();
  selectMode("online");
  key = candidate;
  active.hidden = false;
  unlink.hidden = false;
  document.getElementById("active-title").textContent = "ETH / WhatsApp · Online";
  activeFeedback.textContent = "";
  iframe.hidden = false;
  // A tela embutida recebe somente a chave da sua instalação, nunca cria outra vaga.
  iframe.src = origin + "/#eth-extension";
}
async function showLocal() {
  hidePanels();
  selectMode("local");
  localOffline.hidden = false;
  document.getElementById("local-feedback").textContent = "Procurando o servidor local...";
  try {
    const response = await fetch("http://localhost:3100/api/status", {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("Serviço local indisponível.");
    hidePanels();
    active.hidden = false;
    unlink.hidden = true;
    document.getElementById("active-title").textContent = "ETH / WhatsApp · Local";
    activeFeedback.textContent = "";
    iframe.hidden = false;
    iframe.src = "http://localhost:3100/sidebar";
  } catch {
    document.getElementById("local-feedback").textContent = "Não encontrei o monitor no computador. Inicie o sistema e tente novamente.";
  }
}
window.addEventListener("message", (event) => {
  if (mode !== "online" || event.source !== iframe.contentWindow || event.origin !== origin) return;
  if (event.data?.type === "eth-demo-frame-ready" && key) {
    iframe.contentWindow.postMessage({ type: "eth-demo-extension-key", key }, origin);
  }
});
pairForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("pair-code").value.trim();
  pairButton.disabled = true;
  feedback.textContent = "Vinculando...";
  try {
    const response = await fetch(origin + "/api/demo/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível vincular.");
    if (!/^[a-f0-9]{64}$/.test(data.key || "")) throw new Error("Resposta inválida do servidor.");
    await chrome.storage.local.set({ [storageKey]: data.key });
    key = data.key;
    document.getElementById("pair-code").value = "";
    showPanel(data.key);
  } catch (error) {
    feedback.textContent = error.message || "Não foi possível vincular.";
  } finally {
    pairButton.disabled = false;
  }
});
unlink.addEventListener("click", async () => {
  if (!confirm("Desvincular esta extensão da instalação?")) return;
  const old = key;
  try {
    const response = await fetch(origin + "/api/demo/unlink", {
      method: "POST",
      headers: { "x-demo-key": old },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok && response.status !== 401) throw new Error("Não foi possível remover o vínculo no servidor.");
    await chrome.storage.local.remove(storageKey);
    key = null;
    showSetup("Extensão desvinculada. Sua vaga no site continua ativa.");
  } catch (error) {
    activeFeedback.textContent = error.message || "Erro ao desvincular.";
  }
});
document.getElementById("mode-online").addEventListener("click", async () => {
  await chrome.storage.local.set({ [modeStorageKey]: "online" });
  if (!key) return showSetup();
  try {
    if (await validate(key)) showPanel(key);
    else {
      await chrome.storage.local.remove(storageKey);
      key = null;
      showSetup("Sua instalação expirou. Gere outro código.");
    }
  } catch {
    showSetup("Servidor indisponível. Tente novamente em instantes.");
  }
});
document.getElementById("mode-local").addEventListener("click", async () => {
  await chrome.storage.local.set({ [modeStorageKey]: "local" });
  await showLocal();
});
document.getElementById("local-retry").addEventListener("click", showLocal);
(async () => {
  try {
    const settings = await chrome.storage.local.get([storageKey, modeStorageKey]);
    key = /^[a-f0-9]{64}$/.test(settings[storageKey] || "") ? settings[storageKey] : null;
    if (settings[modeStorageKey] === "local") {
      await showLocal();
      return;
    }
    if (!key) return showSetup();
    if (await validate(key)) showPanel(key);
    else {
      await chrome.storage.local.remove(storageKey);
      key = null;
      showSetup("Sua instalação expirou. Gere outro código no painel online.");
    }
  } catch {
    showSetup("Não foi possível acessar o servidor. Aguarde o Render iniciar e tente novamente.");
  }
})();
