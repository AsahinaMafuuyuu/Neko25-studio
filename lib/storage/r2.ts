import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3"
import { createHash, createHmac } from "node:crypto"

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

export function getR2PublicObjectUrl(logicalBucket: string, key: string) {
  const config = getR2Config()
  return toPublicUrl(config.publicBaseUrl, toObjectKey(logicalBucket, key))
}

export async function createPresignedR2Upload(
  logicalBucket: string,
  key: string,
  options: {
    contentType: string
    expiresInSeconds?: number
  }
) {
  const config = getR2Config()
  const objectKey = toObjectKey(logicalBucket, key)
  const contentType = normalizeHeaderValue(options.contentType || "application/octet-stream")
  const expiresInSeconds = Math.min(Math.max(options.expiresInSeconds || 600, 60), 3600)
  const host = `${config.accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${encodePathSegments(config.bucket)}/${encodePathSegments(objectKey)}`
  const now = new Date()
  const amzDate = formatAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const signedHeaders = "content-type;host"
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  }
  const canonicalQuery = toCanonicalQueryString(query)
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")
  const signature = hmacHex(getSigningKey(config.secretAccessKey, dateStamp), stringToSign)
  const uploadUrl = `https://${host}${canonicalUri}?${toCanonicalQueryString({
    ...query,
    "X-Amz-Signature": signature,
  })}`

  return {
    key,
    url: toPublicUrl(config.publicBaseUrl, objectKey),
    uploadUrl,
    headers: {
      "Content-Type": contentType,
    },
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
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

export async function headR2Object(logicalBucket: string, key: string) {
  try {
    const config = getR2Config()
    const result = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: toObjectKey(logicalBucket, key),
      })
    )

    return {
      data: {
        key,
        url: getR2PublicObjectUrl(logicalBucket, key),
        contentType: result.ContentType || "",
        size: result.ContentLength || 0,
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

function normalizeHeaderValue(value: string) {
  return value.replace(/[\r\n]/g, "").trim() || "application/octet-stream"
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodePathSegments(value: string) {
  return value.split("/").map(encodeRfc3986).join("/")
}

function toCanonicalQueryString(values: Record<string, string>) {
  return Object.keys(values)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(values[key])}`)
    .join("&")
}

function formatAmzDate(date: Date) {
  return date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest()
}

function hmacHex(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex")
}

function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, "auto")
  const serviceKey = hmac(regionKey, "s3")
  return hmac(serviceKey, "aws4_request")
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
