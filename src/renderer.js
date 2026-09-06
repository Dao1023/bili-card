// ========== 卡片渲染器:enhance 分发 + 从 HTML 文本构建 ==========

import { settingsSig } from './settings.js';
import { cardCss } from './css.js';
import { fillVideoCard } from './video-card.js';
import { fillUpCard } from './up-card.js';

export class BiliCardRenderer {
  // 把 <div class="bili-card" data-*> / <div class="bili-up-card" data-*> 渲染成完整卡片(Shadow DOM 隔离样式)
  static enhance(div) {
    const sig = settingsSig();
    if (div.shadowRoot && div.__biliSig === sig) return; // 已按当前设置渲染过
    div.classList.add('bili-card-on');
    div.__biliSig = sig;

    const root = div.shadowRoot || div.attachShadow({ mode: 'open' });
    root.innerHTML = ''; // 重渲染时清空旧内容

    const style = document.createElement('style');
    style.textContent = cardCss();
    root.appendChild(style);

    const card = document.createElement('div');
    card.className = 'card';
    if (div.classList.contains('bili-up-card')) fillUpCard(div, card);
    else fillVideoCard(div, card);
    root.appendChild(card);
  }

  // 从一段 HTML 文本构建卡片元素(供 widget 使用)
  static buildFromHTML(htmlText, forEditor) {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const src = doc.querySelector('div.bili-card, div.bili-up-card');
    if (!src) return null;
    const el = document.createElement('div');
    el.className = src.classList.contains('bili-up-card') ? 'bili-up-card' : 'bili-card';
    for (const attr of src.attributes) el.setAttribute(attr.name, attr.value);
    BiliCardRenderer.enhance(el);
    if (forEditor) {
      // LP 里:点击 = 打开链接(默认行为),编辑走 gallery 右上角 </> 按钮;
      // 挡住 mousedown 冒泡,免得触发 gallery 的"点空白进编辑"
      el.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    return el;
  }
}
