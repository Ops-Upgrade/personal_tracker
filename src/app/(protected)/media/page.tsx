import { Suspense } from "react";
import MediaView from "@/components/media/MediaView";

export const metadata = {
  title: "Media Tracker — Ops Upgrade",
  description: "Track movies and TV shows with personal ratings and collections.",
};

export default function MediaPage() {
  return (
    <Suspense>
      <MediaView />
    </Suspense>
  );
}
