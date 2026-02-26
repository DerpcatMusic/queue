import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

type UploadResponse = {
  storageId?: string;
};

export function useProfileImageUpload() {
  const createUploadSession = useMutation(api.users.createMyProfileImageUploadSession);
  const completeUpload = useMutation(api.users.completeMyProfileImageUpload);
  const [isUploading, setIsUploading] = useState(false);

  const pickAndUploadProfileImage = useCallback(async () => {
    if (isUploading) return undefined;
    setIsUploading(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Photo library permission is required.");
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (picked.canceled || !picked.assets[0]) {
        return undefined;
      }

      const asset = picked.assets[0];
      const { uploadUrl, sessionToken } = await createUploadSession({});

      const uploadBody = asset.file
        ? asset.file
        : await fetch(asset.uri).then((response) => response.blob());

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": asset.mimeType ?? "image/jpeg",
        },
        body: uploadBody,
      });
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload selected image.");
      }

      const uploadResult = (await uploadResponse.json()) as UploadResponse;
      if (!uploadResult.storageId) {
        throw new Error("Upload did not return a storage id.");
      }

      const completed = await completeUpload({
        sessionToken,
        storageId: uploadResult.storageId as Id<"_storage">,
      });

      return completed.imageUrl;
    } finally {
      setIsUploading(false);
    }
  }, [completeUpload, createUploadSession, isUploading]);

  return {
    isUploading,
    pickAndUploadProfileImage,
  };
}
