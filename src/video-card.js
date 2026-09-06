// ========== 视频卡渲染(Shadow DOM 内填充) ==========

import { SVG_PLAY, SVG_LIKE } from './icons.js';

// 封面+时长 / 标题 / 播放点赞+日期 / UP主
export function fillVideoCard(div, card) {
  const a = (name) => div.dataset[name] || '';
  const bvid = a('bvid');
  const title = a('title');
  const cover = a('cover');
  const duration = a('duration');
  const views = a('views');
  const likes = a('likes');
  const up = a('up');
  const date = a('date');
  const url = `https://www.bilibili.com/video/${bvid}`;

  // 封面 + 时长角标
  const coverLink = document.createElement('a');
  coverLink.className = 'cover-link';
  coverLink.href = url;
  const img = document.createElement('img');
  img.className = 'cover';
  img.src = cover;
  img.alt = title;
  img.setAttribute('referrerpolicy', 'no-referrer');
  coverLink.appendChild(img);
  if (duration) {
    const badge = document.createElement('span');
    badge.className = 'duration';
    badge.textContent = duration;
    coverLink.appendChild(badge);
  }
  card.appendChild(coverLink);

  // 标题 + 数据 + UP主
  const body = document.createElement('div');
  body.className = 'body';

  const titleLink = document.createElement('a');
  titleLink.className = 'title';
  titleLink.href = url;
  titleLink.textContent = title;
  body.appendChild(titleLink);

  const stats = document.createElement('div');
  stats.className = 'stats';
  const group = document.createElement('span');
  group.className = 'stats-group';
  for (const [icon, value] of [[SVG_PLAY, views], [SVG_LIKE, likes]]) {
    if (!value) continue;
    const s = document.createElement('span');
    s.className = 'stat';
    s.innerHTML = icon;
    s.appendChild(document.createTextNode(value));
    group.appendChild(s);
  }
  stats.appendChild(group);
  if (date) {
    const d = document.createElement('span');
    d.textContent = date;
    stats.appendChild(d);
  }
  body.appendChild(stats);

  if (up) {
    const upDiv = document.createElement('div');
    upDiv.className = 'up';
    upDiv.textContent = up;
    body.appendChild(upDiv);
  }

  card.appendChild(body);
}
