// PWA ikonlarini bagimliliksiz uretir: node scripts/generate-icons.js
// Cikti: public/icon-192.png, public/icon-512.png
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Sahne: yuvarlak koseli lacivert degrade zemin + beyaz ₺ glifi
// Her piksel icin "coverage" hesaplanir (4x supersampling ile anti-alias)
function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const S = size
  const corner = S * 0.22

  // ₺ glif geometrisi (S'e oranli)
  const cx = S * 0.46
  const top = S * 0.24
  const stemW = S * 0.075
  const hookR = S * 0.15
  const hookCy = S * 0.61 // yay merkezi y
  const strokeW = stemW * 0.85
  const slope = 0.45 // caprazlarin egimi
  const dashHalf = S * 0.13

  function glyph(x, y) {
    // dikey govde
    if (Math.abs(x - cx) <= stemW / 2 && y >= top && y <= hookCy) return true
    // alt kanca: (cx + hookR, hookCy) merkezli yay, 90..180 derece arasi genisletilmis
    const dx = x - (cx + hookR)
    const dy = y - hookCy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (Math.abs(d - hookR) <= stemW / 2 && dy >= -stemW / 2 && dx <= stemW / 2) return true
    // iki capraz cizgi (sola-asagidan saga-yukari)
    for (const ya of [S * 0.40, S * 0.51]) {
      const yLine = ya - slope * (x - cx)
      if (Math.abs(y - yLine) <= strokeW / 2 && Math.abs(x - cx) <= dashHalf) return true
    }
    return false
  }

  function roundedRect(x, y) {
    const rx = Math.max(corner - x, x - (S - corner), 0)
    const ry = Math.max(corner - y, y - (S - corner), 0)
    return rx * rx + ry * ry <= corner * corner
  }

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let bgCov = 0
      let glCov = 0
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x = px + (sx + 0.5) / 2
          const y = py + (sy + 0.5) / 2
          if (roundedRect(x, y)) {
            bgCov++
            if (glyph(x, y)) glCov++
          }
        }
      }
      bgCov /= 4
      glCov /= 4
      const t = (px + py) / (2 * S) // degrade
      const bg = [
        Math.round(43 + (74 - 43) * t),
        Math.round(45 + (77 - 45) * t),
        Math.round(110 + (176 - 110) * t),
      ]
      const i = (py * S + px) * 4
      rgba[i] = Math.round(bg[0] + (255 - bg[0]) * glCov)
      rgba[i + 1] = Math.round(bg[1] + (255 - bg[1]) * glCov)
      rgba[i + 2] = Math.round(bg[2] + (255 - bg[2]) * glCov)
      rgba[i + 3] = Math.round(255 * bgCov)
    }
  }
  return rgba
}

for (const size of [192, 512]) {
  const png = encodePng(size, render(size))
  const out = path.join(__dirname, '..', 'public', `icon-${size}.png`)
  fs.writeFileSync(out, png)
  console.log(`${out} (${png.length} bytes)`)
}
