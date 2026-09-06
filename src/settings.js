// ========== 可配置项与尺寸估算 ==========

export const DEFAULT_SETTINGS = {
  cardWidth: 320,      // 卡片宽度(px)
  coverAspect: '16/9', // 封面宽高比
  gap: 10,             // 卡片间距(margin,px)
  titleLines: 2,       // 标题固定行数(0 = 不固定,卡高随内容变化)
  textPadding: 12,     // 文本上下间距(px,卡片内文本块的纵向 padding,调小更紧凑)
  cardFont: '',        // 卡片字体(空 = 跟随主题)
  cardSize: 14,        // 卡片字号(px)
  editorFont: '',      // 源码编辑器字体(空 = 等宽)
  editorSize: 13,      // 源码编辑器字号(px)
  avatarSize: 60,      // UP主卡头像直径(px)
};

// 运行期设置,插件 onload 时 Object.assign 覆盖;各处 import 同一对象,改动即生效
export const settings = Object.assign({}, DEFAULT_SETTINGS);

// 标题块高度:行数 × 字号 × 1.4 行高
export function titleBlockHeight() {
  return Math.round(settings.titleLines * settings.cardSize * 1.4);
}

// 封面高度估算:宽×比例
export function coverHeight() {
  const m = String(settings.coverAspect).split('/');
  const ratio = m.length === 2 && +m[0] > 0 && +m[1] > 0 ? (+m[1]) / (+m[0]) : 9 / 16;
  return Math.round(settings.cardWidth * ratio);
}

// 视频卡总高估算:封面 + 标题块 + 上下间距 + 统计/UP主/边框 ≈ 52
export function cardHeight() {
  return coverHeight() + titleBlockHeight() + settings.textPadding * 2 + 52;
}

// UP主卡总高估算:头像行 = 头像直径 + 上下间距;有代表作再加封面+标题
export function upCardHeight(hasVideo) {
  const head = settings.avatarSize + settings.textPadding * 2 + 6;
  if (!hasVideo) return head + 4;
  return head + coverHeight() + Math.max(titleBlockHeight(), Math.round(settings.cardSize * 1.4)) + 28;
}

// 设置签名:变了说明要重渲染已有卡片
export function settingsSig() {
  return JSON.stringify(settings);
}
