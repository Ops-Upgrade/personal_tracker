# Multi-Subdomain Auth & Session Architecture

This document outlines the authentication and session management architecture for the Ops-Upgrade ecosystem, spanning multiple subdomains (e.g., `personal.ops-upgrade.net`, `ops-upgrade.net`).

## 1. Core Principles
- **Single Source of Login:** All authentication (login) happens exclusively on `personal.ops-upgrade.net`.
- **Shared Session State:** Once authenticated, the session is valid across all `*.ops-upgrade.net` subdomains.
- **Crypto Isolation:** The `personal_tracker` domain has a unique client-side encryption layer (DEK/KEK) that is entirely decoupled from the shared session layer. Other subdomains do not need to know about or implement this crypto layer.
- **Multi-Device Support:** Users can log in from multiple devices simultaneously. Signing out of one device will *never* log out the others.

---

## 2. Persistent Sessions & Cross-Subdomain Auth

Supabase `@supabase/ssr` uses cookies to persist sessions instead of `localStorage`. To make a session visible across subdomains, we configure the cookie's `domain` attribute.

### How it works:
1. User visits `personal.ops-upgrade.net/login` and submits their credentials.
2. The Supabase server responds with a session token.
3. Our Next.js server (via `@supabase/ssr`) sets the `sb-*` auth cookies with `Domain=.ops-upgrade.net`. 
4. The browser stores these cookies and automatically attaches them to any future requests made to `ops-upgrade.net`, `personal.ops-upgrade.net`, or `any-other.ops-upgrade.net`.

### Architecture Diagram

```text
+-------------------------------------------------------------------------------+
|                                USER'S BROWSER                                 |
|  [User]                                       [Cookie Store]                  |
|                                         (Domain: .ops-upgrade.net)            |
+-------------------------------------------------------------------------------+
      |                                                ^                   ^
      | 1. Visits                                      |                   |
      v                                                | 9. Sets Cookies   | 10. Attaches
+-------------------------+                            |                   |     Cookies
| ops-upgrade.net         |                            |                   |
|  [Public Landing]       |                            |                   v
|  2. Renders Login tile  |                            |        +-----------------------+
|  3. Clicks Login link   |                            |        | ops-upgrade.net       |
+-------------------------+                            |        |  [Next.js Proxy]      |
      |                                                |        +-----------+-----------+
      | 4. Navigates                                   |                    |
      v                                                |                    | 11. Validates
+-------------------------+                            |                    |     Session
| personal.ops-upgrade    |                            |                    |     (getClaims)
|  [/login Route]         |                            |                    |
|  5. Submits Credentials |                            |                    |
|  6. signInWithPassword()|------------------+         |                    |
|  7. bootstrapCrypto()   |                  |         |                    |
|     (Derives DEK/KEK)   |                  |         |                    |
|  8. createServerClient()|------------------|---------+                    |
|     (via auth-core)     |                  |                              |
+-------------------------+                  |                              |
      ^                                      |                              |
      | 13. Redirects to                     v                              v
      |     /logout                +--------------------------------------------+
      | 14. Executes clearDEK()    |              SUPABASE SERVER               |
      | 15. Calls coreSignOut()    |  [Auth API]                                |
      |     (Deletes cookies)      |   - Validates against [auth.sessions] DB   |
      | 16. Redirects back         |   - Returns JWT to personal.ops-upgrade    |
+-----|-------------------+        +--------------------------------------------+
| ops-upgrade.net         |
|                         |
|  12. User clicks Logout |
+-------------------------+
```

---

## 3. Session Management & `user_devices`

Supabase does not expose an application-level API to query active sessions (like IP addresses or device names) because the internal `auth.sessions` table is subject to change.

To provide a "Settings -> Sessions" page where you can view and remotely revoke devices, we build a custom projection table:

### The `public.user_devices` Table
Written to dynamically. Each time a user logs in (or refreshes their token via the proxy), we upsert a row based on the JWT's `session_id`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `session_id` | `uuid` (PK) | Extracted from the JWT session ID claim |
| `user_id` | `uuid` (FK) | The authenticated user |
| `device_label` | `text` | Parsed from the request `User-Agent` (e.g., "Chrome on Windows") |
| `last_active` | `timestamptz` | Updated on every request/refresh |

### Remotely Revoking a Session
If a user wants to log out their "Work Laptop" from their "Phone":
1. The user clicks "Sign Out" next to the Work Laptop row on the Sessions page.
2. We call a custom Postgres function: `revoke_session(session_id)`.
3. The function runs as `SECURITY DEFINER` (bypassing RLS internally). It verifies that `auth.uid() == user_devices.user_id` for the target session.
4. If authorized, it deletes the session from the internal `auth.sessions` table. Supabase automatically cascades this deletion to the refresh tokens.
5. The next time the Work Laptop tries to load a page, the token refresh fails, and the middleware clears its cookies.

