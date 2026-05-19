import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = dirname(__dirname)

const artifactDirs = [
  'dist',
  'unpackage',
  '.hbuilderx',
  '.cache',
  '.temp',
  'tmp',
  'temp',
  'node_modules/.cache'
].map(dir => join(rootDir, dir))

const removed = []
const errors = []

for (const dir of artifactDirs) {
  try {
    rmSync(dir, { recursive: true, force: true })
    removed.push(dir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`${dir}: ${message}`)
  }
}

if (removed.length > 0) {
  console.log(`[clean] removed: ${removed.map(p => p.replace(rootDir, '.')).join(', ')}`)
}

if (errors.length > 0) {
  console.warn(`[clean] warnings:\n  ${errors.join('\n  ')}`)
  process.exit(1)
}


