import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3"

type StorageObject = {
  name?: string
  key?: string
  size?: number
  bytes?: number
  contentLength?: number
  metadata?: {
    size?: number
    contentLength?: number
  }
}

let client: S3Client | null = null

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function getR2Config() {
  const accountId = normalizeAccountId(readRequiredEnv("CLOUDFLARE_R2_ACCOUNT_ID"))
  return {
    accountId,
    bucket: readRequiredEnv("CLOUDFLARE_R2_BUCKET"),
    accessKeyId: readRequiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: readRequiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: readRequiredEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  }
}

function normalizeAccountId(value: string) {
  try {
    return new URL(value).hostname.split(".")[0]
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/\.r2\.cloudflarestorage\.com\/?$/i, "")
      .replace(/\/+$/, "")
  }
}

function getR2Client() {
  if (client) return client

  const config = getR2Config()
  client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return client
}

export function createR2StorageAdapter() {
  return {
    from(logicalBucket: string) {
      return {
        upload: (key: string, body: Blob | Buffer | Uint8Array | string) => uploadR2Object(logicalBucket, key, body),
        remove: (key: string) => removeR2Object(logicalBucket, key),
        list: (options: { prefix?: string; limit?: number; offset?: number } = {}) =>
          listR2Objects(logicalBucket, options.prefix || "", options.limit),
      }
    },
  }
}

export async function uploadR2Object(logicalBucket: string, key: string, body: Blob | Buffer | Uint8Array | string) {
  try {
    const config = getR2Config()
    const objectKey = toObjectKey(logicalBucket, key)
    const normalizedBody = await toBody(body)
    const contentType = body instanceof Blob ? body.type || undefined : undefined

    await getR2Client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: normalizedBody,
        ContentType: contentType,
      })
    )

    return {
      data: {
        key,
        url: toPublicUrl(config.publicBaseUrl, objectKey),
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

export async function removeR2Object(logicalBucket: string, key: string) {
  try {
    const config = getR2Config()
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: toObjectKey(logicalBucket, key),
      })
    )

    return { data: null, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function listR2Objects(logicalBucket: string, prefix = "", limit = 1000) {
  try {
    const config = getR2Config()
    const objectPrefix = toObjectKey(logicalBucket, prefix)
    const objects: StorageObject[] = []
    let continuationToken: string | undefined

    do {
      const result = await getR2Client().send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: objectPrefix,
          MaxKeys: Math.min(Math.max(limit, 1), 1000),
          ContinuationToken: continuationToken,
        })
      )
      objects.push(...(result.Contents || []).map((object) => toStorageObject(logicalBucket, object)))
      continuationToken = result.NextContinuationToken
    } while (continuationToken && objects.length < limit)

    return { data: { objects: objects.slice(0, limit) }, error: null }
  } catch (error) {
    return { data: { objects: [] }, error }
  }
}

function toObjectKey(logicalBucket: string, key: string) {
  return `${logicalBucket.replace(/^\/+|\/+$/g, "")}/${key.replace(/^\/+/g, "")}`
}

function toPublicUrl(publicBaseUrl: string, objectKey: string) {
  return `${publicBaseUrl}/${objectKey.split("/").map(encodeURIComponent).join("/")}`
}

async function toBody(body: Blob | Buffer | Uint8Array | string) {
  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer())
  }

  return body
}

function toStorageObject(logicalBucket: string, object: _Object): StorageObject {
  const fullKey = object.Key || ""
  const prefix = `${logicalBucket}/`
  const key = fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey
  const size = object.Size || 0

  return {
    name: key,
    key,
    size,
    bytes: size,
    contentLength: size,
    metadata: {
      size,
      contentLength: size,
    },
  }
}
