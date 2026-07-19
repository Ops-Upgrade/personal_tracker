import CollectionDetailPage from "@/components/media/pages/CollectionDetailPage";

export const metadata = {
  title: "Collection — Media Tracker",
};

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionDetailPage collectionId={id} />;
}
