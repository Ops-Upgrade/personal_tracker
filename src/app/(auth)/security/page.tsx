export const metadata = {
  title: "Security — Ops Upgrade",
  description: "How Ops Upgrade protects your data.",
};

/**
 * Public security page — describes the encryption design at a high level.
 * Neutral transparency: no implementation details or thresholds.
 */
export default function SecurityPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-2xl space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Security
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            How your data is protected at Ops Upgrade.
          </p>
        </header>

        <div className="space-y-6">
          <Section title="Client-side encryption">
            Your notes, tasks, records, and files are encrypted in your browser
            before they leave your device. The server and database only ever
            store encrypted blobs — plaintext never reaches them.
          </Section>

          <Section title="Envelope encryption">
            Each account has a unique data key that protects its content. That
            key is itself wrapped by a key derived from your password, so your
            data key is never stored in a usable form on any server.
          </Section>

          <Section title="Password handling">
            Passwords are used to authenticate you and to derive your
            encryption key. Key derivation uses Argon2id, a memory-hard hashing
            function. Passwords are never stored.
          </Section>

          <Section title="Recovery keys">
            You can generate a recovery key that holds a second wrapped copy of
            your data key. It lets you regain access to your data if you lose
            your password. Keep it somewhere safe — treat it like a password.
          </Section>

          <Section title="Vault">
            The vault area is protected by a separate PIN with its own
            protections.
          </Section>
        </div>

        <footer className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Found a security issue? Please report it privately — see our{" "}
          <a
            href="https://github.com/Ops-Upgrade/personal_tracker"
            className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
            target="_blank"
            rel="noreferrer"
          >
            security policy on GitHub
          </a>
          .
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {children}
      </p>
    </section>
  );
}
