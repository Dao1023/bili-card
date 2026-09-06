// ========== B站 API 拉取 + 单行卡片生成 ==========

import { requestUrl } from 'obsidian';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

// 识别输入:视频链接/裸BV号 → 视频卡;空间链接/裸数字 mid → UP主卡
export function parseBiliUrl(text) {
  const t = (text || '').trim();
  if (!t) return null;
  let m = t.match(/bilibili\.com\/video\/(BV[\da-zA-Z]{10})/) || t.match(/^(BV[\da-zA-Z]{10})$/);
  if (m) return { type: 'video', bvid: m[1] };
  m = t.match(/space\.bilibili\.com\/(\d+)/) || t.match(/^(\d{1,16})$/);
  if (m) return { type: 'up', mid: m[1] };
  return null;
}

function toHttps(url) {
  return url && url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

function formatNumber(num) {
  return num >= 10000 ? `${(num / 10000).toFixed(1)}万` : String(num);
}

function formatDuration(seconds) {
  if (seconds < 60) return `00:${String(seconds).padStart(2, '0')}`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function fetchVideo(bvid) {
  const r = await requestUrl({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, headers: UA });
  const d = r.json;
  if (d.code !== 0 || !d.data) throw new Error(d.message || `视频 API 错误 (${d.code})`);
  const v = d.data;
  return {
    bvid: v.bvid || bvid,
    title: v.title || '',
    cover: toHttps(v.pic || ''),
    duration: formatDuration(v.duration || 0),
    views: formatNumber((v.stat && v.stat.view) || 0),
    likes: formatNumber((v.stat && v.stat.like) || 0),
    up: (v.owner && v.owner.name) || '',
    date: formatDate(v.pubdate),
  };
}

export async function fetchUp(mid) {
  const r = await requestUrl({ url: `https://api.bilibili.com/x/web-interface/card?mid=${mid}`, headers: UA });
  const d = r.json;
  if (d.code !== 0 || !d.data) throw new Error(d.message || `UP主 API 错误 (${d.code})`);
  const card = d.data.card || {};
  return {
    mid,
    name: card.name || '',
    face: toHttps(card.face || ''),
    fans: formatNumber(d.data.follower || 0),
  };
}

// 单行视频卡(格式与 tool-bilibili-video 一致)
export function videoCardLine(v) {
  const attrs = { bvid: v.bvid, title: v.title, cover: v.cover, duration: v.duration, views: v.views, likes: v.likes, up: v.up, date: v.date };
  const parts = Object.entries(attrs).filter(([, val]) => val).map(([k, val]) => `data-${k}="${escapeAttr(val)}"`).join(' ');
  const url = `https://www.bilibili.com/video/${v.bvid}`;
  return `<div class="bili-card" ${parts}><a href="${url}">${escapeAttr(v.title)}</a></div>`;
}

// 单行 UP主卡,v 有值时附带代表作(格式与 tool-bilibili-up / up2bilicard 一致)
export function upCardLine(u, v) {
  const attrs = { mid: u.mid, name: u.name, face: u.face, fans: u.fans };
  if (v) Object.assign(attrs, { bvid: v.bvid, vtitle: v.title, vcover: v.cover });
  const parts = Object.entries(attrs).filter(([, val]) => val).map(([k, val]) => `data-${k}="${escapeAttr(val)}"`).join(' ');
  const url = `https://space.bilibili.com/${u.mid}`;
  return `<div class="bili-up-card" ${parts}><a href="${url}">${escapeAttr(u.name)}</a></div>`;
}
