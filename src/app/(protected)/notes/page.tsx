import NotesView from "@/components/notes/NotesView";

/**
 * Notes domain home page.
 * Standalone canvas editor with Notebook -> Section -> Page hierarchy.
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  return <NotesView initialPageId={params.page} />;
}
