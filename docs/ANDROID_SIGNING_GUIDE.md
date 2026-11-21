# CONVET PULSE — Android Release Signing & Distribution Guide

This document describes how to securely generate, configure, and sign release builds of the **CONVET PULSE** Android app.

---

## 1. Security First Principles

1. **Never commit `.keystore` or `.jks` files** to version control. They are strictly ignored by `.gitignore`.
2. **Never commit keystore passwords** or aliases in code.
3. **Never distribute `*-unsigned.apk`**: Unsigned or test-signed APKs trigger harsh OS security blocks and cannot be reliably updated.
4. **Use GitHub Actions Secrets** to store base64-encoded keystores and passwords in CI/CD.

---

## 2. Generating a Production Keystore (One-Time Setup)

On your local machine (Windows PowerShell or terminal with JDK installed):

```bash
keytool -genkeypair -v \
  -keystore convetpulse-release.keystore \
  -alias convetpulse-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype JKS
```

*Note: Save your keystore password and key alias in a secure password manager.*

---

## 3. Configuring CI/CD Secrets in GitHub

To enable automated release builds via GitHub Actions:

1. Base64-encode your keystore:
   - **PowerShell (Windows):**
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("convetpulse-release.keystore")) | Out-File -Encoding ascii keystore_base64.txt
     ```
   - **Bash (Linux/macOS):**
     ```bash
     base64 -w 0 convetpulse-release.keystore > keystore_base64.txt
     ```

2. Go to your GitHub repository:
   **Settings > Secrets and variables > Actions > New repository secret**

3. Add the following secrets:
   | Secret Name | Description |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | The entire base64 string from `keystore_base64.txt` |
   | `ANDROID_KEYSTORE_PASSWORD` | The keystore password set during `keytool` |
   | `ANDROID_KEY_ALIAS` | `convetpulse-key` (or your chosen alias) |
   | `ANDROID_KEY_PASSWORD` | The key password (often same as keystore password) |

---

## 4. Building Signed APK Locally (Optional)

If you want to build and sign an APK on your development workstation:

```powershell
# Set environment variables
$env:ANDROID_KEYSTORE_PATH = "C:\path\to\convetpulse-release.keystore"
$env:ANDROID_KEYSTORE_PASSWORD = "YourStorePassword"
$env:ANDROID_KEY_ALIAS = "convetpulse-key"
$env:ANDROID_KEY_PASSWORD = "YourKeyPassword"

# Build signed APK
npm run tauri android build -- --apk
```

The output signed APK will be generated at:
`src-tauri/gen/android/app/build/outputs/apk/release/app-universal-release.apk`

---

## 5. Verifying APK Signature

To ensure the APK is properly signed and ready for public installation:

```bash
apksigner verify --verbose src-tauri/gen/android/app/build/outputs/apk/release/app-universal-release.apk
```

Expected output:
```
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

---

## 6. How Releases are Triggered

When you push a git tag prefixed with `v` (e.g. `git tag v1.0.0 && git push origin v1.0.0`):
1. GitHub Actions initiates `CONVET PULSE Cross-Platform Release`.
2. Windows desktop NSIS installer is compiled and uploaded to the release.
3. The Android APK is compiled, cryptographically signed, verified, and uploaded to the same release.
4. The Download Center (`/download`) automatically discovers and displays the new version and assets via the GitHub Releases API.
