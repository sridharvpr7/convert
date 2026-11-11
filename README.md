# CONVETER

CONVETER is a React + TypeScript + Vite single-page app. File tools run in the browser where supported. Firebase Authentication is used for Google and email/password accounts.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
```

Copy `.env.example` to `.env.local`, fill in the Firebase web app values, then run:

```sh
npm run dev
```

The production build is created in `dist/` with `npm run build`.

## Firebase Authentication setup

1. In Firebase Console, add a Web App to the project and copy its web configuration values.
2. In **Authentication → Sign-in method**, enable **Google** and **Email/Password**.
3. In **Authentication → Settings → Authorized domains**, add the Render site's hostname (without `https://` or a path).
4. Set these values in `.env.local` for local work and as environment variables in the Render Static Site. Render variables must be present during the build, then trigger a fresh deploy.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

The Firebase web configuration is public client configuration. Do not place service-account credentials or private keys in a Vite variable. Firebase Authentication handles password storage and account sessions.

## Deploy to Render

Create a **Static Site** from the GitHub repository:

- Root Directory: blank (the repository root)
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Add a rewrite rule in the Static Site's **Redirects/Rewrites** settings for React Router:

- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

## Current product scope

The tool directory is larger than the set of implemented processors. Tools that need a server, AI provider, or specialized media/OCR engine require those integrations before they can honestly be marked functional. Never treat the client-side UI or local storage as authorization for protected server data.
