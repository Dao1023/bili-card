// ========== 输 URL 生成卡片的弹窗(支持批量,每行一个链接) ==========

import { Modal, Notice, Setting } from 'obsidian';
import { parseBiliUrl, fetchVideo, fetchUp, videoCardLine, upCardLine } from './fetch.js';

export class UrlModal extends Modal {
  /**
   * @param onInsert (text: string) => void  生成成功后由调用方决定插到哪;批量时 text 是多行
   */
  constructor(app, onInsert) {
    super(app);
    this.onInsert = onInsert;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: '插入 B 站卡片' });

    contentEl.createDiv({ text: '链接(每行一个,支持批量)', cls: 'bili-url-modal-label' });
    this.urlsEl = contentEl.createEl('textarea', { cls: 'bili-url-modal-input' });
    this.urlsEl.placeholder = 'https://www.bilibili.com/video/BV… 或 space.bilibili.com/…\n批量时每行一个链接';
    this.urlsEl.rows = 4;
    this.urlsEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.submit(); }
    });

    new Setting(contentEl)
      .setName('代表作视频')
      .setDesc('仅单条 UP主卡生效:可选,填一个代表作视频链接')
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

    // 剪贴板预填:整段文本本身就是一个干净链接/BV号/mid 才填
    // (含空白、< > 或超长的一律不填,避免复制了卡片源码/长文时填进一堆垃圾)
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then((t) => {
        const c = (t || '').trim();
        if (c && c.length < 120 && !/[\s<>]/.test(c) && parseBiliUrl(c) && !this.urlsEl.value) {
          this.urlsEl.value = c;
        }
      }).catch(() => { /* 读不到就算了 */ });
    }
    window.setTimeout(() => this.urlsEl.focus(), 50);
  }

  async submit() {
    const urls = this.urlsEl.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!urls.length) {
      this.statusEl.setText('请输入链接');
      return;
    }
    const parsed = urls.map((u) => ({ u, p: parseBiliUrl(u) }));
    const bad = parsed.find((x) => !x.p);
    if (bad) {
      this.statusEl.setText(`无法识别: ${bad.u.slice(0, 50)}`);
      return;
    }

    const single = parsed.length === 1;
    const lines = [];
    let failed = 0;
    for (let i = 0; i < parsed.length; i++) {
      const { u, p } = parsed[i];
      this.statusEl.setText(`拉取数据中… ${i + 1}/${parsed.length}`);
      try {
        if (p.type === 'video') {
          lines.push(videoCardLine(await fetchVideo(p.bvid)));
        } else {
          const up = await fetchUp(p.mid);
          let video = null;
          if (single) {
            const vurl = this.vurlInput.getValue().trim();
            if (vurl) {
              const vp = parseBiliUrl(vurl);
              if (!vp || vp.type !== 'video') throw new Error('代表作不是视频链接');
              video = await fetchVideo(vp.bvid);
            }
          }
          lines.push(upCardLine(up, video));
        }
      } catch (e) {
        failed++;
        console.warn('[bili-card] 拉取失败:', u, e);
      }
      if (i < parsed.length - 1) await new Promise((r) => setTimeout(r, 400));
    }

    if (!lines.length) {
      this.statusEl.setText('全部失败,请检查网络或链接');
      return;
    }
    this.onInsert(lines.join('\n'));
    if (failed) new Notice(`已插入 ${lines.length} 张,${failed} 条失败被跳过`);
    this.close();
  }
}
