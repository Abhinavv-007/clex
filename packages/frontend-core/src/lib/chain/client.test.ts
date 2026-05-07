import { describe, expect, it } from 'vitest'

import { fileCategory } from './client'

describe('fileCategory', () => {
  it('falls through to "other" when nothing is known', () => {
    expect(fileCategory('')).toBe('other')
    expect(fileCategory('application/x-totally-fake')).toBe('other')
    expect(fileCategory('application/octet-stream')).toBe('other')
  })

  it('classifies images, video, audio, and font by MIME prefix', () => {
    expect(fileCategory('image/png')).toBe('image')
    expect(fileCategory('image/svg+xml')).toBe('image')
    expect(fileCategory('video/mp4')).toBe('video')
    expect(fileCategory('audio/mpeg')).toBe('audio')
    expect(fileCategory('font/woff2')).toBe('font')
  })

  it('classifies common Office/Open formats by exact MIME', () => {
    expect(fileCategory('application/pdf')).toBe('pdf')
    expect(fileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document')
    expect(fileCategory('application/vnd.ms-excel')).toBe('spreadsheet')
    expect(fileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('spreadsheet')
    expect(fileCategory('application/vnd.ms-powerpoint')).toBe('presentation')
  })

  it('classifies archive MIMEs', () => {
    expect(fileCategory('application/zip')).toBe('archive')
    expect(fileCategory('application/vnd.rar')).toBe('archive')
    expect(fileCategory('application/x-7z-compressed')).toBe('archive')
    expect(fileCategory('application/gzip')).toBe('archive')
  })

  it('classifies APK by MIME and falls back to extension when MIME is generic', () => {
    expect(fileCategory('application/vnd.android.package-archive')).toBe('apk')
    expect(fileCategory('application/octet-stream', 'app-release.apk')).toBe('apk')
    expect(fileCategory('', 'photos.aab')).toBe('apk')
  })

  it('uses extension fallback for code/text/data files', () => {
    expect(fileCategory('application/octet-stream', 'README.md')).toBe('text')
    expect(fileCategory('', 'notes.txt')).toBe('text')
    expect(fileCategory('', 'main.rs')).toBe('code')
    expect(fileCategory('', 'index.tsx')).toBe('code')
    expect(fileCategory('application/json')).toBe('data')
    expect(fileCategory('', 'data.csv')).toBe('spreadsheet')
  })

  it('handles ebook, font, design, and model extensions', () => {
    expect(fileCategory('', 'book.epub')).toBe('ebook')
    expect(fileCategory('', 'font.ttf')).toBe('font')
    expect(fileCategory('', 'cover.psd')).toBe('design')
    expect(fileCategory('', 'model.glb')).toBe('model')
  })

  it('detects executables and ios bundles by extension', () => {
    expect(fileCategory('', 'installer.exe')).toBe('executable')
    expect(fileCategory('', 'app.dmg')).toBe('executable')
    expect(fileCategory('', 'build.ipa')).toBe('ios')
  })

  it('is case-insensitive on extensions and MIME', () => {
    expect(fileCategory('IMAGE/PNG')).toBe('image')
    expect(fileCategory('', 'PHOTO.JPG')).toBe('image')
    expect(fileCategory('application/octet-stream', 'INSTALLER.APK')).toBe('apk')
  })

  it('does not throw on weird filenames', () => {
    expect(fileCategory('', '.hidden')).toBe('other')
    expect(fileCategory('', 'no-extension')).toBe('other')
    expect(fileCategory('', 'trailing.')).toBe('other')
  })
})
