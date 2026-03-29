import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type ComplianceDocumentKind = "certificate" | "insurance";
export type ComplianceDocumentSource = "document" | "image";
type ComplianceUploadPhase = "idle" | "selecting" | "uploading";
export type ComplianceDocumentUploadErrorCode =
  | "picker_unavailable"
  | "permission_denied"
  | "permission_blocked"
  | "upload_unavailable"
  | "upload_failed";

export class ComplianceDocumentUploadError extends Error {
  constructor(
    readonly code: ComplianceDocumentUploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ComplianceDocumentUploadError";
  }
}

export function isComplianceDocumentUploadError(
  error: unknown,
): error is ComplianceDocumentUploadError {
  return error instanceof ComplianceDocumentUploadError;
}

type UploadResponse = {
  storageId?: string;
};

type DocumentPickerAsset = {
  uri: string;
  name?: string;
  mimeType?: string | null;
  size?: number | null;
  file?: Blob;
};

type DocumentPickerResult = {
  canceled: boolean;
  assets: DocumentPickerAsset[];
};

type DocumentPickerModule = {
  getDocumentAsync: (options: {
    type?: string | string[];
    multiple?: boolean;
    copyToCacheDirectory?: boolean;
  }) => Promise<DocumentPickerResult>;
};

type ImagePickerAsset = {
  uri: string;
  file?: Blob;
  mimeType?: string | null;
  fileName?: string | null;
};

type ImagePickerResult = {
  canceled: boolean;
  assets: ImagePickerAsset[];
};

type ImagePickerModule = {
  MediaTypeOptions: { Images: string | number };
  getMediaLibraryPermissionsAsync?: () => Promise<{
    granted: boolean;
    canAskAgain?: boolean;
  }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{
    granted: boolean;
    canAskAgain?: boolean;
  }>;
  launchImageLibraryAsync: (options: {
    mediaTypes: string | number;
    allowsEditing: boolean;
    quality: number;
  }) => Promise<ImagePickerResult>;
};

type FileSystemLegacyModule = {
  FileSystemUploadType: {
    BINARY_CONTENT: number;
  };
  uploadAsync: (
    url: string,
    fileUri: string,
    options: {
      httpMethod: "POST";
      uploadType: number;
      headers?: Record<string, string>;
    },
  ) => Promise<{
    status: number;
    body: string;
  }>;
};

let cachedDocumentPickerModule: DocumentPickerModule | null | undefined;
let cachedImagePickerModule: ImagePickerModule | null | undefined;
let cachedFileSystemLegacyModule: FileSystemLegacyModule | null | undefined;

function resolveDocumentPickerModule(): DocumentPickerModule | null {
  if (cachedDocumentPickerModule !== undefined) {
    return cachedDocumentPickerModule;
  }

  try {
    // Resolve at runtime so unsupported environments do not crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedDocumentPickerModule =
      require("expo-document-picker") as DocumentPickerModule;
  } catch {
    cachedDocumentPickerModule = null;
  }

  return cachedDocumentPickerModule;
}

function resolveImagePickerModule(): ImagePickerModule | null {
  if (cachedImagePickerModule !== undefined) {
    return cachedImagePickerModule;
  }

  if (Platform.OS === "web") {
    cachedImagePickerModule = null;
    return cachedImagePickerModule;
  }

  try {
    // Resolve at runtime so unsupported native environments do not crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedImagePickerModule = require("expo-image-picker") as ImagePickerModule;
  } catch {
    cachedImagePickerModule = null;
  }

  return cachedImagePickerModule;
}

function resolveFileSystemLegacyModule(): FileSystemLegacyModule | null {
  if (cachedFileSystemLegacyModule !== undefined) {
    return cachedFileSystemLegacyModule;
  }

  if (Platform.OS === "web") {
    cachedFileSystemLegacyModule = null;
    return cachedFileSystemLegacyModule;
  }

  try {
    // Resolve at runtime so unsupported native environments do not crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedFileSystemLegacyModule =
      require("expo-file-system/legacy") as FileSystemLegacyModule;
  } catch {
    cachedFileSystemLegacyModule = null;
  }

  return cachedFileSystemLegacyModule;
}

function inferMimeType(asset: DocumentPickerAsset) {
  const explicitMimeType = asset.mimeType?.trim();
  if (explicitMimeType) {
    return explicitMimeType;
  }

  const lowerName = asset.name?.toLowerCase() ?? "";
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
    return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".heic")) return "image/heic";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function pickDocumentAsset(t: ReturnType<typeof useTranslation>["t"]) {
  const documentPicker = resolveDocumentPickerModule();
  if (!documentPicker) {
    throw new ComplianceDocumentUploadError(
      "picker_unavailable",
      t("profile.compliance.errors.pickerUnavailable"),
    );
  }

  const picked = await documentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets[0]) {
    return null;
  }

  return picked.assets[0];
}

