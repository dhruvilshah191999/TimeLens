// Generates the extension PNG icons (a simple clock glyph) with zero deps,
// using Node's built-in zlib for PNG encoding. Run: `pnpm icons`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')

// --- PNG encoding (RGBA, no compression filters beyond "none") ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size, rgba) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Draw a clock glyph ---
const BG = [79, 70, 229] // indigo-600
const FACE = [255, 255, 255]
const HAND = [30, 27, 75] // indigo-950

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const faceR = size * 0.42
  const handW = Math.max(1, size * 0.045)

  // clock hands: minute hand up (12), hour hand toward 4 o'clock
  const hands = [
    { angle: -Math.PI / 2, len: faceR * 0.72 }, // minute → 12
    { angle: Math.PI / 3, len: faceR * 0.5 }, // hour → ~4
  ]

  function distToSegment(px, py, x2, y2) {
    const dx = x2 - cx
    const dy = y2 - cy
    const l2 = dx * dx + dy * dy
    let t = ((px - cx) * dx + (py - cy) * dy) / l2
    t = Math.max(0, Math.min(1, t))
    const projx = cx + t * dx
    const projy = cy + t * dy
    return Math.hypot(px - projx, py - projy)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      let color = null
      let alpha = 255

      // rounded-square background
      const margin = size * 0.06
      if (
        x >= margin &&
        x <= size - margin &&
        y >= margin &&
        y <= size - margin
      ) {
        color = BG
      } else {
        alpha = 0
      }

      if (color && r <= faceR) color = FACE

      if (color === FACE) {
        // center pivot dot
        if (r <= handW * 1.6) color = HAND
        for (const h of hands) {
          const x2 = cx + Math.cos(h.angle) * h.len
          const y2 = cy + Math.sin(h.angle) * h.len
          if (distToSegment(x + 0.5, y + 0.5, x2, y2) <= handW) {
            color = HAND
            break
          }
        }
      }

      if (alpha === 0) {
        rgba[i] = 0
        rgba[i + 1] = 0
        rgba[i + 2] = 0
        rgba[i + 3] = 0
      } else {
        rgba[i] = color[0]
        rgba[i + 1] = color[1]
        rgba[i + 2] = color[2]
        rgba[i + 3] = 255
      }
    }
  }
  return rgba
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, drawIcon(size))
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), png)
  console.log(`wrote icon-${size}.png (${png.length} bytes)`)
}
