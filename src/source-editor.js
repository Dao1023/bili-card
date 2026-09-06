// ========== 嵌在画廊编辑态里的迷你 CodeMirror(带 HTML 语法高亮) ==========
// @codemirror/* 与 @lezer/common/highlight/lr 全部 external,复用 Obsidian 运行时,
// 避免打两份 CM6 导致 instanceof/装饰体系分裂;只有 @lezer/html(HTML 语法表)被打包。

import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { tags } from '@lezer/highlight';
import { settings } from './settings.js';

// 配色跟 Obsidian 代码主题变量走,缺省有兜底
const hlStyle = HighlightStyle.define([
  { tag: tags.tagName, color: 'var(--code-tag, var(--code-keyword, #c678dd))' },
  { tag: tags.attributeName, color: 'var(--code-property, #d19a66)' },
  { tag: [tags.attributeValue, tags.string], color: 'var(--code-string, #98c379)' },
  { tag: tags.angleBracket, color: 'var(--code-punctuation, var(--text-muted))' },
  { tag: tags.comment, color: 'var(--code-comment, var(--text-faint))' },
]);

export class SourceEditor {
  constructor(parent, text) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          html(),
          syntaxHighlighting(hlStyle),
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
