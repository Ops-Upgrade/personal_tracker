"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/routes/paths";
import ProfileForm from "@/components/auth/ProfileForm";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

interface ProfileState {
  userId: string | null;
  name: string | null;
  avatarUrl: string | null;
  loaded: boolean;
}

const INITIAL_STATE: ProfileState = {
  userId: null,
  name: null,
  avatarUrl: null,
  loaded: false,
};

/**
 * Hook that loads user profile data from Supabase auth on mount.
 * Returns current state and a reload function so the caller can
 * refresh after changes (e.g. avatar upload, name update).
 */
function useProfileState() {
  const supabase = createClient();
  const [state, setState] = useState<ProfileState>(INITIAL_STATE);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const fullName = typeof meta?.full_name === "string" ? meta.full_name : null;

    let avatarUrl: string | null = null;
    const ts =
      typeof meta?.avatar_updated_at === "string" ? meta.avatar_updated_at : null;
    if (ts) {
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${user.id}/avatar.jpg`);
      if (data?.publicUrl) {
        avatarUrl = `${data.publicUrl}?t=${encodeURIComponent(ts)}`;
      }
    }

    setState({
      userId: user.id,
      name: fullName,
      avatarUrl,
      loaded: true,
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const fullName = typeof meta?.full_name === "string" ? meta.full_name : null;

      let avatarUrl: string | null = null;
      const ts =
        typeof meta?.avatar_updated_at === "string" ? meta.avatar_updated_at : null;
      if (ts) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(`${user.id}/avatar.jpg`);
        if (data?.publicUrl) {
          avatarUrl = `${data.publicUrl}?t=${encodeURIComponent(ts)}`;
        }
      }

      if (!cancelled) {
        setState({
          userId: user.id,
          name: fullName,
          avatarUrl,
          loaded: true,
        });
      }
    }
    fetchUser();
    return () => { cancelled = true; };
  }, [supabase]);

  return { state, reload: loadUser };
}

export default function ProfilePage() {
  const router = useRouter();
  const { state, reload } = useProfileState();

  /** Refresh both local state and the server layout (so Navbar picks up changes). */
  function handleProfileUpdated() {
    reload();
    router.refresh();
  }

  if (!state.loaded) {
    return (
      <div className="flex justify-center py-16">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="space-y-10">
        {/* Back link */}
        <Link
          href={ROUTES.DASHBOARD}
          className="inline-flex shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back
        </Link>

        {/* Profile section */}
        <section>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your avatar and display name.
          </p>
        </section>

        {state.userId && (
          <ProfileForm
            userId={state.userId}
            currentName={state.name}
            currentAvatarUrl={state.avatarUrl}
            onProfileUpdated={handleProfileUpdated}
          />
        )}

        {/* Divider */}
        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Password section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Change Password
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update your password. This will also re-encrypt your data encryption
              key with the new password.
            </p>
          </div>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
