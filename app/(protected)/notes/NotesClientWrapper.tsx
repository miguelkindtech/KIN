"use client";

import NotesClient from "./NotesClient";

interface NotesClientWrapperProps {
  defaultId?: string;
}

export default function NotesClientWrapper({ defaultId }: NotesClientWrapperProps) {
  return <NotesClient defaultId={defaultId} />;
}
