// ========== Live Preview:gallery widget(接管连续卡片行) ==========

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { settings, cardHeight, upCardHeight } from './settings.js';
import { BiliCardRenderer } from './renderer.js';

// 卡片源码行:一张卡一行,视频卡/UP主卡都认
export const CARD_LINE_RE = /^\s*<div class="bili-(?:card|up-card)"\s/;

// 正在编辑中的 gallery(键 = 源码文本;编辑只动 textarea,不动文档,所以键稳定)
const editingGalleries = new Set();

// 强制装饰重建的信号
const rebuildEffect = StateEffect.define();

// 强制装饰重建 + 重绘。
// 此 Obsidian 版本的 CM6 里,block widget 的 DOM 只在 DocView 构造时挂载,
// 事务里的装饰变化不会补挂(纯 effect/选区/净零变更事务都试过,无效)。
// 所以先 dispatch effect 让 StateField 重算装饰,再 setState 重建 DocView 强制重绘。
export function pokeView(view) {
  view.dispatch({ effects: rebuildEffect.of(null) });
  view.setState(view.state);
}

class BiliGalleryWidget extends WidgetType {
  constructor(text, cardCount, from, to) {
    super();
    this.text = text;
    this.cardCount = cardCount;
    this.from = from; // 源码范围,编辑时用
    this.to = to;
  }
  eq(other) { return other.text === this.text && other.isEdit === undefined; }
  // 关键:给 CM6 准确的高度估算,离屏时滚动条不漂移
  // 按 3 列估算(常见宽度),渲染后会用实测值修正;混合 gallery 取最高卡型
  get estimatedHeight() {
    let maxH = cardHeight();
    for (const line of this.text.split('\n')) {
      if (line.includes('bili-up-card')) maxH = Math.max(maxH, upCardHeight(/data-bvid="/.test(line)));
    }
    return Math.ceil(this.cardCount / 3) * (maxH + settings.gap * 2);
  }

  enterEditMode(view) {
    editingGalleries.add(this.text);
    pokeView(view);
  }

  toDOM(view) {
    const container = document.createElement('div');
    container.className = 'bili-gallery-widget';

    // 右上角编辑按钮(和 Obsidian 自带 embed 的习惯一致)
    const editBtn = document.createElement('button');
    editBtn.className = 'bili-gallery-edit';
    editBtn.textContent = '</>';
    editBtn.title = '编辑源码';
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.enterEditMode(view);
    });
    container.appendChild(editBtn);

    // 点 gallery 空白处进入编辑(卡片自身 mousedown 已 stopPropagation,点卡片 = 开链接)
    container.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.enterEditMode(view);
    });

    for (const line of this.text.split('\n')) {
      if (!CARD_LINE_RE.test(line)) continue;
      const card = BiliCardRenderer.buildFromHTML(line, true);
      if (card) container.appendChild(card);
    }
    return container;
  }
}

// 编辑态 widget:textarea 持有源码,完成时整体写回文档
class BiliGalleryEditWidget extends WidgetType {
  constructor(text, from, to) {
    super();
    this.text = text;
    this.from = from;
    this.to = to;
    this.isEdit = true;
  }
  eq(other) { return other.isEdit && other.text === this.text; }
  get estimatedHeight() { return Math.round(this.text.split('\n').length * settings.editorSize * 1.6 + 90); }

  toDOM(view) {
    const wrap = document.createElement('div');
    wrap.className = 'bili-gallery-editor';

    const ta = document.createElement('textarea');
    ta.value = this.text;
    ta.spellcheck = false;
    ta.rows = Math.min(this.text.split('\n').length + 1, 30);
    wrap.appendChild(ta);

    const bar = document.createElement('div');
    bar.className = 'bili-gallery-editor-bar';

    const save = document.createElement('button');
    save.textContent = '完成';
    save.addEventListener('click', () => {
      editingGalleries.delete(this.text);
      // 整体写回(一次性替换,避免中间态)
      view.dispatch({ changes: { from: this.from, to: this.to, insert: ta.value } });
    });

    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => {
      editingGalleries.delete(this.text);
      pokeView(view);
    });

    bar.appendChild(save);
    bar.appendChild(cancel);
    wrap.appendChild(bar);
    return wrap;
  }
}

function buildGalleryDeco(state) {
  const ranges = [];
  let start = -1, end = -1, count = 0;
  const flush = () => {
    if (start < 0) return;
    const text = state.doc.sliceString(start, end);
    // 编辑中的 gallery 换成 textarea 编辑器(选中态判断不可行:Obsidian 自带 embed 会盖住源码行)
    const widget = editingGalleries.has(text)
      ? new BiliGalleryEditWidget(text, start, end)
      : new BiliGalleryWidget(text, count, start, end);
    ranges.push(Decoration.replace({ widget, block: true }).range(start, end));
    start = -1; count = 0;
  };
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (CARD_LINE_RE.test(line.text)) {
      if (start < 0) start = line.from;
      end = line.to;
      count++;
    } else {
      flush();
    }
  }
  flush();
  return Decoration.set(ranges, true);
}

export const galleryField = StateField.define({
  create: (state) => buildGalleryDeco(state),
  // doc 变了或收到重建信号都重建
  update: (deco, tr) => (tr.docChanged || tr.effects.some((e) => e.is(rebuildEffect)))
    ? buildGalleryDeco(tr.state)
    : deco,
  provide: (f) => EditorView.decorations.from(f),
});
