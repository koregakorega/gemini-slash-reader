// content.js

// 二重定義防止（すでに定義済みならスキップ）
var geminiStyleLoaded = geminiStyleLoaded || false;

if (!geminiStyleLoaded) {
  geminiStyleLoaded = true;
  
  var style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap');

    .gemini-wrapper { line-height: 1.8; font-family: "Segoe UI", sans-serif; }
    .gemini-slash { color: #ddd; margin: 0 4px; font-weight: 300; font-size: 0.9em; }

    .gemini-chunk-base {
      display: inline-block;
      margin: 0 1px;
      padding: 0 1px;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
      font-family: "Atkinson Hyperlegible", "Segoe UI", sans-serif;
    }

    .gemini-chunk-subject { color: #2e7d32; border-bottom-color: #2e7d32; }
    .gemini-chunk-subject:hover { background-color: #e8f5e9; }

    .gemini-chunk-action { color: #c62828; border-bottom-color: #c62828; font-weight: 700; }
    .gemini-chunk-action:hover { background-color: #ffebee; }

    .gemini-chunk-image { color: #1565c0; border-bottom-color: #1565c0; }
    .gemini-chunk-image:hover { background-color: #e3f2fd; }

    .gemini-stress-char {
      position: relative;
      display: inline-block;
    }
    .gemini-stress-char::after {
      content: '';
      position: absolute;
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border: 1.5px solid currentColor;
      border-radius: 50%;
    }

    .gemini-tooltip {
      position: absolute;
      display: none;
      background: rgba(30, 30, 30, 0.95);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 99999;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      text-align: center;
      line-height: 1.4;
    }
    
    .gemini-respell {
      display: block;
      color: #ffd700;
      font-family: "Atkinson Hyperlegible", "Arial", sans-serif; 
      font-size: 1.2em; 
      font-weight: 400;
      margin-top: 3px;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);

  var tooltip = document.createElement('div');
  tooltip.className = 'gemini-tooltip';
  document.body.appendChild(tooltip);
}

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_LOADING") {
    document.body.style.cursor = "wait";
  } else if (request.action === "APPLY_SLASHES") {
    document.body.style.cursor = "default";
    applySlashes(request.data.segments);
  } else if (request.action === "ERROR") {
    document.body.style.cursor = "default";
    alert("エラー: " + request.message);
  }
});

function applySlashes(segments) {
  var tooltipElement = document.querySelector('.gemini-tooltip');
  var selection = window.getSelection();
  if (!selection.rangeCount) return;
  var range = selection.getRangeAt(0);
  
  range.deleteContents();
  var fragment = document.createDocumentFragment();
  var wrapper = document.createElement('span');
  wrapper.className = 'gemini-wrapper';

  segments.forEach(seg => {
    var span = document.createElement("span");
    var rawText = seg.display_text || seg.original_text;
    rawText = rawText.replace(/[\|•·]/g, ""); 
    
    if (rawText.includes('*')) {
      var parts = rawText.split('*');
      if (parts[0]) span.appendChild(document.createTextNode(parts[0]));
      if (parts[1]) {
        var stressedChar = parts[1].charAt(0);
        var rest = parts[1].slice(1);
        
        var stressSpan = document.createElement("span");
        stressSpan.className = "gemini-stress-char";
        stressSpan.textContent = stressedChar;
        span.appendChild(stressSpan);
        
        if (rest) span.appendChild(document.createTextNode(rest));
      }
      for (var i = 2; i < parts.length; i++) span.appendChild(document.createTextNode(parts[i]));
    } else {
      span.textContent = rawText;
    }
    
    span.classList.add("gemini-chunk-base");
    
    if (seg.category === "SUBJECT") span.classList.add("gemini-chunk-subject");
    else if (seg.category === "ACTION") span.classList.add("gemini-chunk-action");
    else span.classList.add("gemini-chunk-image");

    span.addEventListener('mouseenter', (e) => {
      tooltipElement.innerHTML = `
        <div>${seg.translation}</div>
        <div class="gemini-respell">${seg.respelling}</div>
      `;
      
      if(seg.category === "SUBJECT") tooltipElement.style.backgroundColor = "rgba(46, 125, 50, 0.95)";
      else if(seg.category === "ACTION") tooltipElement.style.backgroundColor = "rgba(198, 40, 40, 0.95)";
      else tooltipElement.style.backgroundColor = "rgba(21, 101, 192, 0.95)";

      var rect = span.getBoundingClientRect();
      tooltipElement.style.top = (window.scrollY + rect.top - 60) + "px";
      tooltipElement.style.left = (window.scrollX + rect.left) + "px";
      tooltipElement.style.display = "block";
    });
    
    span.addEventListener('mouseleave', () => {
      tooltipElement.style.display = "none";
    });

    wrapper.appendChild(span);

    if (seg.split_point) {
      var slash = document.createElement("span");
      slash.className = "gemini-slash";
      slash.textContent = "/";
      wrapper.appendChild(slash);
    }
  });

  fragment.appendChild(wrapper);
  range.insertNode(fragment);
  selection.removeAllRanges();
}