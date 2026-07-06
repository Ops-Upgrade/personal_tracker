import { ThemeProvider as WrkszThemeProvider } from "@wrksz/themes/next";

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Server Component wrapper for @wrksz/themes/next ThemeProvider.
 * Wraps the app to provide theme context, enabling light/dark/system switching.
 * Uses "class" attributeStrategy so manual toggles work with Tailwind's dark: prefix.
 */
export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <WrkszThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </WrkszThemeProvider>
  );
}