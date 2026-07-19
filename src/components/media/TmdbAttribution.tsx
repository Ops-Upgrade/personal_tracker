/**
 * TMDB attribution — required by TMDB Terms of Service.
 * Must be visible on any page that displays TMDB data.
 */
export default function TmdbAttribution() {
  return (
    <footer className="mt-6 border-t border-zinc-200 pt-4 text-center dark:border-zinc-800">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        This product uses the{" "}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          TMDB
        </a>{" "}
        API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
