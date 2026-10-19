export const ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
  ".dwg",
  ".xlsx",
  ".xls",
  ".csv",
  ".doc",
  ".docx",
  ".msg",
  ".png",
  ".jpg",
  ".jpeg",
  ".mp4",
  ".zip",
  ".rar",
] as const;

export const ALLOWED_FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.join(",");

export const ALLOWED_FILE_LABELS =
  "PDF, DWG, XLSX, CSV, DOC, DOCX, MSG, PNG, JPG, MP4, ZIP, RAR";

/** Supabase ücretsiz katmanının dosya başı sınırı */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function isAllowedFileType(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getFileTypeLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext;
}

/** Tarayıcılar .rar/.msg/.dwg için çoğu zaman boş tür verir; depoya doğru türle yüklensin */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  zip: "application/zip",
  rar: "application/vnd.rar",
  msg: "application/vnd.ms-outlook",
  dwg: "application/acad",
  csv: "text/csv",
};

export function getFileMimeType(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export type FilePreviewKind = "image" | "pdf" | "video";

/** Tarayıcıda önizlenebilen türler; diğerleri (DWG, ZIP, Office…) yalnızca indirilir */
export function getFilePreviewKind(fileName: string, mimeType = ""): FilePreviewKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg"].includes(ext)) return "image";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.startsWith("video/") || ext === "mp4") return "video";
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
