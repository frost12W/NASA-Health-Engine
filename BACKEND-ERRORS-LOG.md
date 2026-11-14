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

## 2026-11-14 — Camera preview stalled and the check did not explain the save

- Description: Every camera preview was late and choppy. Starting a face check did not show where the result is stored.
- Impact: The operator could not follow the face, and a finished attempt looked like nothing had been recorded.
- Root cause: The camera was pinned at 30 fps, the capture buffer was left at the driver default, preview images were sent only five times a second, and every frame built a full-frame skin mask. The check lasted 15 seconds and waited for a separate save button.
- Fix: The driver is asked for the fastest rate it grants, the buffer is one frame, landmarks run on a smaller image, and the preview is sent at up to 60 images per second. The check is 30 seconds. A valid or inconclusive result is written to the local SQLite file, and the page shows that path before the check starts. A stopped attempt is not saved.
- Verification: Python tests — 11 passed. Typecheck passed. The health-check page in the browser shows the 30-second steps, keeps Start disabled until a camera is ready, and explains that this browser cannot open a camera.
- Remaining: A live camera was not timed on this computer. The desktop program must be restarted so the new camera loop is loaded.

## 2026-11-14 — Desktop window asked for a local server

- Description: Opening the debug program showed “localhost refused to connect” inside the Health Engine window.
- Impact: The program could not show its interface unless a developer preview server was already running. That cannot be used on a crew computer with no network.
- Root cause: The Tauri package was built without the `custom-protocol` feature. A debug build then loads `http://localhost:1420` instead of the interface packed into the program. The Cargo output directory is not a git branch, so this was not caused by `main` versus `dev`.
- Fix: `custom-protocol` is now the default feature, so a normal build embeds `dist` and does not contact that address.
- Verification: Rebuilt `D:\HealthEngine-build\cargo-target\debug\health-engine.exe`. The Tauri build reported `cargo:dev=false`, and the interface files were packed into the build output.
- Remaining: The text `localhost:1420` remains inside the packed configuration, but that address is compiled out of the startup path. The rebuilt window opened on this computer and showed the crew overview.
