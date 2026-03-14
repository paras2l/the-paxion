import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const projectRoot = process.cwd()
const publicDir = path.join(projectRoot, 'public')
const sourceIconPath = path.join(publicDir, 'favicon.svg')
const outputPngPath = path.join(publicDir, 'paxion-icon.png')
const outputIcoPath = path.join(publicDir, 'paxion.ico')

const sourceIconSvg = await fs.readFile(sourceIconPath, 'utf8')

const canvasSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="64" y1="40" x2="448" y2="472" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0c1226" />
      <stop offset="0.55" stop-color="#24154a" />
      <stop offset="1" stop-color="#0a2040" />
    </linearGradient>
    <linearGradient id="glow" x1="84" y1="84" x2="428" y2="428" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8f46ff" stop-opacity="0.95" />
      <stop offset="1" stop-color="#47bfff" stop-opacity="0.8" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#050814" flood-opacity="0.55" />
    </filter>
  </defs>
  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#bg)" />
  <rect x="44" y="44" width="424" height="424" rx="100" fill="none" stroke="url(#glow)" stroke-opacity="0.35" stroke-width="6" />
  <circle cx="384" cy="138" r="40" fill="#47bfff" opacity="0.18" />
  <circle cx="148" cy="388" r="56" fill="#8f46ff" opacity="0.14" />
  <g filter="url(#shadow)">
    <g transform="translate(96 78) scale(6.7)">
      ${sourceIconSvg.replace('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="46" fill="none" viewBox="0 0 48 46">', '').replace('</svg>', '')}
    </g>
  </g>
</svg>`

const pngBuffer = await sharp(Buffer.from(canvasSvg))
  .png()
  .toBuffer()

await fs.writeFile(outputPngPath, pngBuffer)

const icoBuffer = await pngToIco(pngBuffer)
await fs.writeFile(outputIcoPath, icoBuffer)

console.log(`Generated ${path.relative(projectRoot, outputPngPath)} and ${path.relative(projectRoot, outputIcoPath)}`)