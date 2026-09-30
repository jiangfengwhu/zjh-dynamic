import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
};

export type UploadedObject = {
  bucket: string;
  key: string;
};

function clientFor(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 1,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableUpload(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { name?: string; Code?: string; $fault?: string; $metadata?: { httpStatusCode?: number } };
  const status = failure.$metadata?.httpStatusCode ?? 0;
  if (status === 429 || status >= 500) return true;
  if (failure.$fault === "server") return true;
  return failure.name === "InternalError" || failure.Code === "InternalError";
}

export async function uploadObject(
  config: R2Config,
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl?: string,
): Promise<UploadedObject> {
  const objectKey = `${config.prefix}/${key}`.replace(/\/+/g, "/").replace(/^\//, "");
  const client = clientFor(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });
  const waits = [1000, 2000, 4000, 8000, 16000];
  let last: unknown;
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    try {
      await client.send(command);
      return { bucket: config.bucket, key: objectKey };
    } catch (error) {
      last = error;
      if (attempt === waits.length || !retryableUpload(error)) throw error;
      const wait = waits[attempt];
      console.log(`r2 upload retry key=${objectKey} attempt=${attempt + 1} wait=${wait}`);
      await sleep(wait);
    }
  }
  throw last;
}
