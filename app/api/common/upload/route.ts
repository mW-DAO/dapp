import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { success, unauthorized, apiError } from "@/lib/api/response";
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "@/lib/s3/client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "common";

    // 校验类型值
    const allowedTypes = ["avatar", "article", "node", "common"];
    if (!allowedTypes.includes(type)) {
      return apiError("Invalid upload type", 400);
    }

    if (!file) {
      return apiError("No file provided", 400);
    }

    // 基础校验
    if (!file.type.startsWith("image/")) {
      return apiError("Only images are allowed", 400);
    }

    if (file.size > 2 * 1024 * 1024) {
      // 2MB
      return apiError("File size too large (max 2MB)", 400);
    }

    // 生成唯一文件名，并根据场景分目录存储
    // 目录结构: {scene}/{timestamp}-{random}.{ext}
    // 例如: avatars/1700000000000-abc123.png
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop() || "png";
    // 映射类型到文件夹名 (复数形式更符合S3习惯)
    const folderMap: Record<string, string> = {
      avatar: "avatars",
      article: "articles",
      node: "nodes",
      common: "uploads",
    };
    const folder = folderMap[type] || "uploads";

    const key = `${folder}/${timestamp}_${randomSuffix}.${extension}`;

    // 如果 R2 已配置，执行真实上传
    if (R2_BUCKET_NAME && R2_PUBLIC_DOMAIN) {
      console.log("[Upload API] Uploading to R2:", key);
      const buffer = Buffer.from(await file.arrayBuffer());

      const uploadParams = {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const baseUrl = R2_PUBLIC_DOMAIN.startsWith("http")
        ? R2_PUBLIC_DOMAIN
        : `https://${R2_PUBLIC_DOMAIN}`;
      const url = `${baseUrl}/${key}`;
      return success({ url, name: file.name, size: file.size }, "Uploaded to R2 successfully");
    }

    return apiError("Storage configuration missing (R2)", 500);
  } catch (err) {
    console.error("[Upload API] Error:", err);
    return apiError("Failed to upload file", 500);
  }
}
