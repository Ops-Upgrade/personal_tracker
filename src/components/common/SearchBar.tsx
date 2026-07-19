"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Applied to the outer wrapper (e.g. for width, margins). */
  className?: string;
  /** Applied to the <input> element (e.g. for compact padding in dropdowns). */
  inputClassName?: string;
}

/**
 * Shared search input with a Search icon on the left and a conditional
 * clear (×) button on the right when `value` is non-empty.
 *
 * Extracted from DiscoverView and reused across the Media, Education,
 * and Medical domains to eliminate duplicated search-bar boilerplate.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  autoFocus = false,
  className = "",
  inputClassName = "",
}: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
