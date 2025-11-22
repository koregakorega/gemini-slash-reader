document.getElementById('saveBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value;
  if (key) {
    chrome.storage.local.set({ geminiApiKey: key }, () => {
      document.getElementById('status').textContent = '保存しました！';
      setTimeout(() => document.getElementById('status').textContent = '', 2000);
    });
  }
});
chrome.storage.local.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    document.getElementById('apiKey').placeholder = "設定済み";
  }
});