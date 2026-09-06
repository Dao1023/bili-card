// ========== 卡片 Shadow DOM 样式 + 全局样式 ==========

import { settings, titleBlockHeight, cardHeight } from './settings.js';

// Shadow DOM 内的卡片样式(视频卡 + UP主卡共用一卡一样式表)
export function cardCss() {
  const s = settings;
  const fixedTitle = s.titleLines > 0;
  return `
  :host {
    display: inline-block;
    width: ${s.cardWidth}px;
    margin: ${s.gap}px;
    vertical-align: top;
  }
  .card {
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--background-secondary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    font-size: ${s.cardSize}px;
    ${s.cardFont ? `font-family: ${s.cardFont};` : ''}
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .cover-link { text-decoration: none; display: block; position: relative; }
  .cover {
    width: 100%;
    aspect-ratio: ${s.coverAspect};
    object-fit: cover;
    display: block;
  }
  .duration {
    position: absolute; bottom: 8px; right: 8px;
    background: rgba(0,0,0,0.75); color: white;
    padding: 2px 6px; border-radius: 4px;
    font-size: 12px; font-weight: 500;
  }
  .body { padding: ${s.textPadding}px 12px; }
  .title {
    font-size: ${s.cardSize}px; font-weight: 600;
    color: var(--text-normal);
    text-decoration: none; display: block;
    margin-bottom: ${Math.round(s.textPadding * 2 / 3)}px; line-height: 1.4;
    ${fixedTitle ? `min-height: ${titleBlockHeight()}px; /* 固定标题高度,卡片总高恒定,网格整齐且不抖动 */` : ''}
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: ${fixedTitle ? s.titleLines : 'unset'}; -webkit-box-orient: vertical;
  }
  .title:hover { color: var(--accent-color); }
  .stats {
    display: flex; align-items: center; justify-content: space-between;
    color: var(--text-muted); font-size: 0.86em;
  }
  .stats-group { display: flex; align-items: center; gap: 12px; }
  .stat { display: flex; align-items: center; gap: 4px; }
  .stat svg { width: 1em; height: 1em; fill: currentColor; }
  .up {
    margin-top: ${Math.round(s.textPadding / 2)}px; color: var(--text-muted); font-size: 0.86em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* ===== UP主卡 ===== */
  .up-head {
    display: flex; gap: 12px; align-items: center;
    padding: ${s.textPadding}px 14px ${Math.max(s.textPadding - 2, 2)}px;
  }
  .avatar-link { flex-shrink: 0; }
  .avatar {
    width: ${s.avatarSize}px; height: ${s.avatarSize}px;
    border-radius: 50%; object-fit: cover; display: block;
    border: 2px solid var(--accent-color);
    transition: opacity 0.2s;
  }
  .avatar-link:hover .avatar { opacity: 0.8; }
  .up-name {
    font-size: 1.1em; font-weight: 600;
    color: var(--text-normal); text-decoration: none; display: block;
  }
  .up-name:hover { color: var(--accent-color); }
  .up-fans { color: var(--text-muted); font-size: 0.86em; margin-top: 2px; }
  .up-vcover-link { display: block; padding: 0 14px; text-decoration: none; }
  .up-vcover {
    width: 100%; aspect-ratio: ${s.coverAspect};
    object-fit: cover; border-radius: 6px; display: block;
    transition: opacity 0.2s;
  }
  .up-vcover-link:hover .up-vcover { opacity: 0.9; }
  .up-vtitle {
    display: -webkit-box; -webkit-line-clamp: ${fixedTitle ? s.titleLines : 'unset'}; -webkit-box-orient: vertical;
    overflow: hidden; text-overflow: ellipsis;
    padding: ${Math.round(s.textPadding * 2 / 3)}px 14px ${s.textPadding}px; line-height: 1.4;
    font-size: 0.93em; color: var(--text-normal); text-decoration: none;
  }
  .up-vtitle:hover { color: var(--accent-color); }
`;
}

// 注入 document.head 的全局样式(gallery 布局、编辑态、兜底卡片)
export function globalCss() {
  const s = settings;
  return `
  /* gallery widget 本体:flex 布局 */
  .bili-gallery-widget {
    display: flex;
    flex-wrap: wrap;
    margin: -${s.gap}px; /* 抵消卡片 margin,让 gallery 外边距干净 */
    position: relative;
  }
  /* 右上角编辑按钮:平时半透明,悬停显现 */
  .bili-gallery-edit {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 10;
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-family: monospace;
    color: var(--text-muted);
    background: var(--background-secondary);
    opacity: 0;
    transition: opacity 0.15s;
    cursor: pointer;
  }
  .bili-gallery-widget:hover .bili-gallery-edit {
    opacity: 0.8;
  }
  .bili-gallery-edit:hover {
    opacity: 1 !important;
    color: var(--text-normal);
  }
  /* URL 弹窗状态行 */
  .bili-url-modal-status {
    min-height: 1.4em;
    margin: 6px 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  /* URL 弹窗:多行链接输入框 */
  .bili-url-modal-label {
    margin-bottom: 4px;
    color: var(--text-normal);
  }
  .bili-url-modal-input {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-monospace);
    font-size: 13px;
    padding: 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    resize: vertical;
    margin-bottom: 6px;
  }
  /* LP 里 Obsidian 自带 html embed 会双渲染卡片行,藏掉(卡片由 gallery widget 负责) */
  .cm-html-embed:has(div.bili-card, div.bili-up-card) {
    display: none !important;
  }
  /* 编辑态:内嵌 CodeMirror(字号/边框等在 source-editor.js 的 theme 里) */
  .bili-gallery-editor .cm-editor .cm-content {
    padding: 8px 4px;
  }
  .bili-gallery-editor-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 6px; /* 栏在顶部 */
    justify-content: flex-end;
  }
  /* 完成按钮撑到最右(添加/排序居左) */
  .bili-gallery-save {
    margin-left: auto;
  }
  /* 阅读模式/未接管时的兜底:卡片 inline-block 并排 */
  div.bili-card:not(.bili-card-on), div.bili-up-card:not(.bili-card-on) {
    display: inline-block;
    width: ${s.cardWidth}px;
    min-height: ${cardHeight()}px;
    margin: ${s.gap}px;
    vertical-align: top;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    padding: 12px;
    box-sizing: border-box;
  }
  div.bili-card:not(.bili-card-on) > a, div.bili-up-card:not(.bili-card-on) > a {
    color: var(--text-muted);
    font-size: 13px;
    text-decoration: none;
  }
`;
}
