export interface VisionFile {
  type: 'document'
  transfer_method: 'local_file'
  upload_file_id: string
  url: string
  name?: string
  size?: number
}

export interface FileEntity {
  id: string
  name: string
  size: number
  progress: number
  uploadedId?: string
  file: File
}

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.md',
  '.csv',
  '.xlsx',
  '.pptx',
  '.ppt',
  '.xls',
]
export const FILE_SIZE_LIMIT = 15 * 1024 * 1024
export const MAX_FILES = 10
