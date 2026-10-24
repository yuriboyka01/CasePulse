# Antigravity Follow-up: Close the Auth UI Gap

**Project:** CASEPULSE, `E:\\sih`  
**Scope:** Frontend-only follow-up to Phase 2B.  
**Important:** Codex will work on backend write workflows separately. Do not touch database, server authorization, API contract, or repository files in this task.

## Why this follow-up is needed

The Auth.js backend integration now exists in `src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`, but the current `src/components/layout/Navbar.tsx` does not expose a sign-in/sign-out control, and the root layout does not yet provide a session context. A configured OIDC flow therefore lacks an obvious entry/exit point in the app UI.

## Tasks

1. Inspect `src/auth.ts`, `src/app/layout.tsx`, `src/components/layout/Navbar.tsx`, and `package.json`.
2. Preserve the existing pages and visual design.
3. Add a small client-side Auth.js provider component using the existing Auth.js dependencies. Wrap the app's children with `SessionProvider` as appropriate, without moving secrets into client code.
4. Add an accessible AuthControls component integrated into the desktop and mobile navigation:
   - When authenticated: show a short user label (name or email where available) and a Sign out action.
   - When unauthenticated and OIDC is configured: show Sign in and call `signIn('oidc')`.
   - When development demo mode is explicitly enabled: show a clear “Development demo mode” indicator. Do not imply this is real authentication.
   - When OIDC is not configured and demo mode is not enabled: show a neutral “Sign-in not configured” state instead of a dead button.
   - Handle pending/loading/error states accessibly.
5. Determine the OIDC-configured boolean in a server-only module/layout from the required environment variable presence. Pass only that boolean to the client component. Never pass client secrets, issuer tokens, or any other secret into client props or the browser bundle.
6. Keep the app usable on mobile. Provide accessible labels and keyboard navigation.
7. Do not change the authentication policy, trusted actor provider, API routes, backend services, database schema, or role logic.
8. Do not claim the frontend has restricted data simply because a session exists. An authenticated identity may still be unprovisioned and receive 403 from protected APIs.
9. Do not make live login claims without a configured identity provider.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm run build -- --webpack` when no other build is running. Report actual results. Do not start multiple concurrent builds.

## Acceptance criteria

- Sign-in/sign-out controls appear in the right session state.
- Sign-in is only offered when OIDC is configured; development demo mode is clearly distinct.
- No secrets appear in client bundles, props, source, or logs.
- Existing navigation, layout, and case-management screens remain functional.
- Only frontend/auth-presentation files are changed.
- Final report lists files changed and exact checks, and notes that live OIDC remains unverified without real provider credentials.
