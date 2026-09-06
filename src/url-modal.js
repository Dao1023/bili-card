// ========== 输 URL 生成卡片的弹窗 ==========

import { Modal, Notice, Setting } from 'obsidian';
import { parseBiliUrl, fetchVideo, fetchUp, videoCardLine, upCardLine } from './fetch.js';

export class UrlModal extends Modal {
  /**
   * @param onInsert (line: string) => void  生成成功后由调用方决定插到哪
   */
  constructor(app, onInsert) {
    super(app);
    this.onInsert = onInsert;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: '插入 B 站卡片' });

    let urlInput;
    new Setting(contentEl)
      .setName('链接')
      .setDesc('视频链接 / BV号,或 UP主空间链接 / mid')
      .addText((t) => {
        urlInput = t;
        t.setPlaceholder('https://www.bilibili.com/video/BV… 或 space.bilibili.com/…');
        t.inputEl.style.width = '100%';
        t.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
        });
      });

    new Setting(contentEl)
      .setName('代表作视频')
      .setDesc('仅 UP主卡:可选,填一个代表作视频链接')
      .addText((t) => {
        this.vurlInput = t;
        t.setPlaceholder('可空');
        t.inputEl.style.width = '100%';
      });

    this.statusEl = contentEl.createDiv({ cls: 'bili-url-modal-status' });

    new Setting(contentEl)
      .addButton((b) => b
        .setButtonText('生成卡片')
        .setCta()
        .onClick(() => this.submit()))
      .addButton((b) => b
        .setButtonText('取消')
        .onClick(() => this.close()));

    // 剪贴板里是 B 站链接就直接预填
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then((t) => {
        if (t && parseBiliUrl(t) && !urlInput.getValue()) urlInput.setValue(t.trim());
      }).catch(() => { /* 读不到就算了 */ });
    }
    window.setTimeout(() => urlInput.inputEl.focus(), 50);
  }

  async submit() {
    const parsed = parseBiliUrl(this.contentEl.querySelector('input').value);
    if (!parsed) {
      this.statusEl.setText('不是有效的 B 站链接(视频 / BV号 / 空间链接 / mid)');
      return;
    }
    this.statusEl.setText('拉取数据中…');
    try {
      let line;
      if (parsed.type === 'video') {
        line = videoCardLine(await fetchVideo(parsed.bvid));
      } else {
        const up = await fetchUp(parsed.mid);
        const vurl = this.vurlInput.getValue().trim();
        let video = null;
        if (vurl) {
          const vp = parseBiliUrl(vurl);
          if (!vp || vp.type !== 'video') throw new Error('代表作不是视频链接');
          video = await fetchVideo(vp.bvid);
        }
        line = upCardLine(up, video);
      }
      this.onInsert(line);
      this.close();
    } catch (e) {
      this.statusEl.setText(`失败:${e.message}`);
      new Notice(`B站卡片生成失败:${e.message}`);
    }
  }
}
