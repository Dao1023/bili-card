// ========== Live Preview:gallery widget(接管连续卡片行) ==========

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { Notice } from 'obsidian';
import { settings, cardHeight, upCardHeight } from './settings.js';
import { BiliCardRenderer } from './renderer.js';
import { UrlModal } from './url-modal.js';

// 卡片源码行:一张卡一行,视频卡/UP主卡都认
export const CARD_LINE_RE = /^\s*<div class="bili-(?:card|up-card)"\s/;

// 插件入口传入的 app 引用(开弹窗用)
let appRef = null;
export function setGalleryApp(app) { appRef = app; }

// 在【当前文档】里重新定位画廊范围。
// widget 缓存的 from/to 会在弹窗异步期间因文档变动而漂移,
// 往漂移位置写会吞掉正文——所有写操作必须先用这个重定位。
function findGalleryRange(state, text) {
  let start = -1, end = -1;
  let found = null;
  const flush = () => {
    if (start < 0) return;
    if (state.doc.sliceString(start, end) === text) found = { from: start, to: end };
    start = -1;
  };
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (CARD_LINE_RE.test(line.text)) {
      if (start < 0) start = line.from;
      end = line.to;
    } else {
      flush();
    }
  }
  flush();
  return found;
}

// 正在编辑中的 gallery:text → 画廊 DOM 高度(px)。
// 记高度是为了让编辑态 textarea 撑到同高:画廊和编辑框高度差太大时,
// 切换瞬间下方内容会上移/回跳,视口跟着跳。
const editingGalleries = new Map();

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

  enterEditMode(view, el) {
    editingGalleries.set(this.text, el ? el.offsetHeight : 0);
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
      this.enterEditMode(view, container);
    });
    container.appendChild(editBtn);

    // 点 gallery 空白处进入编辑(卡片自身 mousedown 已 stopPropagation,点卡片 = 开链接)
    container.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.enterEditMode(view, container);
    });

    for (const line of this.text.split('\n')) {
      if (!CARD_LINE_RE.test(line)) continue;
      const card = BiliCardRenderer.buildFromHTML(line, true);
      if (card) container.appendChild(card);
    }
    return container;
  }
}

// 按日期排序卡片行;无日期/非卡片行保持原顺序排最后
function sortCardLines(text, asc) {
  const dated = [];
  const undated = [];
  for (const l of text.split('\n')) {
    const m = CARD_LINE_RE.test(l) && l.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    (m ? dated : undated).push({ line: l, date: m ? m[1] : '' });
  }
  dated.sort((a, b) => asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  return dated.concat(undated).map((x) => x.line).join('\n');
}

// 判断当前顺序(看前两张有日期的卡),用于排序按钮往复切换
function isDescSorted(text) {
  const dates = [];
  for (const l of text.split('\n')) {
    const m = CARD_LINE_RE.test(l) && l.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    if (m) dates.push(m[1]);
    if (dates.length >= 2) break;
  }
  return dates.length >= 2 && dates[0] >= dates[1];
}

// 编辑态 widget:textarea 持有源码,完成时整体写回文档
class BiliGalleryEditWidget extends WidgetType {
  constructor(text, from, to, galleryHeight) {
    super();
    this.text = text;
    this.from = from;
    this.to = to;
    this.galleryHeight = galleryHeight || 0;
    this.isEdit = true;
  }
  eq(other) { return other.isEdit && other.text === this.text; }
  // 高度取 textarea 估算和画廊实测的较大者,切换时视口不跳
  get estimatedHeight() {
    return Math.max(
      Math.round(this.text.split('\n').length * settings.editorSize * 1.6 + 90),
      this.galleryHeight
    );
  }

  toDOM(view) {
    const wrap = document.createElement('div');
    wrap.className = 'bili-gallery-editor';

    // 顶部按钮栏:添加/排序居左,完成/取消居右
    const bar = document.createElement('div');
    bar.className = 'bili-gallery-editor-bar';

    // 通过 URL 添加:生成的卡片行先进 textarea,随"完成"一起写回(单一写入路径)
    const add = document.createElement('button');
    add.textContent = '通过 URL 添加';
    add.title = '输入 B 站链接,拉取数据生成卡片行,追加到下方源码末尾';
    add.addEventListener('click', () => {
      if (!appRef) return;
      new UrlModal(appRef, (line) => {
        ta.value = ta.value.replace(/\s+$/, '') + '\n' + line;
        ta.scrollTop = ta.scrollHeight;
      }).open();
    });

    // 按日期排序:只重排 textarea 内容,点完成才写回;已是逆序则切换为顺序
    const sort = document.createElement('button');
    sort.textContent = '按日期排序';
    sort.title = '往复切换:新→旧 / 旧→新;无日期的排最后';
    sort.addEventListener('click', () => {
      ta.value = sortCardLines(ta.value, isDescSorted(ta.value));
    });

    const save = document.createElement('button');
    save.className = 'bili-gallery-save';
    save.textContent = '完成';
    save.addEventListener('click', () => {
      editingGalleries.delete(this.text);
      // 写回前在当前文档里重新定位画廊,不用 widget 缓存的旧位置(会漂移吞正文)
      const range = findGalleryRange(view.state, this.text);
      if (!range) {
        new Notice('画廊位置已变化,写回失败,请重新编辑');
        pokeView(view);
        return;
      }
      // 整体写回(一次性替换,避免中间态)
      view.dispatch({ changes: { from: range.from, to: range.to, insert: ta.value } });
    });

    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => {
      editingGalleries.delete(this.text);
      pokeView(view);
    });

    bar.appendChild(add);
    bar.appendChild(sort);
    bar.appendChild(save);
    bar.appendChild(cancel);
    wrap.appendChild(bar);

    const ta = document.createElement('textarea');
    ta.value = this.text;
    ta.spellcheck = false;
    ta.rows = Math.min(this.text.split('\n').length + 1, 30);
    // 撑到画廊原高度,进出编辑态页面不跳(不封顶:画廊几千像素时,
    // 高度差越大跳得越狠;textarea 内部自有滚动条,高一点无碍)
    if (this.galleryHeight > 0) {
      ta.style.minHeight = `${this.galleryHeight}px`;
    }
    wrap.appendChild(ta);

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
      ? new BiliGalleryEditWidget(text, start, end, editingGalleries.get(text))
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
