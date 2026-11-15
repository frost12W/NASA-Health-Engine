use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let payload = env::var("HEALTH_ENGINE_PAYLOAD").unwrap_or_else(|_| {
        r"D:\HealthEngine-build\cargo-target\debug\health-engine.exe".to_string()
    });
    println!("cargo:rerun-if-env-changed=HEALTH_ENGINE_PAYLOAD");
    println!("cargo:rerun-if-changed={payload}");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let packed = out_dir.join("health-engine.exe");
    fs::copy(&payload, &packed).unwrap_or_else(|error| {
        panic!("Health Engine executable was not found at {payload}: {error}");
    });

    let logo = manifest_dir.join("../src/assets/health-engine-logo.png");
    println!("cargo:rerun-if-changed={}", logo.display());
    let icon_path = out_dir.join("health-engine.ico");
    if logo.exists() {
        if let Ok(picture) = image::open(&logo) {
            let square = picture.resize(64, 64, image::imageops::FilterType::Lanczos3);
            let _ = square.save(&icon_path);
        }
    }
    if icon_path.exists() {
        let mut resource = winresource::WindowsResource::new();
        resource.set_icon(icon_path.to_str().unwrap_or("health-engine.ico"));
        resource.set("ProductName", "Health Engine Setup");
        resource.set("FileDescription", "Health Engine Setup");
        resource.set("CompanyName", "Health Engine");
        if let Err(error) = resource.compile() {
            println!("cargo:warning=The installer icon was not embedded: {error}");
        }
    }
}
