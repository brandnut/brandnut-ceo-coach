/**
 * Aliyun OSS Client
 *
 * Simple wrapper for uploading files to Aliyun Object Storage Service.
 */

import OSS from 'ali-oss'

const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET
const OSS_BUCKET = process.env.OSS_BUCKET
const OSS_REGION = process.env.OSS_REGION

if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET || !OSS_REGION) {
  throw new Error('OSS configuration incomplete. Check OSS_* environment variables.')
}

/**
 * Create OSS client instance
 */
function createOSSClient() {
  return new OSS({
    region: OSS_REGION,
    accessKeyId: OSS_ACCESS_KEY_ID!,
    accessKeySecret: OSS_ACCESS_KEY_SECRET!,
    bucket: OSS_BUCKET!,
  })
}

/**
 * Upload file buffer to OSS
 *
 * @param filename - Destination filename in OSS (e.g., "uploads/123-abc.pdf")
 * @param buffer - File buffer
 * @param mimeType - MIME type of the file
 * @returns Signed URL with 7-day expiration for LLM access
 */
export async function uploadToOSS(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const client = createOSSClient()

  // Upload file to OSS
  await client.put(filename, buffer)

  // For images, apply OSS image processing to compress and ensure under 5MB
  // LLM providers (like Bedrock) have 5MB image limits
  const isImage = mimeType.startsWith('image/')

  if (isImage) {
    // OSS image processing parameters:
    // - resize to max width 2048px (maintains aspect ratio)
    // - convert to JPEG for better compression
    // - quality 80 (good balance between size and quality)
    // This typically reduces images to well under 5MB
    const process = 'image/resize,w_2048,m_lfit/format,jpg/quality,q_80'

    // Generate signed URL with image processing
    const signedUrl = client.signatureUrl(filename, {
      expires: 604800, // 7 days
      process,
    })

    return signedUrl
  } else {
    // For PDFs and other files, return standard signed URL
    const signedUrl = client.signatureUrl(filename, {
      expires: 604800, // 7 days
    })

    return signedUrl
  }
}
