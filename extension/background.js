chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
async function configure(tabId, url) {
  if (!url) return;
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: new URL(url).origin === "https://web.whatsapp.com",
  });
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "complete")
    configure(tabId, tab.url).catch(console.error);
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) =>
    tabs.forEach((tab) => configure(tab.id, tab.url).catch(console.error)),
  );
});
