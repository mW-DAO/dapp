/**
 * 本地像素头像生成工具 (Identicon - OKX/Wallet Style)
 * 纯粹的对称像素风格，移除了字母遮罩
 */

export function generateIdenticon(seed: string): string {
  // 1. 确定性哈希
  function getHash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  const baseHash = getHash(seed || "default");

  // 2. 生成调色板 (三色系统)
  const h1 = baseHash % 360;
  const h2 = (h1 + 60 + (baseHash % 120)) % 360;
  const h3 = (h1 + 180 + (baseHash % 60)) % 360;

  const colorBg = `hsl(${h1}, 70%, 45%)`;
  const colorMain = `hsl(${h2}, 85%, 60%)`;
  const colorSpot = `hsl(${h3}, 90%, 55%)`;

  const size = 10;
  const halfWidth = 5;

  // 3. 生成随机数据位
  const bits: number[] = [];
  let currentSeed = seed || "default";
  // 需要 size * halfWidth = 50 个点的数据
  while (bits.length < size * halfWidth) {
    const h = getHash(currentSeed);
    for (let i = 0; i < 10; i++) {
      bits.push((h >> (i * 3)) & 0x3);
    }
    currentSeed += "n";
  }

  // 4. 构建网格
  const grid: number[] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < halfWidth; x++) {
      const bit = bits[y * halfWidth + x];
      // 0: 背景色, 1: 主色, 2: 点缀色 (权重分配：1/4 主色, 1/4 点缀色, 1/2 背景色)
      const val = bit === 1 ? 1 : bit === 2 ? 2 : 0;
      row.push(val);
    }
    // 左右完全对称镜像
    const fullRow = [...row, ...[...row].reverse()];
    grid.push(...fullRow);
  }

  // 5. 渲染 SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" shape-rendering="crispEdges">`;
  svg += `<rect width="${size}" height="${size}" fill="${colorBg}" />`;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > 0) {
      const x = i % size;
      const y = Math.floor(i / size);
      const fill = grid[i] === 1 ? colorMain : colorSpot;
      svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" />`;
    }
  }
  svg += `</svg>`;

  const base64 =
    typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString("base64");

  return `data:image/svg+xml;base64,${base64}`;
}
