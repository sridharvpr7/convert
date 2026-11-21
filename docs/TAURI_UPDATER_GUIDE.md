# CONVET PULSE — Tauri 2 Desktop Auto-Updater Guide

This guide details how to generate updater signing keys, configure GitHub Secrets, publish new releases on GitHub, and securely deliver automatic updates to Windows desktop users.

---

## 1. Architecture Overview

```
[ Developer ]
     │
     ├── 1. Generate Signing Keypair (Once, stored locally)
     ├── 2. Commit Public Key in tauri.conf.json
     └── 3. Add Private Key to GitHub Repository Secrets
     │
[ Git Tag & Push (e.g. v1.0.1) ]
     │
[ GitHub Actions CI/CD ]
     ├── Build Windows NSIS / MSI installers
     ├── Sign installer binary with Private Key (minisign / ed25519)
     ├── Generate latest.json manifest + signatures
     └── Publish GitHub Release with assets
     │
[ CONVET PULSE Desktop App (User) ]
     ├── 1. On launch / manual check: Fetch https://github.com/sridharvpr7/convert/releases/latest/download/latest.json
     ├── 2. Verify signature against embedded Public Key
     ├── 3. If valid & newer: Prompt user with release notes
     ├── 4. Download chunked update with progress bar
     └── 5. Install silently & relaunch app automatically
```

---

## 2. One-Time Setup: Generate Updater Signing Keys

Tauri uses Minisign (Ed25519) signatures to ensure that no malicious third party can tamper with or forge an update.

Run the following command in your terminal on your development machine:

```bash
npm run tauri signer generate -- -w ~/.tauri/convetpulse.key
```

### What this produces:
1. **Private Key:** Stored locally in `~/.tauri/convetpulse.key` (or `%USERPROFILE%\.tauri\convetpulse.key` on Windows).
   > [!CAUTION]
   > **NEVER commit, upload, or expose your private key.** Keep it secure. Anyone with this key could sign binaries for your application.
2. **Password:** You will be prompted to set a passphrase for your private key.
3. **Public Key:** Printed to your terminal (a single-line base64 string starting with `dW...`).

---

## 3. Configure the Public Key in `tauri.conf.json`

Open `src-tauri/tauri.conf.json` and replace `YOUR_UPDATER_PUBLIC_KEY_HERE` with your generated **public key**:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...",
      "endpoints": [
        "https://github.com/sridharvpr7/convert/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Commit this change to Git. Public keys are completely safe to be public.

---

## 4. Configure GitHub Repository Secrets

Go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following two secrets:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `TAURI_SIGNING_PRIVATE_KEY` | Content of `convetpulse.key` file | The private key used by GitHub Actions to sign release binaries. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase you chose | Passphrase protecting the private key (leave empty if none). |

---

## 5. GitHub Actions Release Workflow

Create a release workflow file at `.github/workflows/release-desktop.yml`:

```yaml
name: Release Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Build and Sign Tauri Desktop App
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'CONVET PULSE ${{ github.ref_name }}'
          releaseBody: 'See changelog for details.'
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

---

## 6. How to Publish a Future Update (Step-by-Step)

When you are ready to ship a new version (e.g., `v1.0.1`):

### Step 1: Bump the version numbers in 3 files
1. `package.json`: `"version": "1.0.1"`
2. `src-tauri/tauri.conf.json`: `"version": "1.0.1"`
3. `src-tauri/Cargo.toml`: `version = "0.1.1"`

### Step 2: Commit and Tag
```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore(release): bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

### Step 3: Automated Release
GitHub Actions will:
1. Build the Windows installer (`.exe` / `.msi`).
2. Sign the binary using `TAURI_SIGNING_PRIVATE_KEY`.
3. Generate `latest.json` containing the download URL, version, and signature.
4. Publish all files to the `v1.0.1` release.

### Step 4: Client Verification
1. Existing desktop users on `v1.0.0` will automatically see the **Update Available** dialog on their next launch.
2. Clicking **Install Update** downloads the delta/installer with live progress, verifies the signature against the embedded `pubkey`, and seamlessly restarts CONVET PULSE into `v1.0.1`.

---

## 7. Safety & Safeguards

- **Zero Web & Mobile Impact:** The updater service (`src/lib/updater.ts`) strictly checks `isDesktop()`. Standard Web browsers and Android APK builds never execute the updater logic.
- **Fail-Safe Startup:** If GitHub is unreachable, the network is offline, or the public key has not yet been configured, the startup check exits silently and never interrupts or crashes the application.
- **Manual Verification:** Users can navigate to **Settings** → **Desktop Updates** and click **Check for Updates** at any time.
