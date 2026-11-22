import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getR2Client = () =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

export default createEndpoint({
  description: 'Returns a short-lived presigned Cloudflare R2 upload URL',
  authenticated: true,
  inputSchema: z.object({
    filename: z.string(),
    contentType: z.string(),
  }),
  outputSchema: z.object({
    uploadUrl: z.string(),
    publicUrl: z.string(),
    key: z.string(),
  }),
  execute: async ({ input }) => {
    const ext = input.filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `uploads/${globalThis.crypto.randomUUID()}.${ext}`;
    const client = getR2Client();

    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        ContentType: input.contentType || 'application/octet-stream',
      }),
      { expiresIn: 300 }, // 5 minutes
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return { uploadUrl, publicUrl, key };
  },
});
