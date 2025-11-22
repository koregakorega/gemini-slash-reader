chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "slash-read",
      title: "Gemini Rhythm: Debug Mode",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "slash-read" && info.selectionText) {
    console.log("🚀 [1] 右クリックメニューが押されました");
    
    chrome.tabs.sendMessage(tab.id, { action: "START_LOADING" });
    
    try {
      console.log("🚀 [2] Gemini API呼び出し開始...");
      const result = await callGeminiAPI(info.selectionText);
      
      console.log("🚀 [5] 解析成功！Content Scriptへ送信します");
      chrome.tabs.sendMessage(tab.id, { action: "APPLY_SLASHES", data: result });
      
    } catch (error) {
      console.error("🔥 [ERROR] エラーが発生しました:", error);
      chrome.tabs.sendMessage(tab.id, { action: "ERROR", message: error.message });
    }
  }
});

async function callGeminiAPI(text) {
  const storage = await chrome.storage.local.get(['geminiApiKey', 'geminiModel']);
  if (!storage.geminiApiKey) throw new Error("APIキー未設定");

  const modelName = storage.geminiModel || "gemini-2.0-flash";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${storage.geminiApiKey}`;

  console.log(`🚀 [3] APIリクエスト送信中... モデル: ${modelName}, 文字数: ${text.length}`);

  const schema = {
    type: "OBJECT",
    properties: {
      segments: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            display_text: { type: "STRING" },
            translation: { type: "STRING" },
            respelling: { type: "STRING" },
            split_point: { type: "BOOLEAN" },
            category: { type: "STRING", enum: ["SUBJECT", "ACTION", "IMAGE"] }
          },
          required: ["display_text", "translation", "respelling", "split_point", "category"]
        }
      }
    }
  };

  const prompt = `
  あなたは英語のプロです。S/V/Oに分解してください。
  【ルール】
  1. 原文スペル維持。
  2. 最強アクセント母音の直前にアスタリスク(*)。機能語は除外。
  3. JSONのみを返してください。

  対象テキスト: "${text}"
  `;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("🔥 APIレスポンスエラー:", response.status, errorText);
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
  
  const json = await response.json();
  let rawText = json.candidates[0].content.parts[0].text;

  console.log("🚀 [4] APIからデータ受信完了。生データ:", rawText.substring(0, 100) + "..."); // 長いので最初の100文字だけ表示

  // ★念のためMarkdown記法 (```json ... ```) を削除するクリーニング処理
  rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.error("🔥 JSONパースエラー発生！受信したテキスト:\n", rawText);
    throw new Error("AIの返答が壊れています(JSON Parse Error)");
  }
}