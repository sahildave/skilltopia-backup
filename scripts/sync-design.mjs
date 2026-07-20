#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const designPath = path.join(root, 'docs/design/DESIGN.md')
const cssPaths = [
  path.join(root, 'src/theme-variables.css'),
  path.join(root, 'src/App.css'),
  path.join(root, 'src/quick-pane.css'),
]

const colorBindings = {
  primary: ['root', '--primary'],
  'on-primary': ['root', '--primary-foreground'],
  surface: ['root', '--background'],
  'surface-subtle': ['root', '--secondary'],
  'surface-muted': ['root', '--muted'],
  'on-surface': ['root', '--foreground'],
  'on-surface-muted': ['root', '--muted-foreground'],
  border: ['root', '--border'],
  accent: ['root', '--accent'],
  'on-accent': ['root', '--accent-foreground'],
  error: ['root', '--destructive'],
  'dark-canvas': ['dark', '--background'],
  'dark-surface': ['dark', '--card'],
  'dark-on-surface': ['dark', '--foreground'],
  'dark-border': ['dark', '--border'],
}

function fail(message) {
  console.error(`design ${message}`)
  process.exitCode = 1
}

function readFrontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) throw new Error('DESIGN.md is missing YAML frontmatter')
  return { source: match[1], start: match.index, end: match[0].length }
}

function readCssBlocks(source) {
  const blocks = {}
  const blockPattern = /(^|\n)(:root|\.dark)\s*\{([\s\S]*?)\n\}/g
  for (const match of source.matchAll(blockPattern)) {
    const theme = match[2] === ':root' ? 'root' : 'dark'
    blocks[theme] = `${blocks[theme] ?? ''}\n${match[3]}`
  }
  return blocks
}

function readCssValue(block, name) {
  return block
    ?.match(new RegExp(`^\\s*${escapeRegex(name)}\\s*:\\s*([^;]+);`, 'm'))?.[1]
    ?.trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function oklchToHex(value) {
  const match = value.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/
  )
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return null

  const [L, C, H] = match.slice(1, 4).map(Number)
  const angle = (H * Math.PI) / 180
  const a = C * Math.cos(angle)
  const b = C * Math.sin(angle)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const srgb = linear.map(channel => {
    const clamped = Math.max(0, Math.min(1, channel))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  })
  return `#${srgb
    .map(channel =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`
}

function yamlColorLine(frontmatter, key) {
  return frontmatter.match(
    new RegExp(`^(\\s+${escapeRegex(key)}:)\\s*["']?[^"'\\n]+["']?\\s*$`, 'm')
  )
}

function setYamlColor(frontmatter, key, value) {
  const line = yamlColorLine(frontmatter, key)
  if (!line) return frontmatter
  return frontmatter.replace(line[0], `${line[1]} "${value}"`)
}

function yamlColorValue(line) {
  return line
    ?.split(':')
    .slice(1)
    .join(':')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

function collectChanges(document) {
  const frontmatter = readFrontmatter(document)
  const css = cssPaths.map(file => fs.readFileSync(file, 'utf8')).join('\n')
  const blocks = readCssBlocks(css)
  let nextFrontmatter = frontmatter.source
  const changes = []

  for (const [token, [theme, cssName]] of Object.entries(colorBindings)) {
    const cssValue = readCssValue(blocks[theme], cssName)
    const hex = cssValue ? oklchToHex(cssValue) : null
    if (!hex) continue
    const current = yamlColorLine(nextFrontmatter, token)?.[0]
    if (!current || yamlColorValue(current) === hex) continue
    nextFrontmatter = setYamlColor(nextFrontmatter, token, hex)
    changes.push(`${token}: ${current.trim()} → "${hex}"`)
  }

  return { frontmatter, nextFrontmatter, changes }
}

function writeFrontmatter(document, frontmatter, nextFrontmatter) {
  return `${document.slice(0, frontmatter.start)}---\n${nextFrontmatter}\n---\n${document.slice(frontmatter.start + frontmatter.end)}`
}

function sync({ checkOnly = false } = {}) {
  const document = fs.readFileSync(designPath, 'utf8')
  const result = collectChanges(document)
  if (!result.changes.length) {
    console.log('design: DESIGN.md tokens match the CSS source.')
    return
  }

  console.log(`design: found ${result.changes.length} token change(s)`)
  result.changes.forEach(change => console.log(`  - ${change}`))
  if (checkOnly) {
    fail('check failed; run npm run design:sync')
    return
  }

  fs.writeFileSync(
    designPath,
    writeFrontmatter(document, result.frontmatter, result.nextFrontmatter)
  )
  console.log('design: updated DESIGN.md frontmatter')
  console.log(
    'design: run /sync-design for the semantic prose and component pass'
  )
}

function watch() {
  console.log('design: watching theme and design files; press Ctrl+C to stop')
  let timer
  const onChange = file => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      console.log(`\ndesign: changed ${path.relative(root, file)}`)
      sync()
    }, 250)
  }
  for (const file of [designPath, ...cssPaths])
    fs.watch(file, () => onChange(file))
}

const command = process.argv[2] ?? 'check'
if (command === 'sync') sync()
else if (command === 'check') sync({ checkOnly: true })
else if (command === 'watch') watch()
else {
  console.error('Usage: node scripts/sync-design.mjs <check|sync|watch>')
  process.exitCode = 1
}
