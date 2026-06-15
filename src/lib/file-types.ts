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
] as const;

export const ALLOWED_FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.join(",");

export const ALLOWED_FILE_LABELS =
  "PDF, DWG, XLSX, CSV, DOC, DOCX, MSG, PNG, JPG, MP4";

export function isAllowedFileType(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getFileTypeLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext;
}
