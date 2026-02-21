import { S3Client } from "@aws-sdk/client-s3";

const cleanEnvVar = (val: string | undefined) => {
  if (!val) return val;
  // Remove surrounding quotes if present
  return val.trim().replace(/^['"](.*)['"]$/, "$1");
};

const r2Endpoint = cleanEnvVar(process.env.R2_ENDPOINT);
const accessKeyId = cleanEnvVar(process.env.R2_ACCESS_KEY_ID);
const secretAccessKey = cleanEnvVar(process.env.R2_SECRET_ACCESS_KEY);

if (!r2Endpoint || !accessKeyId || !secretAccessKey) {
  console.warn("Cloudflare R2 credentials are not fully configured in environment variables.");
}

export const s3Client = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export const R2_BUCKET_NAME = cleanEnvVar(process.env.R2_BUCKET_NAME);
export const R2_PUBLIC_DOMAIN = cleanEnvVar(process.env.R2_PUBLIC_DOMAIN);
