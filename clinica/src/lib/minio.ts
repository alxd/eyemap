import * as Minio from "minio";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET || "fundus";
}

/** Client used to sign URLs that browsers hit (public Tailscale Funnel host). */
export function getPublicMinioClient(): Minio.Client {
  const endPoint = requireEnv("MINIO_PUBLIC_ENDPOINT");
  const useSSL = (process.env.MINIO_PUBLIC_USE_SSL || "true") === "true";
  const port = Number(process.env.MINIO_PUBLIC_PORT || (useSSL ? 443 : 80));

  return new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey: requireEnv("MINIO_ACCESS_KEY"),
    secretKey: requireEnv("MINIO_SECRET_KEY"),
    pathStyle: true,
  });
}

/** Client for server-side ops when talking to MinIO over the private network. */
export function getInternalMinioClient(): Minio.Client {
  const endPoint = process.env.MINIO_INTERNAL_ENDPOINT || "127.0.0.1";
  const useSSL = (process.env.MINIO_INTERNAL_USE_SSL || "false") === "true";
  const port = Number(process.env.MINIO_INTERNAL_PORT || 9000);

  return new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey: requireEnv("MINIO_ACCESS_KEY"),
    secretKey: requireEnv("MINIO_SECRET_KEY"),
    pathStyle: true,
  });
}

export async function createPresignedPutUrl(
  objectKey: string,
  expirySeconds = 900,
): Promise<string> {
  const client = getPublicMinioClient();
  return client.presignedPutObject(getMinioBucket(), objectKey, expirySeconds);
}

export async function createPresignedGetUrl(
  objectKey: string,
  expirySeconds = 3600,
): Promise<string> {
  const client = getPublicMinioClient();
  return client.presignedGetObject(getMinioBucket(), objectKey, expirySeconds);
}

/** Localhost GET URL for the GPU worker on the same machine as MinIO. */
export async function createInternalGetUrl(
  objectKey: string,
  expirySeconds = 3600,
): Promise<string> {
  const client = getInternalMinioClient();
  return client.presignedGetObject(getMinioBucket(), objectKey, expirySeconds);
}

export function buildCaseImageKey(
  clinicId: string,
  caseId: string,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `clinics/${clinicId}/cases/${caseId}/${safeName}`;
}
