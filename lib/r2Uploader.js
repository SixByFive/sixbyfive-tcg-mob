// lib/r2Upload.js
//
// ADDED (2026-02-26)
//
// Upload a local file to R2 via a presigned PUT URL.
// You provide a server endpoint that returns:
//   { uploadUrl, publicUrl, key }
//
// Server should also validate content-type/size.

import * as FileSystem from "expo-file-system";

export async function uploadToR2ViaPresign({
  presignEndpoint,
  fileUri,
  contentType = "image/jpeg",
  meta = {},
}) {
  if (!presignEndpoint) throw new Error("missing presignEndpoint");
  if (!fileUri) throw new Error("missing fileUri");

  // 1) Ask backend for presigned URL
  const presignRes = await fetch(presignEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType,
      meta,
    }),
  });

  if (!presignRes.ok) {
    const t = await presignRes.text();
    throw new Error(`presign failed: ${presignRes.status} ${t}`);
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json();
  if (!uploadUrl) throw new Error("presign missing uploadUrl");

  // 2) Upload the file with PUT
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) throw new Error("file not found");

  const upload = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": contentType,
    },
  });

  // Many S3-compatible presigned PUTs return 200/204
  if (!(upload.status === 200 || upload.status === 204)) {
    throw new Error(`upload failed: ${upload.status} ${upload.body || ""}`);
  }

  return { key, publicUrl, uploadUrl };
}
