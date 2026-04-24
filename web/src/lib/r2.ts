import { S3Client } from "@aws-sdk/client-s3";

const requiredEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    throw new Error(`missing env var: ${name}`);
  }
  return v;
};

export const BUCKET = process.env.VIGIL_S3_BUCKET ?? "vigil-recordings";

export const r2 = new S3Client({
  region: "auto",
  endpoint: requiredEnv("VIGIL_S3_ENDPOINT"),
  credentials: {
    accessKeyId: requiredEnv("VIGIL_S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("VIGIL_S3_SECRET_ACCESS_KEY"),
  },
});
