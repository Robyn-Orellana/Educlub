import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _s3: S3Client | null = null;

function getS3Client() {
  if (_s3) return _s3;
  const region = process.env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION no configurada');
  _s3 = new S3Client({ region });
  return _s3;
}

export async function getPresignedPutUrl(params: { bucket: string; key: string; contentType: string; expiresInSec?: number }) {
  const { bucket, key, contentType, expiresInSec = 600 } = params;
  const s3 = getS3Client();
  const input: PutObjectCommandInput = { Bucket: bucket, Key: key, ContentType: contentType, ACL: 'public-read' };
  const command = new PutObjectCommand(input);
  const url = await getSignedUrl(s3, command, { expiresIn: expiresInSec });
  const publicBase = process.env.S3_PUBLIC_URL_BASE || `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`;
  const publicUrl = `${publicBase}/${encodeURIComponent(key)}`;
  return { url, key, publicUrl };
}
