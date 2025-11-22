const style = document.createElement('style');
style.textContent = `
  .gemini-wrapper { line-height: 1.7; font-family: "Segoe UI", sans-serif; }
  .gemini-slash { color: #ddd; margin: 0 4px; font-weight: 300; font-size: 0.9em; }

  .gemini-chunk-base {
    display: inline-block;
    margin: 0 1px;
    padding: 0 1px;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  /* 配色（落ち着いた版） */
  .gemini-chunk-subject { color: #2e7d32; border-bottom-color: #2e7d32; }
  .gemini-chunk-subject:hover { background-color: #e8f5e9; }

  .gemini-chunk-action { color: #c62828; border-bottom-color: #c62828; font-weight: 700; }
  .gemini-chunk-action:hover { background-color: #ffebee; }

  .gemini-chunk-image { color: #1565c0; border-bottom-color: #1565c0; }
  .gemini-chunk-image:hover { background-color: #e3f2fd; }

  /* ツールチップ */
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
  
  /* IPA用のスタイル設定 */
  .gemini-ipa {
    display: block;
    color: #ffd700;   /* 黄色文字 */
    font-family: "Arial", "Lucida Sans Unicode", sans-serif; 
    font-size: 1.2em; 
    font-weight: normal;
    margin-top: 3px;
    letter-spacing: 0.5px;
  }
`;
document.head.appendChild(style);

let tooltipElement = document.createElement('div');
tooltipElement.className = 'gemini-tooltip';
document.body.appendChild(tooltipElement);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_LOADING") document.body.style.cursor = "wait";
  else if (request.action === "APPLY_SLASHES") {
    document.body.style.cursor = "default";
    applySlashes(request.data.segments);
  }
  else if (request.action === "ERROR") {
    document.body.style.cursor = "default";
    alert("エラー: " + request.message);
  }
});

function applySlashes(segments) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement('span');
  wrapper.className = 'gemini-wrapper';

  segments.forEach(seg => {
    const span = document.createElement("span");
    span.textContent = seg.original_text;
    span.classList.add("gemini-chunk-base");
    
    if (seg.category === "SUBJECT") {
      span.classList.add("gemini-chunk-subject");
    } else if (seg.category === "ACTION") {
      span.classList.add("gemini-chunk-action");
    } else {
      span.classList.add("gemini-chunk-image");
    }

    span.addEventListener('mouseenter', (e) => {
      tooltipElement.innerHTML = `
        <div>${seg.translation}</div>
        <div class="gemini-ipa">${seg.respelling}</div>
      `;
      
      if(seg.category === "SUBJECT") tooltipElement.style.backgroundColor = "rgba(46, 125, 50, 0.95)";
      else if(seg.category === "ACTION") tooltipElement.style.backgroundColor = "rgba(198, 40, 40, 0.95)";
      else tooltipElement.style.backgroundColor = "rgba(21, 101, 192, 0.95)";

      const rect = span.getBoundingClientRect();
      tooltipElement.style.top = (window.scrollY + rect.top - 60) + "px";
      tooltipElement.style.left = (window.scrollX + rect.left) + "px";
      tooltipElement.style.display = "block";
    });
    
    span.addEventListener('mouseleave', () => {
      tooltipElement.style.display = "none";
    });

    wrapper.appendChild(span);

    if (seg.split_point) {
      const slash = document.createElement("span");
      slash.className = "gemini-slash";
      slash.textContent = "/";
      wrapper.appendChild(slash);
    }
  });

  fragment.appendChild(wrapper);
  range.insertNode(fragment);
  selection.removeAllRanges();
}