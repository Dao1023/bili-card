// ========== 插件入口 ==========

import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, settings } from './settings.js';
import { globalCss } from './css.js';
import { BiliCardRenderer } from './renderer.js';
import { galleryField, healGalleryViews, pokeView, setGalleryApp } from './gallery.js';
import { BiliCardSettingTab } from './settings-tab.js';
import { UrlModal } from './url-modal.js';

// 把卡片行插到编辑器:当前行非空就插到行尾新起一行,空行就原地插
function insertCardLine(editor, line) {
  const cursor = editor.getCursor();
  const lineText = editor.getLine(cursor.line);
  if (lineText.trim()) {
    editor.replaceRange('\n' + line, { line: cursor.line, ch: lineText.length });
  } else {
    editor.replaceRange(line, cursor);
  }
}

export default class BiliCardPlugin extends Plugin {
  async onload() {
    // 加载设置
    Object.assign(settings, DEFAULT_SETTINGS, await this.loadData());
    setGalleryApp(this.app);

    // 命令:输 URL 生成卡片
    this.addCommand({
      id: 'insert-bili-card',
      name: '插入 B 站卡片(视频/UP主)',
      editorCallback: (editor) => {
        new UrlModal(this.app, (line) => insertCardLine(editor, line)).open();
      },
    });

    // 编辑器右键菜单入口(和命令同一逻辑)
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      menu.addItem((item) => item
        .setTitle('插入 B 站卡片')
        .setIcon('link')
        .onClick(() => new UrlModal(this.app, (line) => insertCardLine(editor, line)).open()));
    }));

    // 全局样式
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = globalCss();
    document.head.appendChild(this.styleEl);
    this.register(() => this.styleEl.remove());

    // 阅读模式:Markdown 后处理器增强
    this.registerMarkdownPostProcessor((el) => {
      el.querySelectorAll('div.bili-card, div.bili-up-card').forEach((div) => BiliCardRenderer.enhance(div));
    });

    // 设置面板
    this.addSettingTab(new BiliCardSettingTab(this.app, this));

    // Live Preview:StateField + widget 接管连续卡片行
    this.registerEditorExtension(galleryField);

    // 画廊自检愈合:后台标签/启动恢复的编辑器里,装饰可能空着(见 healGalleryViews)。
    // 加载完成后来一遍,之后 layout-change / file-open 时防抖各来一遍。
    const heal = () => {
      window.clearTimeout(this.healTimer);
      this.healTimer = window.setTimeout(() => {
        try { healGalleryViews(this.app); } catch (e) { console.error('[bili-card] heal failed:', e); }
      }, 400);
    };
    this.app.workspace.onLayoutReady(() => window.setTimeout(heal, 500));
    this.registerEvent(this.app.workspace.on('layout-change', heal));
    this.registerEvent(this.app.workspace.on('file-open', heal));
  }

  // 设置变更:保存 → 刷新全局样式 → 重渲染已增强的卡片(签名机制)→ poke 画廊视图重排
  async applySettings() {
    await this.saveData(settings);
    if (this.styleEl) this.styleEl.textContent = globalCss();
    // 阅读模式里已渲染的卡片:签名不同会被 enhance 重建 shadow 内容
    document.querySelectorAll('div.bili-card.bili-card-on, div.bili-up-card.bili-card-on').forEach((div) => BiliCardRenderer.enhance(div));
    // LP 画廊:widget 内卡片是 buildFromHTML 新建的,poke 重建即可
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cm = leaf.view && leaf.view.editor && leaf.view.editor.cm;
      if (!cm) return;
      if (cm.dom.querySelector('.bili-gallery-widget')) pokeView(cm);
    });
  }
}
