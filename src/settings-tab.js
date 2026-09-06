// ========== 设置面板(分组) ==========

import { PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, settings } from './settings.js';

export class BiliCardSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // 数字输入框的公共逻辑:解析合法才保存应用
  numSetting(container, name, desc, key, placeholder, min) {
    new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText((t) => t
        .setPlaceholder(placeholder)
        .setValue(String(settings[key]))
        .onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= min) {
            settings[key] = n;
            await this.plugin.applySettings();
          }
        }));
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'B站卡片' });

    // ===== 布局 =====
    containerEl.createEl('h3', { text: '布局' });

    this.numSetting(containerEl, '卡片宽度', '每张卡片的宽度(px),默认 320。随便填,超宽超限自己负责', 'cardWidth', '320', 1);

    new Setting(containerEl)
      .setName('封面宽高比')
      .setDesc('如 16/9、4/3、1/1,甚至 16/18 竖封面。非法值回退 16/9')
      .addText((t) => t
        .setPlaceholder('16/9')
        .setValue(settings.coverAspect)
        .onChange(async (v) => {
          settings.coverAspect = v.trim() || DEFAULT_SETTINGS.coverAspect;
          await this.plugin.applySettings();
        }));

    this.numSetting(containerEl, '卡片间距', '卡片外边距(px),实际间距为两倍,默认 10。填 0 密排,填 100 银河', 'gap', '10', 0);

    new Setting(containerEl)
      .setName('标题行数')
      .setDesc('标题固定显示行数,超出省略;固定行数让卡片同高、网格整齐。想取消固定高度就拉到 0')
      .addSlider((sl) => sl
        .setLimits(0, 10, 1)
        .setValue(settings.titleLines)
        .setDynamicTooltip()
        .onChange(async (v) => {
          settings.titleLines = v;
          await this.plugin.applySettings();
        }));

    this.numSetting(containerEl, '文本上下间距', '卡片内文本块的纵向 padding(px),默认 12。调小卡片更紧凑,填 0 贴边', 'textPadding', '12', 0);

    // ===== UP主卡 =====
    containerEl.createEl('h3', { text: 'UP主卡' });

    this.numSetting(containerEl, '头像大小', 'UP主卡头像直径(px),默认 60', 'avatarSize', '60', 1);

    // ===== 字体 =====
    containerEl.createEl('h3', { text: '字体' });

    new Setting(containerEl)
      .setName('卡片字体')
      .setDesc('标题/统计/UP主的 font-family,如 "PingFang SC, sans-serif"。留空跟随主题')
      .addText((t) => t
        .setPlaceholder('跟随主题')
        .setValue(settings.cardFont)
        .onChange(async (v) => {
          settings.cardFont = v.trim();
          await this.plugin.applySettings();
        }));

    this.numSetting(containerEl, '卡片字号', '标题字号(px),统计/UP主按 0.86 倍跟随,默认 14', 'cardSize', '14', 1);

    // ===== 源码编辑器 =====
    containerEl.createEl('h3', { text: '源码编辑器' });

    new Setting(containerEl)
      .setName('编辑器字体')
      .setDesc('点卡片进入编辑态后 textarea 的 font-family。留空用等宽字体')
      .addText((t) => t
        .setPlaceholder('等宽字体')
        .setValue(settings.editorFont)
        .onChange(async (v) => {
          settings.editorFont = v.trim();
          await this.plugin.applySettings();
        }));

    this.numSetting(containerEl, '编辑器字号', '编辑态 textarea 的字号(px),默认 13', 'editorSize', '13', 1);
  }
}
