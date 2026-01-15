/**
 * File Text Extraction Library
 *
 * Extracts plain text from uploaded documents for LLM context injection.
 * Supports: txt, docx, xlsx, pptx
 */

import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import PptxParser from 'node-pptx-parser'

const MAX_TEXT_SIZE = 500 * 1024 // 500KB limit for extracted text
const TRUNCATION_MESSAGE = '\n\n[注：文件内容已截断，如需完整内容请分段询问]'

/**
 * Supported file types for text extraction
 */
export const SUPPORTED_FILE_TYPES = {
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

/**
 * Get MIME type from file extension (fallback for browser upload)
 */
export function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'txt':
      return SUPPORTED_FILE_TYPES.txt
    case 'docx':
      return SUPPORTED_FILE_TYPES.docx
    case 'xlsx':
      return SUPPORTED_FILE_TYPES.xlsx
    case 'pptx':
      return SUPPORTED_FILE_TYPES.pptx
    default:
      return 'application/octet-stream'
  }
}

/**
 * Extract text from a file buffer based on mime type
 */
export async function extractText(
  file: Buffer | ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // Fallback: if mimeType is generic, try to detect from extension
  if (mimeType === 'application/octet-stream') {
    mimeType = getMimeTypeFromExtension(fileName)
  }

  let text: string

  switch (mimeType) {
    case SUPPORTED_FILE_TYPES.txt:
      text = extractFromTxt(file)
      break

    case SUPPORTED_FILE_TYPES.docx:
      text = await extractFromDocx(file)
      break

    case SUPPORTED_FILE_TYPES.xlsx:
      text = extractFromXlsx(file)
      break

    case SUPPORTED_FILE_TYPES.pptx:
      text = await extractFromPptx(file)
      break

    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }

  // Enforce size limit
  if (text.length > MAX_TEXT_SIZE) {
    text = text.substring(0, MAX_TEXT_SIZE) + TRUNCATION_MESSAGE
  }

  return text
}

/**
 * Extract text from plain text file
 */
function extractFromTxt(file: Buffer | ArrayBuffer): string {
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file)
  return buffer.toString('utf-8')
}

/**
 * Extract text from DOCX file using mammoth
 */
async function extractFromDocx(file: Buffer | ArrayBuffer): Promise<string> {
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file)

  const result = await mammoth.extractRawText({ buffer })
  return result.value // Plain text without markdown
}

/**
 * Extract text from XLSX file
 * Format: "Sheet1:\nCell content\n\nSheet2:\nCell content"
 */
function extractFromXlsx(file: Buffer | ArrayBuffer): string {
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const sheets: string[] = []

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const csvText = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false })

    if (csvText.trim()) {
      sheets.push(`${sheetName}:\n${csvText}`)
    }
  })

  return sheets.join('\n\n')
}

/**
 * PPTX
 * Format: "Slide 1:\nContent\n\nSlide 2:\nContent"
 */
async function extractFromPptx(file: Buffer | ArrayBuffer): Promise<string> {
  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file)
  const fs = await import('fs/promises')
  const os = await import('os')
  const path = await import('path')

  // Create temp file
  const tempDir = os.tmpdir()
  const tempFilePath = path.join(tempDir, `temp-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`)

  try {
    // Write buffer to temp file
    await fs.writeFile(tempFilePath, buffer)

    // Parse PPTX
    const parser = new PptxParser(tempFilePath)
    const slides = await parser.extractText()

    // Format output - each slide has a text array
    const formattedSlides = slides
      .map((slide, index) => {
        const slideText = slide.text
          .map((block: string) => block.trim())
          .filter((block: string) => block.length > 0)
          .join('\n')

        return slideText.length > 0 ? `Slide ${index + 1}:\n${slideText}` : ''
      })
      .filter((slideText: string) => slideText.length > 0)

    return formattedSlides.length > 0 ? formattedSlides.join('\n\n') : '[No text content found in presentation]'
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if a mime type is supported (or can be detected from extension)
 */
export function isSupportedFileType(mimeType: string, fileName?: string): boolean {
  // Direct match
  if (Object.values(SUPPORTED_FILE_TYPES).includes(mimeType as any)) {
    return true
  }

  // Fallback: check if extension is supported
  if (mimeType === 'application/octet-stream' && fileName) {
    const detectedMime = getMimeTypeFromExtension(fileName)
    return Object.values(SUPPORTED_FILE_TYPES).includes(detectedMime as any)
  }

  return false
}

/**
 * Get file extension from mime type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const entry = Object.entries(SUPPORTED_FILE_TYPES).find(
    ([, type]) => type === mimeType
  )
  return entry ? entry[0] : ''
}
