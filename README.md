# Bili Card

在 Obsidian 里把单行 B 站卡片标签渲染成卡片画廊：视频卡（封面/时长/播放量/点赞/UP主/日期）和 UP 主卡（头像/名字/粉丝数/代表作）。

Renders one-line Bilibili card tags as card galleries in Obsidian — video cards (cover, duration, stats, uploader, date) and UP-owner cards (avatar, name, fans, featured video).

## 用法

笔记里写一行一个卡片标签：

```html
<div class="bili-card" data-bvid="BV1xx411c7mD" data-title="视频标题" data-cover="https://i0.hdslb.com/bfs/archive/xxx.jpg" data-duration="03:45" data-views="12.3万" data-likes="1.2万" data-up="UP主名" data-date="2024-01-01"><a href="https://www.bilibili.com/video/BV1xx411c7mD">视频标题</a></div>
```

```html
<div class="bili-up-card" data-mid="4176573" data-name="UP主名" data-face="https://i0.hdslb.com/bfs/face/xxx.jpg" data-fans="68.9万"><a href="https://space.bilibili.com/4176573">UP主名</a></div>
```

UP 主卡可选代表作视频：追加 `data-bvid` / `data-vtitle` / `data-vcover`。

- **Live Preview**：连续的卡片行自动合并成画廊并排显示；点卡片打开链接，点画廊右上角 `</>` 按钮（或空白处）进入源码编辑态，改完"完成"写回。
- **阅读模式**：同样渲染成卡片。
- **无插件环境**（如 Publish）：退化为标签内的普通链接。

所有数据都在 `data-*` 属性里，模板和样式完全由插件负责——改样式不用动笔记。

## 设置

卡片宽度、封面宽高比、卡片间距、标题行数、卡片字体/字号、UP主头像大小、源码编辑器字体/字号，全部在设置面板可调。

## 图片与防盗链

封面/头像直接用 B 站 CDN 云端 URL（`i*.hdslb.com`，强制 https），渲染时带 `referrerpolicy="no-referrer"` 绕过防盗链，不下载到本地。

## 开发

```bash
npm install
npm run build   # 打包出 main.js
npm run dev     # watch 模式
```

源码在 `src/`（卡片渲染 `video-card.js` / `up-card.js`，画廊/编辑态 `gallery.js`，样式 `css.js`，设置 `settings.js` / `settings-tab.js`），esbuild 打包为根目录 `main.js`。

## License

MIT
