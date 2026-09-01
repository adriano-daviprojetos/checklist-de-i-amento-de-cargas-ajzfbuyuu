const fs = require('fs')
const path = require('path')

const ogImage = path.join(__dirname, 'public/og-image.png')
const logoPng = path.join(__dirname, 'public/logo.png')
const logoSvg = path.join(__dirname, 'public/logo.svg')

if (fs.existsSync(ogImage)) {
  const buffer = fs.readFileSync(ogImage)
  fs.writeFileSync(logoPng, buffer)
  console.log('Successfully copied binary logo to public/logo.png, size:', buffer.length)

  const base64 = buffer.toString('base64')
  const dataUri = `data:image/png;base64,${base64}`
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <image href="${dataUri}" width="200" height="60" preserveAspectRatio="xMidYMid meet"/>
</svg>`
  fs.writeFileSync(logoSvg, svgContent, 'utf8')
  console.log('Successfully updated public/logo.svg with self-contained data URI')
} else {
  console.error('public/og-image.png not found!')
}
