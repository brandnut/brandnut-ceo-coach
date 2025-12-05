export interface AgentLog {
  id: string;
  conversation_id: string;
  message_id: string;
  task_id: string;
  created_at: number;
  data: any;
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  message_files?: MessageFile[]
  agent_logs?: AgentLog[]
}

export interface Conversation {
  id: string
  name: string
  created_at: number
}

export interface MessageFile {
  id: string
  filename: string
  type: string
  url: string
  size: number
  mime_type: string
  transfer_method: 'local_file' | 'remote_url'
  belongs_to: 'user' | 'assistant'
  upload_file_id: string
}

export interface VisionFile {
  type: string
  transfer_method: 'local_file' | 'remote_url'
  upload_file_id: string
  url: string
}

export interface AttachmentFile {
  uid: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'done' | 'error'
  percent?: number
  uploadedId?: string // Dify返回的文件ID
  url?: string
  originFileObj?: File
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
