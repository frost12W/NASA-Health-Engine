# BACKEND-ERRORS-LOG

## 2026-11-14 — Desktop core did not compile

- Description: The first Rust build failed on `rusqlite::backup` and `App::manage`.
- Impact: The desktop core could not be tested.
- Root cause: The backup module is behind the rusqlite `backup` feature. Tauri 2 exposes `manage` through the `Manager` trait, which was not imported.
- Fix: Enabled the `backup` feature and imported `tauri::Manager`.
- Verification: `cargo test --manifest-path src-tauri/Cargo.toml` — 5 passed.
- Remaining: None for this defect.

## 2026-11-14 — System drive filled during the first build

- Description: Compiling on `C:` and installing the vision packages stopped with “no space left on device”.
- Impact: That build did not finish. No application data was lost.
- Root cause: The system drive had almost no free space. Debug output and the vision environment are large.
- Fix: Removed the incomplete `src-tauri/target` directory created by that attempt. Reinstalled the vision environment. Re-ran the Rust tests with the Cargo target directory on `D:\HealthEngine-build\cargo-target`.
- Verification: Python tests — 10 passed. Rust tests — 5 passed.
- Remaining: A default `npm run tauri dev` still writes build files under the project on `C:`. On this computer, set `CARGO_TARGET_DIR` to another drive before building.
