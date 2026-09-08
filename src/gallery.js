// ========== Live Preview:gallery widget(接管连续卡片行) ==========

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { Notice } from 'obsidian';
import { settings, cardHeight, upCardHeight } from './settings.js';
import { BiliCardRenderer } from './renderer.js';
import { UrlModal } from './url-modal.js';
import { SourceEditor } from './source-editor.js';

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
    const range = extendedRange(state, start, end);
    if (state.doc.sliceString(range.from, range.to) === text) found = range;
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

// 把画廊范围扩成【严格大于】卡片文本行的范围。
// 单卡时 Obsidian 内置的 html-embed 装饰和我们的装饰范围完全重合(都是卡片行),
// 重合冲突下我们的 block widget 不挂载(单卡空白 bug);多卡连排时我们是一整块、
// embed 是一行一节,大块包小节所以能赢。这里单卡也扩成"大包小":
// 优先吞前导空白行,否则吞后随空白行,兜底再吞行尾换行。
// 扩展方式必须处处一致(buildGalleryDeco / findGalleryRange 都用它),
// 因为 widget.text 就是扩展后范围的切片,编辑写回要靠它重定位。
function extendedRange(state, start, end) {
  let from = start, to = end;
  if (from > 0) {
    const prev = state.doc.lineAt(from - 1);
    if (prev.to + 1 === from && prev.text.trim() === '') from = prev.from;
  }
  if (from === start && to < state.doc.length && state.doc.sliceString(to, to + 1) === '\n') {
    // 没有前导空白行可吞:吞后随空白行
    const next = state.doc.lineAt(to + 1);
    if (next.from === to + 1 && next.text.trim() === '') {
      to = next.to < state.doc.length ? next.to + 1 : next.to;
    } else {
      to = to + 1;
    }
  } else if (to < state.doc.length && state.doc.sliceString(to, to + 1) === '\n') {
    to = to + 1;
  }
  // 没吞到前导空白行(卡片紧跟文字或顶在文档开头下方的文字后):embed 的范围
  // 可能带行尾换行,只吞自己的换行仍和它打平;这里再向前咬一个字符(前一行的
  // 行尾换行),依然严格大于。卡片是文档首行时无处可咬,那种情况接受打平。
  if (from === start && from > 0 && state.doc.sliceString(from - 1, from) === '\n') {
    from = from - 1;
  }
  return { from, to };
}

// 正在编辑中的 gallery:text → 画廊 DOM 高度(px)。
// 记高度是为了让编辑态块占住同样的高度:画廊(常有几千像素)和编辑框
// (几百像素)高度差大,切换瞬间 CM6 高度图重算会带着视口跳;
// 块高度不变 = 下方内容不动 = 不跳。
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
    // 不设 min-height:高度跟随真实网格内容。estimatedHeight 只作 CM6
    // 的滚动条估算,写成 CSS min-height 会钉死下限——宽屏下列数变多、
    // 内容比 3 列估算矮时,底部永远挂着消不掉的空白。

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

// 卡片行 → 纯 markdown 链接(转回普通排版用);非卡片行原样返回
function cardLineToLink(line) {
  if (!CARD_LINE_RE.test(line)) return line;
  const doc = new DOMParser().parseFromString(line, 'text/html');
  const el = doc.querySelector('div.bili-card, div.bili-up-card');
  if (!el) return line;
  const d = el.dataset;
  const esc = (s) => (s || '').replace(/[[\]]/g, '');
  if (el.classList.contains('bili-up-card')) {
    return `[${esc(d.name)}](https://space.bilibili.com/${d.mid})`;
  }
  return `[${esc(d.title)}](https://www.bilibili.com/video/${d.bvid})`;
}

// 编辑态 widget:内嵌 CodeMirror 持有源码,完成时整体写回文档
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
  // 块高度 = max(textarea 估算, 画廊实测):和画廊一致,切换时视口不跳
  get estimatedHeight() {
    return Math.max(
      Math.round(this.text.split('\n').length * settings.editorSize * 1.6 + 90),
      this.galleryHeight
    );
  }

  toDOM(view) {
    const wrap = document.createElement('div');
    wrap.className = 'bili-gallery-editor';
    // 外层占住画廊原高度;内嵌 CM 编辑器保持紧凑,下面是留白
    if (this.galleryHeight > 0) {
      wrap.style.minHeight = `${this.galleryHeight}px`;
    }

    // 顶部按钮栏:添加/排序居左,完成/取消居右
    const bar = document.createElement('div');
    bar.className = 'bili-gallery-editor-bar';

    // 通过 URL 添加:生成的卡片行先进编辑器,随"完成"一起写回(单一写入路径)
    const add = document.createElement('button');
    add.textContent = '通过 URL 添加';
    add.title = '输入 B 站链接,拉取数据生成卡片行,追加到下方源码末尾';
    add.addEventListener('click', () => {
      if (!appRef) return;
      new UrlModal(appRef, (line) => {
        se.value = se.value.replace(/\s+$/, '') + '\n' + line;
        se.scrollToEnd();
      }).open();
    });

    // 按日期排序:只重排编辑器内容,点完成才写回;已是逆序则切换为顺序
    const sort = document.createElement('button');
    sort.textContent = '按日期排序';
    sort.title = '往复切换:新→旧 / 旧→新;无日期的排最后';
    sort.addEventListener('click', () => {
      se.value = sortCardLines(se.value, isDescSorted(se.value));
    });

    // 转回链接:卡片 div 还原成 [标题](链接) 纯文本行,写回后画廊消失
    const unlink = document.createElement('button');
    unlink.textContent = '转回链接';
    unlink.title = '把所有卡片还原成普通 markdown 链接(放弃卡片样式)';
    unlink.addEventListener('click', () => {
      se.value = se.value.split('\n').map(cardLineToLink).join('\n');
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
      view.dispatch({ changes: { from: range.from, to: range.to, insert: se.value } });
    });

    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => {
      editingGalleries.delete(this.text);
      pokeView(view);
    });

    bar.appendChild(add);
    bar.appendChild(sort);
    bar.appendChild(unlink);
    bar.appendChild(save);
    bar.appendChild(cancel);
    wrap.appendChild(bar);

    // 内嵌迷你 CodeMirror(HTML 高亮);widget 销毁时 destroy 清掉
    const se = new SourceEditor(wrap, this.text);
    this.editor = se;

    return wrap;
  }

  destroy(dom) {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    super.destroy(dom);
  }
}

function buildGalleryDeco(state) {
  const ranges = [];
  let start = -1, end = -1, count = 0;
  const flush = () => {
    if (start < 0) return;
    const range = extendedRange(state, start, end);
    const text = state.doc.sliceString(range.from, range.to);
    // 编辑中的 gallery 换成 textarea 编辑器(选中态判断不可行:Obsidian 自带 embed 会盖住源码行)
    const widget = editingGalleries.has(text)
      ? new BiliGalleryEditWidget(text, range.from, range.to, editingGalleries.get(text))
      : new BiliGalleryWidget(text, count, range.from, range.to);
    ranges.push(Decoration.replace({ widget, block: true }).range(range.from, range.to));
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
