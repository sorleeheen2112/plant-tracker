"use client";

import React, { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { uploadImage, compressImage } from "@/services/supabase";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";

interface ImageUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label?: string;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  value,
  onChange,
  placeholder = "https://images.unsplash.com/...",
  label
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast("Invalid file type. Please select an image.", "error");
      return;
    }

    setUploading(true);
    try {
      // Compress client-side
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: "image/jpeg",
      });

      // Upload image
      const imageUrl = await uploadImage(compressedFile);
      onChange(imageUrl);
      toast(t("common.success") + "!", "success");
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      // Reset input value so same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
          {label}
        </label>
      )}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          {(() => {
            const isBase64 = value.startsWith("data:image/");
            const displayValue = isBase64 
              ? "รูปภาพอัปโหลดแล้ว (Uploaded Image)" 
              : value;
            return (
              <>
                <input
                  type="text"
                  value={displayValue}
                  onChange={(e) => {
                    if (!isBase64) onChange(e.target.value);
                  }}
                  readOnly={isBase64}
                  placeholder={placeholder}
                  className={`w-full p-2.5 pr-20 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 font-medium font-mono text-zinc-700 dark:text-zinc-350 ${
                    isBase64 ? "cursor-default select-none opacity-80" : ""
                  }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                  {value && (
                    <button
                      type="button"
                      onClick={() => onChange("")}
                      className="text-[10px] font-bold text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-1 py-0.5 rounded-md transition-colors cursor-pointer"
                      title="Clear"
                    >
                      Clear
                    </button>
                  )}
                  {value && (
                    <img
                      src={value}
                      alt="preview"
                      className="h-6 w-6 rounded-md object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                </div>
              </>
            );
          })()}
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={uploading}
          className="flex h-10 px-4 items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 disabled:bg-zinc-50 dark:disabled:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <Upload className="h-4 w-4 text-zinc-550 dark:text-zinc-400" />
          )}
          {uploading ? t("common.loading") : t("common.uploadImage")}
        </button>
      </div>
    </div>
  );
};
