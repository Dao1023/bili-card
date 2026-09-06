// ========== UP主卡渲染(Shadow DOM 内填充) ==========

// 头像+名字+粉丝数 / 代表作封面+标题(可选,data-bvid 存在才有)
export function fillUpCard(div, card) {
  const a = (name) => div.dataset[name] || '';
  const mid = a('mid');
  const name = a('name');
  const face = a('face');
  const fans = a('fans');
  const bvid = a('bvid');
  const vtitle = a('vtitle');
  const vcover = a('vcover');
  const spaceUrl = `https://space.bilibili.com/${mid}`;

  // 头像 + 名字 + 粉丝数
  const head = document.createElement('div');
  head.className = 'up-head';

  const avatarLink = document.createElement('a');
  avatarLink.className = 'avatar-link';
  avatarLink.href = spaceUrl;
  const avatar = document.createElement('img');
  avatar.className = 'avatar';
  avatar.src = face;
  avatar.alt = name;
  avatar.setAttribute('referrerpolicy', 'no-referrer');
  avatarLink.appendChild(avatar);
  head.appendChild(avatarLink);

  const info = document.createElement('div');
  const nameLink = document.createElement('a');
  nameLink.className = 'up-name';
  nameLink.href = spaceUrl;
  nameLink.textContent = name;
  info.appendChild(nameLink);
  if (fans) {
    const f = document.createElement('div');
    f.className = 'up-fans';
    f.textContent = `${fans} 粉丝`;
    info.appendChild(f);
  }
  head.appendChild(info);
  card.appendChild(head);

  // 代表作视频(可选)
  if (bvid) {
    const vurl = `https://www.bilibili.com/video/${bvid}`;
    const vcoverLink = document.createElement('a');
    vcoverLink.className = 'up-vcover-link';
    vcoverLink.href = vurl;
    const vimg = document.createElement('img');
    vimg.className = 'up-vcover';
    vimg.src = vcover;
    vimg.alt = vtitle;
    vimg.setAttribute('referrerpolicy', 'no-referrer');
    vcoverLink.appendChild(vimg);
    card.appendChild(vcoverLink);

    const vt = document.createElement('a');
    vt.className = 'up-vtitle';
    vt.href = vurl;
    vt.textContent = vtitle;
    card.appendChild(vt);
  }
}
