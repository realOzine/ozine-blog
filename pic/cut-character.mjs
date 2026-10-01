// 从角色设定图（original/character-sheet.jpg）生成站点用的三张图：
//   logo.png       头像，透明底
//   character.png  全身立绘，透明底
//   favicon.svg    头像垫浅色圆角底
// 用法：node pic/cut-character.mjs
// 换了设定图（比如拿到高清原图）后，按新图的像素位置改下面的 CROPS，再重新运行。
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const dir = import.meta.dirname
const SRC = path.join(dir, 'original/character-sheet.jpg')

// 最暗通道高于它、且与裁切边缘连通的像素算背景。设高一点，免得顺着浅色的衣服轮廓漏进去。
const BG = 250

const CROPS = {
  // 设定图右上角第一个正面头像
  logo: { left: 742, top: 44, width: 180, height: 150, scale: 3, wipe: [] },
  // 设定图中间的全身像；wipe 是放大后坐标系里要先涂白的矩形 [x, y, w, h]，用来去掉两条标注线和文字
  character: {
    left: 486,
    top: 8,
    width: 230,
    height: 700,
    scale: 2,
    wipe: [
      [0, 150, 92, 75],
      [0, 222, 108, 42],
      [0, 455, 70, 45],
    ],
  },
}

async function cut({ left, top, width, height, scale, wipe }) {
  const { data, info } = await sharp(SRC)
    .extract({ left, top, width, height })
    .resize({ width: Math.round(width * scale), kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info

  for (const [rx, ry, rw, rh] of wipe) {
    for (let y = ry; y < ry + rh && y < h; y++) {
      for (let x = rx; x < rx + rw && x < w; x++) data.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 4)
    }
  }

  // 从四条边向内漫水填充，标出背景
  const lightness = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
  const bg = new Uint8Array(w * h)
  const stack = []
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (bg[i] || lightness(i) < BG) return
    bg[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    visit(x, 0)
    visit(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    visit(0, y)
    visit(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    const y = (i - x) / w
    visit(x + 1, y)
    visit(x - 1, y)
    visit(x, y + 1)
    visit(x, y - 1)
  }

  // 背景变透明；紧贴背景的浅色边缘像素按深浅折算成半透明，并还原成它原本的墨色，避免留下白边
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) {
      data[i * 4 + 3] = 0
      continue
    }
    const x = i % w
    const y = (i - x) / w
    let nearBg = false
    for (let dy = -2; dy <= 2 && !nearBg; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) {
          nearBg = true
          break
        }
      }
    }
    if (!nearBg) continue
    const alpha = Math.min(1, (255 - lightness(i)) / 150)
    if (alpha >= 1) continue
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = Math.max(0, Math.round((data[i * 4 + c] - (1 - alpha) * 255) / Math.max(alpha, 0.01)))
    }
    data[i * 4 + 3] = Math.round(alpha * 255)
  }

  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim().png({ compressionLevel: 9 }).toBuffer()
}

for (const [name, crop] of Object.entries(CROPS)) {
  fs.writeFileSync(path.join(dir, `${name}.png`), await cut(crop))
}

// 网站图标：头像缩进 96×96 的浅色圆角方块里，深色标签栏上也看得清墨线
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
const icon = await sharp(path.join(dir, 'logo.png'))
  .resize({ width: 84, height: 84, fit: 'contain', background: transparent })
  .extend({ top: 6, bottom: 6, left: 6, right: 6, background: transparent })
  .png()
  .toBuffer()
fs.writeFileSync(
  path.join(dir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="20" fill="#faf9fc"/>
  <image width="96" height="96" href="data:image/png;base64,${icon.toString('base64')}"/>
</svg>
`,
)
