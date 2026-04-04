import NotesClientWrapper from "../NotesClientWrapper";

export default function NoteDetailPage({ params }: { params: { id: string } }) {
  return <NotesClientWrapper defaultId={params.id} />;
}