---

## 4. Preventing Cross-Device Logouts (The Scope Fix)

By default, calling `supabase.auth.signOut()` uses a `global` scope. This tells Supabase to terminate *every* refresh token associated with that user ID, killing all sessions on all devices.

### What `scope: 'local'` Means for Devices and Subdomains

To solve the cross-device logout bug, we explicitly use `scope: 'local'`. Here is exactly how this behaves in our shared-cookie SSR architecture:

1. **One Refresh Token = One Device:** When you log in, Supabase issues a specific refresh token for that session. Passing `scope: 'local'` instructs the Supabase backend to destroy *only* that specific refresh token. If you sign out on your laptop, your phone remains securely logged in.
2. **Shared Cookie Fate:** Because we configure the auth cookies with `Domain=.ops-upgrade.net`, your browser treats this as a single, shared credential for the entire domain tree. It does not keep a separate cookie for `ops-upgrade.net` vs `personal.ops-upgrade.net`.
3. **The Subdomain Consequence:** When you click "Sign Out" on `ops-upgrade.net`, the `@supabase/ssr` proxy must delete that shared `.ops-upgrade.net` cookie from your browser to finalize the local sign-out. **Because they share the exact same cookie, signing out of one subdomain inherently logs you out of ALL subdomains on that specific browser/device.** 

The shared `@ops-upgrade/auth-core` package will enforce this exact behavior universally by exposing a single, strict sign-out function:

```typescript
// @ops-upgrade/auth-core/src/auth.ts
export async function coreSignOut() {
  const supabase = createClient(); // From the shared clients.ts
  
  await supabase.auth.signOut({ scope: 'local' });
}
```

### The SSO Logout Lifecycle (Centralized Cleanup)

Because `personal_tracker` requires wiping the DEK from IndexedDB (which is strictly bound to its origin by the Same-Origin Policy), we use the **SSO Logout Redirect** pattern. This guarantees that no matter where the user clicks "Sign Out", the crypto payload is securely destroyed.

```text
                                [User clicks "Sign Out"]
                                           |
                                           v
                                     (Which App?)
                                           |
                +--------------------------+--------------------------+
                |                                                     |
                v                                                     v
      +-------------------+                                 +-------------------+
      |  ops-upgrade.net  |                                 | personal_tracker  |
      +-------------------+                                 +-------------------+
                |                                                     |
                | 1. Redirects to                                     |
                |    personal.ops-upgrade.net/logout                  |
                |                                                     |
                +------------------------>+                           |
                                          |                           |
                                          v                           v
                                  +-------------------------------------------+
                                  |     personal.ops-upgrade.net/logout       |
                                  |                                           |
                                  |  2. [clearDEK()] wipes IndexedDB          |
                                  |  3. [clear media caches]                  |
                                  |  4. [Call coreSignOut()] via auth-core    |
                                  |  5. [supabase.auth.signOut({scope:'local'})]
                                  |  6. [Removes shared sb-* cookies]         |
                                  +-------------------------------------------+
                                          |                           |
                +-------------------------+                           |
                | 7a. Redirects back to                               | 7b. Redirects to
                v     ops-upgrade.net                                 v     /login
      +-------------------+                                 +-------------------+
      |  ops-upgrade.net  |                                 | personal_tracker  |
      |  (Logged out UI)  |                                 |  (Login Screen)   |
      +-------------------+                                 +-------------------+
```

---

## 5. Summary of the Shared Package (`@ops-upgrade/auth-core`)

To enforce this architecture without copy-paste errors, the shared package will strictly contain:

1. **`cookies.ts`**: The single source of truth for `.ops-upgrade.net` configuration.
2. **`clients.ts`**: The factory functions (`createBrowserClient`, `createServerClient`, `createProxyClient`) so both apps securely set cookies exactly the same way.
3. **`auth.ts`**: The `coreSignOut()` function.
4. **`session.ts`**: A `getSessionForRequest()` helper for the `proxy.ts` middleware to deduplicate token validation logic.
5. **`Navbar.tsx`**: A purely presentational component that accepts an `onLogout` prop, allowing `personal_tracker` to inject its DEK teardown, and `ops-upgrade` to just sign out.

**Crucially, `login()` and `bootstrapCrypto()` stay inside `personal_tracker`.** They are not shared, preserving the strict isolation of the vault's security model.

---

## 6. Execution Roadmap

To safely roll out this architecture without breaking the existing production environments, we will follow this step-by-step sequential plan:

