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
 * @returns Signed URL with 7-day expiration for LLM access
 */
export async function uploadToOSS(filename: string, buffer: Buffer): Promise<string> {
  const client = createOSSClient()

  // Upload file to OSS
  await client.put(filename, buffer)

  // Generate signed URL with 7-day expiration (604800 seconds)
  // This allows LLM to access the file without making bucket public
  const signedUrl = client.signatureUrl(filename, {
    expires: 604800, // 7 days
  })

  return signedUrl
}
