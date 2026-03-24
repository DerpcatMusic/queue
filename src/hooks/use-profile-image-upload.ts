import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const PROFILE_IMAGE_EDGE_PX = 512;
const PROFILE_IMAGE_COMPRESSION = 0.72;

type ProfileImageUploadPhase = "idle" | "selecting" | "compressing" | "uploading";
export type ProfileImageUploadErrorCode =
  | "picker_unavailable"
  | "permission_denied"
  | "permission_blocked"
  | "compression_unavailable"
  | "upload_unavailable"
  | "upload_failed";

export class ProfileImageUploadError extends Error {
  constructor(
    readonly code: ProfileImageUploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfileImageUploadError";
  }
}

export function isProfileImageUploadError(error: unknown): error is ProfileImageUploadError {
  return error instanceof ProfileImageUploadError;
}

type UploadResponse = {
  storageId?: string;
};

type ImagePickerAsset = {
  uri: string;
  file?: Blob;
  mimeType?: string | null;
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
    aspect: [number, number];
    quality: number;
  }) => Promise<ImagePickerResult>;
};

type SaveFormatValue = "jpeg" | "png" | "webp";

type ImageManipulatorModule = {
  SaveFormat: {
    JPEG: SaveFormatValue;
    PNG: SaveFormatValue;
    WEBP: SaveFormatValue;
  };
  manipulateAsync: (
    uri: string,
    actions: Array<{ resize: { width?: number; height?: number } }>,
    saveOptions?: {
      compress?: number;
      format?: SaveFormatValue;
      base64?: boolean;
    },
  ) => Promise<{ uri: string; width: number; height: number }>;
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

let cachedImagePickerModule: ImagePickerModule | null | undefined;
let cachedImageManipulatorModule: ImageManipulatorModule | null | undefined;
let cachedFileSystemLegacyModule: FileSystemLegacyModule | null | undefined;

function resolveImagePickerModule(): ImagePickerModule | null {
  if (cachedImagePickerModule !== undefined) {
    return cachedImagePickerModule;
  }

  if (Platform.OS === "web") {
    cachedImagePickerModule = null;
    return cachedImagePickerModule;
  }

  try {
    // Resolve at runtime so unsupported native environments don't crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedImagePickerModule = require("expo-image-picker") as ImagePickerModule;
  } catch {
    cachedImagePickerModule = null;
  }

  return cachedImagePickerModule;
}

function resolveImageManipulatorModule(): ImageManipulatorModule | null {
  if (cachedImageManipulatorModule !== undefined) {
    return cachedImageManipulatorModule;
  }

  if (Platform.OS === "web") {
    cachedImageManipulatorModule = null;
    return cachedImageManipulatorModule;
  }

  try {
    // Resolve at runtime so unsupported native environments don't crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedImageManipulatorModule = require("expo-image-manipulator") as ImageManipulatorModule;
  } catch {
    cachedImageManipulatorModule = null;
  }

  return cachedImageManipulatorModule;
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
    // Resolve at runtime so unsupported native environments don't crash this module on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedFileSystemLegacyModule = require("expo-file-system/legacy") as FileSystemLegacyModule;
  } catch {
    cachedFileSystemLegacyModule = null;
  }

  return cachedFileSystemLegacyModule;
}

export function useProfileImageUpload() {
  const { t } = useTranslation();
  const createUploadSession = useMutation(api.users.createMyProfileImageUploadSession);
  const completeUpload = useMutation(api.users.completeMyProfileImageUpload);
  const [uploadPhase, setUploadPhase] = useState<ProfileImageUploadPhase>("idle");
  const isUploading = uploadPhase !== "idle";

  const pickAndUploadProfileImage = useCallback(async () => {
    if (isUploading) return undefined;
    setUploadPhase("selecting");
    try {
      const imagePicker = resolveImagePickerModule();
      if (!imagePicker) {
        throw new ProfileImageUploadError(
          "picker_unavailable",
          t("profile.editor.photoPickerUnavailable"),
        );
      }

      const existingPermission = await imagePicker.getMediaLibraryPermissionsAsync?.();
      if (existingPermission?.granted !== true && existingPermission?.canAskAgain === false) {
        throw new ProfileImageUploadError(
          "permission_blocked",
          t("profile.editor.photoPermissionBlocked"),
        );
      }

      const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new ProfileImageUploadError(
          permission.canAskAgain === false ? "permission_blocked" : "permission_denied",
          t(
            permission.canAskAgain === false
              ? "profile.editor.photoPermissionBlocked"
              : "profile.editor.photoPermissionRequired",
          ),
        );
      }

      const picked = await imagePicker.launchImageLibraryAsync({
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (picked.canceled || !picked.assets[0]) {
        return undefined;
      }

      const asset = picked.assets[0];
      setUploadPhase("compressing");
      const imageManipulator = resolveImageManipulatorModule();
      if (!imageManipulator) {
        throw new ProfileImageUploadError(
          "compression_unavailable",
          t("profile.editor.photoCompressionUnavailable"),
        );
      }

      const processedAsset = await imageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: PROFILE_IMAGE_EDGE_PX, height: PROFILE_IMAGE_EDGE_PX } }],
        {
          compress: PROFILE_IMAGE_COMPRESSION,
          format: imageManipulator.SaveFormat.JPEG,
        },
      );

      setUploadPhase("uploading");
      const { uploadUrl, sessionToken } = await createUploadSession({});
      const fileSystemLegacy = resolveFileSystemLegacyModule();
      if (!fileSystemLegacy) {
        throw new ProfileImageUploadError(
          "upload_unavailable",
          t("profile.editor.photoUploadUnavailable"),
        );
      }

      const uploadResponse = await fileSystemLegacy.uploadAsync(uploadUrl, processedAsset.uri, {
        httpMethod: "POST",
        uploadType: fileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "Content-Type": "image/jpeg",
        },
      });
      if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
        throw new ProfileImageUploadError("upload_failed", t("profile.editor.photoUploadFailed"));
      }

      const uploadResult = JSON.parse(uploadResponse.body) as UploadResponse;
      if (!uploadResult.storageId) {
        throw new ProfileImageUploadError(
          "upload_failed",
          t("profile.editor.photoUploadMissingStorageId"),
        );
      }

      const completed = await completeUpload({
        sessionToken,
        storageId: uploadResult.storageId as Id<"_storage">,
      });

      return completed.imageUrl;
    } finally {
      setUploadPhase("idle");
    }
  }, [completeUpload, createUploadSession, isUploading, t]);

  const uploadStatusLabel =
    uploadPhase === "selecting"
      ? t("profile.editor.choosingPhoto")
      : uploadPhase === "compressing"
        ? t("profile.editor.compressingPhoto")
        : uploadPhase === "uploading"
          ? t("profile.editor.uploadingPhoto")
          : null;

  return {
    isUploading,
    uploadPhase,
    uploadStatusLabel,
    pickAndUploadProfileImage,
  };
}
