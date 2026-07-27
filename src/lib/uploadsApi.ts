import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

interface PresignedUrlResponse {
  upload_url: string;
  file_url: string;
  key: string;
}

/**
 * A finalized-upload reference (post presign + PUT) — the exact snake_case
 * shape a `POST /v1/attachments` finalize (or an inline attachment ref on an
 * outbound reply) takes. Shared by every composer that attaches files.
 */
export interface AttachmentUploadRef {
  s3_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

class UploadsApiClient extends BaseApiClient {
  /**
   * Get a presigned URL for uploading a file to S3.
   */
  async getPresignedUrl(
    fileName: string,
    contentType: string,
    sizeBytes: number,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<PresignedUrlResponse> {
    return this.request<PresignedUrlResponse>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify({
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Presign + PUT a blob to S3 — the one place the two-step upload dance
   * lives. Returns the presign response (`{ upload_url, file_url, key }`) so
   * callers can take either the public URL or the object key. Throws on a
   * failed PUT (no silent partial upload).
   */
  private async presignAndPut(
    file: Blob,
    name: string,
    contentType: string,
  ): Promise<PresignedUrlResponse> {
    const presign = await this.getPresignedUrl(name, contentType, file.size);
    const response = await fetch(presign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }
    return presign;
  }

  /**
   * Upload a file/blob to S3 via presigned URL.
   * Returns the public file URL to embed in the document.
   */
  async uploadFile(file: Blob, filename?: string): Promise<string> {
    const name = file instanceof File ? file.name : (filename ?? "upload");
    const { file_url } = await this.presignAndPut(file, name, file.type);
    return file_url;
  }

  /**
   * Presign + PUT a picked file, returning the finalize ref shape a composer
   * binds to a message. Normalizes an empty MIME type to
   * `application/octet-stream` so the finalize always carries a content type.
   */
  async uploadAttachment(file: File): Promise<AttachmentUploadRef> {
    const contentType =
      file.type === "" ? "application/octet-stream" : file.type;
    const presign = await this.presignAndPut(file, file.name, contentType);
    return {
      s3_key: presign.key,
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
    };
  }
}

export const uploadsApi = new UploadsApiClient();
