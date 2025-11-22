document.getElementById('saveBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value;
  const model = document.getElementById('modelSelect').value;

  // キーが空でも、モデルだけ変えたい場合があるので柔軟に保存
  const dataToSave = { geminiModel: model };
  if (key) {
    dataToSave.geminiApiKey = key;
  }

  chrome.storage.local.set(dataToSave, () => {
    const status = document.getElementById('status');
    status.textContent = '設定を保存しました！';
    setTimeout(() => status.textContent = '', 2000);
  });
});

// 画面を開いた時に、保存されている設定を読み込む
chrome.storage.local.get(['geminiApiKey', 'geminiModel'], (result) => {
  if (result.geminiApiKey) {
    document.getElementById('apiKey').placeholder = "設定済み (変更しないなら空欄でOK)";
  }
  
  // 保存されたモデルがあればそれを選択、なければデフォルト(2.0 Flash)
  if (result.geminiModel) {
    document.getElementById('modelSelect').value = result.geminiModel;
  } else {
    document.getElementById('modelSelect').value = "gemini-2.0-flash";
  }
});