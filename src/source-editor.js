// ========== 嵌在画廊编辑态里的迷你 CodeMirror(带 HTML 语法高亮) ==========
// @codemirror/* 与 @lezer/common/highlight/lr 全部 external,复用 Obsidian 运行时,
// 避免打两份 CM6 导致 instanceof/装饰体系分裂;只有 @lezer/html(HTML 语法表)被打包。
//
// 高亮不用 HighlightStyle:它的 StyleModule 只在首次实例化的文档里生效,
// 弹出窗(canvas 等同理)永远拿不到 CSS。改用 syntaxTree + 自命名 mark 装饰,
// 样式注入宿主文档,任何窗口都稳定。

import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin } from '@codemirror/view';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { settings } from './settings.js';

// ---- 自管理的高亮装饰:类名我们自己定,CSS 自己注入宿主文档 ----
const NODE_DECO = {
  TagName: 'bili-hl-tag',
  AttributeName: 'bili-hl-attr',
  AttributeValue: 'bili-hl-str',
  Comment: 'bili-hl-comment',
};

function buildHighlights(view) {
  const builder = new RangeSetBuilder();
  const decos = {};
  const getDeco = (cls) => (decos[cls] ||= Decoration.mark({ class: cls }));
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        const cls = NODE_DECO[node.name];
        if (cls) builder.add(node.from, node.to, getDeco(cls));
      },
    });
  }
  return builder.finish();
}

const highlighter = ViewPlugin.fromClass(
  class {
    constructor(view) { this.decorations = buildHighlights(view); }
    update(update) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildHighlights(update.view);
    }
  },
  { decorations: (v) => v.decorations }
);

// ---- 高亮 CSS:按宿主文档注入(主窗/弹出窗各自的 document)----
const HL_CSS = `
.bili-hl-tag { color: var(--code-tag, var(--code-keyword, #c678dd)); }
.bili-hl-attr { color: var(--code-property, #d19a66); }
.bili-hl-str { color: var(--code-string, #98c379); }
.bili-hl-comment { color: var(--code-comment, var(--text-faint)); }
`;
const injectedDocs = new WeakSet();
function ensureCss(doc) {
  if (injectedDocs.has(doc)) return;
  injectedDocs.add(doc);
  const el = doc.createElement('style');
  el.textContent = HL_CSS;
  doc.head.appendChild(el);
}

export class SourceEditor {
  constructor(parent, text) {
    ensureCss(parent.ownerDocument);
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          html(),
          highlighter,
          EditorView.lineWrapping,
          EditorView.theme({
            '&': {
              fontSize: `${settings.editorSize}px`,
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--background-primary)',
            },
            '.cm-scroller': {
              fontFamily: settings.editorFont || 'var(--font-monospace)',
              lineHeight: '1.6',
              maxHeight: '600px',
              overflow: 'auto',
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-gutters': {
              backgroundColor: 'var(--background-primary)',
              color: 'var(--text-faint)',
              border: 'none',
            },
          }),
        ],
      }),
    });
  }

  get value() { return this.view.state.doc.toString(); }

  set value(v) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: v } });
  }

  scrollToEnd() {
    const end = this.view.state.doc.length;
    this.view.dispatch({
      selection: { anchor: end },
      effects: EditorView.scrollIntoView(end),
    });
  }

  destroy() { this.view.destroy(); }
}