### Phase 1: Foundation (Package Creation)
1. **Scaffold `@ops-upgrade/auth-core`:** Create the new package directory locally (e.g., `e:\Projects\auth-core`).
2. **Initialize Dependencies:** Install `@supabase/supabase-js` and `@supabase/ssr` (locking both to the latest stable versions) inside the package.
3. **Build the Core Modules:** Implement `cookies.ts` (with `.ops-upgrade.net` domain), `clients.ts` (the 3 SSR factories), `session.ts` (the proxy middleware helper), and `auth.ts` (`coreSignOut` locked to local scope).

### Phase 2: GitHub Packages Setup & Publishing
To maintain strict security and avoid embedding credentials in source control, we will use **GitHub Packages** (free for private org repos).
1. **Setup Bot Account:** Create a dedicated bot GitHub account. Add it to your GitHub Organization with access to the `auth-core` repo. 
2. **Generate Tokens (Least Privilege):** Generate **two** classic Personal Access Tokens (PATs) from the bot account:
   - **Token A (`write:packages`, `read:packages`):** Used strictly locally to publish packages.
   - **Token B (`read:packages` only):** Used strictly in Vercel to install packages, limiting the blast radius if exposed.
3. **Publish Package:** In the `auth-core` `package.json`, set the name to `@<your-org-name>/auth-core` and add a `publishConfig` block pointing to `https://npm.pkg.github.com`. Authenticate locally with Token A and run `npm publish` to push version `1.0.0`.

### Phase 3: Local Authentication & Refactoring
Instead of linking local files, we will consume the real published package on localhost to verify the package distribution pipeline.
1. **Local `.npmrc` Setup:** Create an `.npmrc` file in both `personal_tracker` and `ops-upgrade` configured to pull `@<your-org-name>` packages from `npm.pkg.github.com`, authenticated via an environment variable.
2. **Install Remote Package:** Install the real published package in both apps: `npm install @<your-org-name>/auth-core@latest`.
3. **Refactor `ops-upgrade`:** 
   - Delete its local `src/lib/supabase` directory entirely.
   - Update its `proxy.ts` to use the shared `getSessionForRequest()`.
   - Update the public `Navbar` so clicking Logout redirects the user to `https://personal.ops-upgrade.net/logout?redirect=ops-upgrade.net`.
4. **Refactor `personal_tracker`:**
   - Delete its local Supabase factories and update `proxy.ts`.
   - Build the dedicated `/logout` route that executes `clearDEK()` locally, calls the shared `coreSignOut()`, and explicitly reads the `?redirect=` query parameter to route the user back to the originating app (e.g., `ops-upgrade.net`), preventing them from being stranded.

### Phase 4: Validation (Localhost Testing)
1. Boot up both Next.js development servers simultaneously on localhost.
2. Verify that logging into the personal tracker correctly sets the wildcard cookie.
3. Verify that navigating to the ops-upgrade local server detects the cookie and validates the session instantly.
4. Execute the SSO Logout flow from the ops-upgrade local server to confirm it correctly bounces through the personal tracker's cleanup route and successfully redirects back.
5. **Cross-Device Isolation Test (Bug #2 Fix):** Log into `personal.ops-upgrade.net` on two separate devices (e.g., laptop and phone). Click "Sign Out" on the laptop. Verify that the laptop's session is destroyed and its DEK cleared, but the phone's session remains perfectly active.

### Phase 5: Deployment (Production Rollout)
1. **Vercel Auth:** In Vercel, add an `NPM_TOKEN` environment variable to both the `personal_tracker` and `ops-upgrade` projects, containing the bot's **read-only Token B**. Vercel automatically uses this to securely generate a temporary `.npmrc` file during build.
2. **Deploy:** Push the refactored code to production. Vercel will securely pull the private package from GitHub Packages without exposing any credentials.

### Phase 6: Active Session Management (Follow-up)
With the foundation solid and cross-device logout fixed, we will implement the "Settings -> Sessions" feature (Bug #1).
1. Scaffold the `public.user_devices` table and the `SECURITY DEFINER` Postgres function (`revoke_session`). **Crucially, lock the table down with strict RLS policies:** restrict SELECT/INSERT/UPDATE to `auth.uid() = user_id`, and explicitly omit a DELETE policy (deletion only happens via the `revoke_session` function's cascade).
2. Update the shared `session.ts` proxy middleware in `@ops-upgrade/auth-core` to passively upsert active sessions into this table (tracking `User-Agent` and `last_active`). **Debounce this write:** only perform the upsert if the existing `last_active` timestamp is more than 5 minutes old to prevent unnecessary database load on every page navigation.
3. Build the UI in `personal_tracker` to query and display these sessions, allowing the user to click "Sign Out" on remote devices to trigger the `revoke_session` function.
