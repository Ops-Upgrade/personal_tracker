"use client";

import Image from "next/image";
import { User } from "lucide-react";
import StarRating from "@/components/common/StarRating";
import RichTextEditor from "@/components/common/RichTextEditor";

interface ReviewSectionProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  reviewNotes: string;
  onReviewNotesChange: (notes: string) => void;
  userName?: string;
  userAvatarUrl?: string;
  /** Optional callback when the review editor loses focus (used by EpisodePage auto-save). */
  onBlur?: () => void;
}

/**
 * Rating + review form section.
 *
 * Displays the user's avatar, star rating, an optional formatting toolbar
 * (Bold / Italic / Underline / Bullet list), and a textarea for review notes.
 *
 * Extracted from MoviePage and TvSeriesPage.
 */
export default function ReviewSection({
  rating,
  onRatingChange,
  reviewNotes,
  onReviewNotesChange,
  userName,
  userAvatarUrl,
  onBlur,
}: ReviewSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
        RATING AND COMMENTS
      </h3>
      <div className="flex flex-col md:flex-row items-start gap-6">
        {/* Left: Avatar + name + rating */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            {userAvatarUrl ? (
              <Image
                src={userAvatarUrl}
                alt={userName ?? ""}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <User size={20} />
              </span>
            )}
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {userName ?? "You"}:
            </span>
          </div>
          <StarRating value={rating} onChange={onRatingChange} size={22} />
        </div>

        {/* Right: Rich text editor */}
        <div className="flex-1 min-w-0" onBlur={onBlur}>
          <RichTextEditor
            value={reviewNotes}
            onChange={onReviewNotesChange}
            minHeight="8rem"
          />
        </div>
      </div>
    </div>
  );
}
