"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import BackButton from "@/components/common/BackButton";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ErrorBanner from "@/components/common/ErrorBanner";

// ── Types ──

/** Context passed to renderBody so the domain can use auth-derived values. */
export interface DomainPageContext {
  userId: string | null;
  istDate: string;
  nowYear: number;
  nowMonth: number;
  isLoading: boolean;
  error: string | null;
  refreshData: (uid: string) => Promise<void>;
}

export interface GenericDomainPageProps {
  /** Auth + loading + error context (from the domain's own useAuthBootstrap call). */
  ctx: DomainPageContext;

  /** Page heading. */
  title: string;
  /** Subtitle / description paragraph below the heading. */
  description: string;
  /** Where the BackButton should navigate to. */
  backHref: string;

  /** Renders the main content body. Receives auth context for convenience. */
  renderBody: (ctx: DomainPageContext) => ReactNode;

  // ── Optional slots ──

  /** Modal rendered at the top level (outside the layout shell). */
  modalSlot?: ReactNode;
  /** Stat line rendered below the description (Expense: yearly total, Medical: record count). */
  headerStat?: ReactNode;
  /** Link to the domain's document store page. */
  storeHref?: string;
  /** Label for the store link button. */
  storeLabel?: string;
  /** Icon for the store link button. */
  storeIcon?: ReactNode;
  /** Completed items panel (right column in dual-column layout). */
  completedSlot?: ReactNode;
  /** Miscellaneous slot below completedSlot (Task: NotesBox). */
  miscSlot?: ReactNode;
}

// ── Internal: Store link button ──

function StoreLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}

// ── Component ──

/**
 * Unified page shell for all 4 domain views (Task Manager, Education,
 * Expense, Medical). Handles page header, loading/error display, and
 * layout. The domain view owns useAuthBootstrap and passes the auth
 * context (`ctx`) so it retains direct access to userId etc. for CRUD.
 *
 * Layout rules:
 * - When `completedSlot` is provided → dual-column (2/3 + 1/3 grid).
 * - Otherwise → full-width layout with header stat + store button in the header row.
 */
export default function GenericDomainPage({
  ctx,
  title,
  description,
  backHref,
  renderBody,
  modalSlot,
  headerStat,
  storeHref,
  storeLabel = "Store",
  storeIcon,
  completedSlot,
  miscSlot,
}: GenericDomainPageProps) {
  const { userId, isLoading, error, refreshData } = ctx;
  const isDualColumn = !!completedSlot;

  // ── Dual-column layout (Task Manager, Education) ──

  if (isDualColumn) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col items-start gap-4">
          <BackButton href={backHref} />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          </div>
        </div>

        {/* Body: left (renderBody) + right (store + completed + misc) */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">{renderBody(ctx)}</div>

          <div className="grid gap-4 lg:grid-rows-[auto_auto_1fr] min-w-0">
            {storeHref && (
              <StoreLink
                href={storeHref}
                label={storeLabel}
                icon={storeIcon}
              />
            )}

            {completedSlot}

            {miscSlot}
          </div>
        </section>

        {/* Error */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => userId && refreshData(userId)}
          />
        )}

        {/* Modal */}
        {modalSlot}
      </div>
    );
  }

  // ── Full-width layout (Expense, Medical) ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 w-full">
        <BackButton href={backHref} />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
            {!isLoading && headerStat}
          </div>

          {/* Store link (top-right on desktop) */}
          {!isLoading && storeHref && (
            <div className="w-full md:w-auto md:min-w-[200px] lg:w-1/3">
              <StoreLink
                href={storeHref}
                label={storeLabel}
                icon={storeIcon}
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && <LoadingSpinner />}

      {/* Error */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* Body */}
      {!isLoading && renderBody(ctx)}

      {/* Modal */}
      {modalSlot}
    </div>
  );
}
