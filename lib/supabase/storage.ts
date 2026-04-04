"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { uid } from "@/lib/utils/uid";
import type { DocItem } from "@/lib/types";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

function inferType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext || "file";
}

export async function uploadAttachment(
  supabase: SupabaseClient,
  file: File,
  entityType: string,
  entityId: string
): Promise<DocItem> {
  const safeName = sanitizeFileName(file.name || "attachment");
  const path = `${entityType}/${entityId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("kin-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("kin-attachments").getPublicUrl(path);

  return {
    id: uid(),
    name: file.name,
    type: inferType(file),
    url: publicUrl,
    path,
  };
}
