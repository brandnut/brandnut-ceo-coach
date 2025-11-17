import type { AttachmentFile } from '@/types'

// Helper function to get API URL with basePath
function getApiUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  return `${basePath}${path}`
}

interface UploadOptions {
  file: File
  onProgress: (percent: number) => void
  onSuccess: (response: { id: string }) => void
  onError: (error: Error) => void
}

export const uploadFile = ({ file, onProgress, onSuccess, onError }: UploadOptions) => {
  const formData = new FormData()
  formData.append('file', file)

  const xhr = new XMLHttpRequest()

  // Upload progress
  xhr.upload.onprogress = (e: ProgressEvent) => {
    if (e.lengthComputable) {
      const percent = Math.floor((e.loaded / e.total) * 100)
      onProgress(percent)
    }
  }

  // Upload complete
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          onSuccess(response)
        } catch (e) {
          onError(new Error('Invalid response'))
        }
      } else {
        onError(new Error(`Upload failed: ${xhr.statusText}`))
      }
    }
  }

  // Error handling
  xhr.onerror = () => {
    onError(new Error('Network error'))
  }

  xhr.open('POST', getApiUrl('/api/files/upload'))
  xhr.send(formData)

  // Return abort function
  return () => xhr.abort()
}

export const convertToVisionFiles = (files: AttachmentFile[]) => {
  return files
    .filter(file => file.status === 'done' && file.uploadedId)
    .map(file => ({
      type: 'document',
      transfer_method: 'local_file' as const,
      upload_file_id: file.uploadedId!,
      url: file.url || '',
    }))
}