async function pickImageAsset(t: ReturnType<typeof useTranslation>["t"]) {
  const imagePicker = resolveImagePickerModule();
  if (!imagePicker) {
    throw new ComplianceDocumentUploadError(
      "picker_unavailable",
      t("profile.compliance.errors.pickerUnavailable"),
    );
  }

  const existingPermission =
    await imagePicker.getMediaLibraryPermissionsAsync?.();
  if (
    existingPermission?.granted !== true &&
    existingPermission?.canAskAgain === false
  ) {
    throw new ComplianceDocumentUploadError(
      "permission_blocked",
      t("profile.compliance.errors.photoPermissionBlocked"),
    );
  }

  const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new ComplianceDocumentUploadError(
      permission.canAskAgain === false
        ? "permission_blocked"
        : "permission_denied",
      t(
        permission.canAskAgain === false
          ? "profile.compliance.errors.photoPermissionBlocked"
          : "profile.compliance.errors.photoPermissionRequired",
      ),
    );
  }

  const picked = await imagePicker.launchImageLibraryAsync({
    mediaTypes: imagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });

  if (picked.canceled || !picked.assets[0]) {
    return null;
  }

  const selectedAsset = picked.assets[0];
  return {
    uri: selectedAsset.uri,
    ...(selectedAsset.file ? { file: selectedAsset.file } : {}),
    ...(selectedAsset.mimeType ? { mimeType: selectedAsset.mimeType } : {}),
    ...(selectedAsset.fileName ? { name: selectedAsset.fileName } : {}),
  } satisfies DocumentPickerAsset;
}

async function uploadWebFile(
  uploadUrl: string,
  asset: DocumentPickerAsset,
  contentType: string,
) {
  let body: Blob | undefined = asset.file;

  if (!body) {
    const fileResponse = await fetch(asset.uri);
    if (!fileResponse.ok) {
      throw new Error("Failed to read selected document");
    }
    body = await fileResponse.blob();
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body,
  });
  if (!response.ok) {
    throw new Error("Failed to upload selected document");
  }
  return (await response.json()) as UploadResponse;
}

async function uploadNativeFile(
  uploadUrl: string,
  asset: DocumentPickerAsset,
  contentType: string,
) {
  const fileSystemLegacy = resolveFileSystemLegacyModule();
  if (!fileSystemLegacy) {
    throw new ComplianceDocumentUploadError(
      "upload_unavailable",
      "Native file upload is unavailable in this build.",
    );
  }

  const response = await fileSystemLegacy.uploadAsync(uploadUrl, asset.uri, {
    httpMethod: "POST",
    uploadType: fileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": contentType,
    },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error("Failed to upload selected document");
  }
  return JSON.parse(response.body) as UploadResponse;
}

export function useComplianceDocumentUpload() {
  const { t } = useTranslation();
  const createUploadSession = useMutation(
    api.compliance.createMyComplianceDocumentUploadSession,
  );
  const completeUpload = useMutation(
    api.compliance.completeMyComplianceDocumentUpload,
  );
  const [uploadPhase, setUploadPhase] = useState<ComplianceUploadPhase>("idle");
  const isUploading = uploadPhase !== "idle";

  const pickAndUploadComplianceDocument = useCallback(
    async (args: {
      kind: ComplianceDocumentKind;
      sport?: string;
      source?: ComplianceDocumentSource;
    }) => {
      if (isUploading) {
        return undefined;
      }

      setUploadPhase("selecting");
      try {
        const source = args.source ?? "document";
        const asset =
          source === "image" && Platform.OS !== "web"
            ? await pickImageAsset(t)
            : await pickDocumentAsset(t);
        if (!asset) {
          return undefined;
        }

        const contentType = inferMimeType(asset);

        setUploadPhase("uploading");
        const { uploadUrl, sessionToken } = await createUploadSession({
          kind: args.kind,
          ...(args.kind === "certificate" ? { sport: args.sport } : {}),
        });

        const uploadResult =
          Platform.OS === "web"
            ? await uploadWebFile(uploadUrl, asset, contentType)
            : await uploadNativeFile(uploadUrl, asset, contentType);

        if (!uploadResult.storageId) {
          throw new ComplianceDocumentUploadError(
            "upload_failed",
            t("profile.compliance.errors.uploadFailed"),
          );
        }

        return await completeUpload({
          sessionToken,
          storageId: uploadResult.storageId as Id<"_storage">,
          ...(asset.name ? { fileName: asset.name } : {}),
        });
      } catch (error) {
        if (error instanceof ComplianceDocumentUploadError) {
          throw error;
        }
        throw new ComplianceDocumentUploadError(
          "upload_failed",
          t("profile.compliance.errors.uploadFailed"),
        );
      } finally {
        setUploadPhase("idle");
      }
    },
    [completeUpload, createUploadSession, isUploading, t],
  );

  return {
    isUploading,
    uploadPhase,
    pickAndUploadComplianceDocument,
  };
}
