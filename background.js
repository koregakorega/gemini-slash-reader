chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "slash-read",
      title: "Gemini Rhythm: リスペリング厳格版",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "slash-read" && info.selectionText) {
    console.log("🚀 [1] 右クリックメニューが押されました");
    
    // 通常のメッセージ送信（デバッグ用ではないのでシンプルに）
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
            respelling: { type: "STRING" }, // ここを厳格に定義します
            split_point: { type: "BOOLEAN" },
            category: { type: "STRING", enum: ["SUBJECT", "ACTION", "IMAGE"] }
          },
          required: ["display_text", "translation", "respelling", "split_point", "category"]
        }
      }
    }
  };

  // ★修正ポイント: リスペリングのルールをガチガチに固める
  const prompt = `
  あなたは英語の発音と構造の専門家です。
  提供された英文を、S/V/Oの原則に基づいて自然なリズムで区切り、各チャンクの情報を分析してください。

  【重要：respelling (発音表記) のルール】
  AIはIPA(国際音声記号)を使いがちですが、今回は**絶対にIPAを使用してはいけません。**
  代わりに、英語ネイティブが使う「直感的な綴り直し (Phonetic Respelling)」を厳守してください。

  **▼ 禁止事項 (NG例)**
  - [NG] /ʃʊd əv toʊld/ (IPA記号を使う)
  - [NG] shood-uhv-tohld (すべて小文字)
  - [NG] ʃʊd-əv-TOHLD (IPAと混在させる)

  **▼ 遵守事項 (OK例)**
  1. **一般的なアルファベットのみ**を使用する。
  2. 最も強く発音される音節をすべて**大文字**にする。
  3. 音節の区切りは**ハイフン(-)**で繋ぐ。
  4. 曖昧母音(シュワ音)は "uh" や "ih" など、最も近い綴りで表現する。

  **▼ 変換サンプルの徹底**
  - "should have told" -> **"shood-uv-TOLD"**
  - "network administrator" -> **"NET-work ad-MIN-i-stray-ter"**
  - "deploy" -> **"dih-PLOY"**
  - "I need to catch up" -> **"eye NEED too KATCH up"**

  ---
  【その他のルール】
  [display_text]
  - 原文スペル維持。
  - 最強アクセント母音の直前にアスタリスク(*)。機能語は除外。

  [category] (SVO原則)
  - SUBJECT (緑): 動作主 (I, You, etc.)。文頭副詞は含めない。
  - ACTION (赤): 動詞、助動詞、不定詞(to+V)。
  - IMAGE (青): 目的語、補語、前置詞句。前置詞の前で区切る。

  [translation]
  - 自然な日本語訳。

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

  console.log("🚀 [4] APIからデータ受信完了。生データ(先頭100文字):", rawText.substring(0, 100) + "...");

  // Markdownクリーニング
  rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.error("🔥 JSONパースエラー発生！受信したテキスト:\n", rawText);
    throw new Error("AIの返答が壊れています(JSON Parse Error)");
  }
}