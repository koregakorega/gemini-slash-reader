chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "slash-read",
    title: "Gemini Rhythm: IPAで音を可視化",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "slash-read" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { action: "START_LOADING" });
    try {
      const result = await callGeminiAPI(info.selectionText);
      chrome.tabs.sendMessage(tab.id, { action: "APPLY_SLASHES", data: result });
    } catch (error) {
      chrome.tabs.sendMessage(tab.id, { action: "ERROR", message: error.message });
    }
  }
});

async function callGeminiAPI(text) {
  const storage = await chrome.storage.local.get(['geminiApiKey']);
  if (!storage.geminiApiKey) throw new Error("APIキー未設定");

  // 最新モデルを使用
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${storage.geminiApiKey}`;

  const schema = {
    type: "OBJECT",
    properties: {
      segments: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            original_text: { type: "STRING" },
            translation: { type: "STRING" },
            respelling: { type: "STRING" },
            split_point: { type: "BOOLEAN" },
            category: { type: "STRING", enum: ["SUBJECT", "ACTION", "IMAGE"] }
          },
          required: ["original_text", "translation", "respelling", "split_point", "category"]
        }
      }
    }
  };

  const prompt = `
  あなたは英語音声学のプロです。
  文法単位ではなく「ネイティブが一息で話す音の塊（センス・グループ）」で区切り、その**「実際の音声（Connected Speech）」をIPAで表記**してください。

  【最重要：IPA生成ルール】
  辞書にある単語ごとの発音ではなく、**実際に会話で話される時の音（連結・脱落・弱形）**を反映したIPAを出力すること。
  アクセント記号（ˈ）は、そのチャンク内で最も強く読まれる箇所につけること。

  例:
  - "should have told" -> /ʃʊdəvˈtoʊld/ (haveが弱化し、toldに強勢)
  - "at the station" -> /ətðəˈsteɪʃən/ (at the が弱く連結)
  - "woke up early" -> /woʊkʌˈpɜːrli/ (upとearlyがリエゾン)

  【カテゴリ定義 (GLUEルール)】
  1. "SUBJECT" (緑): 主語。長い修飾語も含める。
  2. "ACTION" (赤): 動作の核心。助動詞・否定・to不定詞・句動詞は**絶対に分割しない**。
  3. "IMAGE" (青): 目的語、前置詞句。前置詞単独で切らない。

  【翻訳】
  - translation: 自然な日本語訳
  - original_text: 原文（後ろのスペース保持）

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
    const txt = await response.text();
    throw new Error(`Error ${response.status}: ${txt}`);
  }
  
  const json = await response.json();
  return JSON.parse(json.candidates[0].content.parts[0].text);
}