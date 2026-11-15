use serde::Deserialize;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct UpdateReport {
    pub online: bool,
    pub current_version: String,
    pub remote_version: Option<String>,
    pub downloaded_path: Option<String>,
    pub message: String,
}

#[derive(Deserialize)]
struct Feed {
    version: String,
    url: String,
}

pub fn feed_address() -> String {
    if let Ok(value) = std::env::var("HEALTH_ENGINE_UPDATE_FEED") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let file = crate::db::default_data_dir().join("update-feed.url");
    fs::read_to_string(file).ok().map(|text| text.trim().to_string()).filter(|text| !text.is_empty()).unwrap_or_default()
}

pub fn check_and_download(feed_url: &str, destination_dir: &Path) -> UpdateReport {
    if !network_reachable() {
        return UpdateReport {
            online: false,
            current_version: CURRENT_VERSION.to_string(),
            remote_version: None,
            downloaded_path: None,
            message: "No network connection. The update was not downloaded.".to_string(),
        };
    }
    match fetch_newer(feed_url, destination_dir, CURRENT_VERSION) {
        Ok(report) => report,
        Err(error) => UpdateReport {
            online: true,
            current_version: CURRENT_VERSION.to_string(),
            remote_version: None,
            downloaded_path: None,
            message: error,
        },
    }
}

pub fn network_reachable() -> bool {
    probe("1.1.1.1:443") || probe("8.8.8.8:443")
}

pub fn fetch_newer(feed_url: &str, destination_dir: &Path, current_version: &str) -> Result<UpdateReport, String> {
    if feed_url.trim().is_empty() {
        return Ok(UpdateReport {
            online: true,
            current_version: current_version.to_string(),
            remote_version: None,
            downloaded_path: None,
            message: "Network is available. No update address is published yet, so nothing was downloaded.".to_string(),
        });
    }
    let manifest = http_get(feed_url)?;
    let feed: Feed = serde_json::from_slice(&manifest).map_err(|_| "The update list was not readable.".to_string())?;
    if !is_newer(&feed.version, current_version) {
        return Ok(UpdateReport {
            online: true,
            current_version: current_version.to_string(),
            remote_version: Some(feed.version.clone()),
            downloaded_path: None,
            message: format!("Network is available. This computer already has version {current_version}."),
        });
    }
    if feed.url.trim().is_empty() {
        return Err(format!("Version {} is listed, but it has no download address.", feed.version));
    }
    let package = http_get(feed.url.trim())?;
    if package.len() < 2 || &package[..2] != b"MZ" {
        return Err("The downloaded update is not a Windows program.".to_string());
    }
    fs::create_dir_all(destination_dir).map_err(|error| format!("The update folder was not created: {error}"))?;
    let path = destination_dir.join(format!("HealthEngine-{}.exe", feed.version));
    fs::write(&path, &package).map_err(|error| format!("The update was not saved: {error}"))?;
    Ok(UpdateReport {
        online: true,
        current_version: current_version.to_string(),
        remote_version: Some(feed.version.clone()),
        downloaded_path: Some(path.display().to_string()),
        message: format!("Network is available. Version {} was downloaded. It was not started.", feed.version),
    })
}

pub fn is_newer(remote: &str, current: &str) -> bool {
    let remote_parts = version_parts(remote);
    let current_parts = version_parts(current);
    let length = remote_parts.len().max(current_parts.len());
    for index in 0..length {
        let left = remote_parts.get(index).copied().unwrap_or(0);
        let right = current_parts.get(index).copied().unwrap_or(0);
        if left != right {
            return left > right;
        }
    }
    false
}

fn version_parts(value: &str) -> Vec<u64> {
    value.split('.').map(|part| part.chars().take_while(|char| char.is_ascii_digit()).collect::<String>().parse().unwrap_or(0)).collect()
}

fn probe(address: &str) -> bool {
    let Some(socket) = address.to_socket_addrs().ok().and_then(|mut items| items.next()) else {
        return false;
    };
    TcpStream::connect_timeout(&socket, Duration::from_secs(3)).is_ok()
}

pub fn http_get(url: &str) -> Result<Vec<u8>, String> {
    let rest = url.strip_prefix("http://").ok_or_else(|| "The update address must start with http://.".to_string())?;
    let (host_port, path) = rest.split_once('/').map(|(host, path)| (host, format!("/{path}"))).unwrap_or((rest, "/".to_string()));
    let (host, port) = host_port.split_once(':').map(|(host, port)| (host, port.parse::<u16>().unwrap_or(80))).unwrap_or((host_port, 80));
    let socket = (host, port).to_socket_addrs().map_err(|_| format!("The update address {host} did not resolve."))?.next().ok_or_else(|| format!("The update address {host} has no network address."))?;
    let mut stream = TcpStream::connect_timeout(&socket, Duration::from_secs(5)).map_err(|_| format!("The update address {host} did not answer."))?;
    stream.set_read_timeout(Some(Duration::from_secs(20))).ok();
    let request = format!("GET {path} HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).map_err(|_| "The update request was not sent.".to_string())?;
    let mut buffer = Vec::new();
    stream.read_to_end(&mut buffer).map_err(|_| "The update answer was interrupted.".to_string())?;
    let header_end = buffer.windows(4).position(|mark| mark == b"\r\n\r\n").ok_or_else(|| "The update answer had no header.".to_string())?;
    let header = String::from_utf8_lossy(&buffer[..header_end]);
    let status = header.lines().next().unwrap_or("");
    if !status.contains(" 200 ") {
        return Err(format!("The update address answered {status}."));
    }
    Ok(buffer[header_end + 4..].to_vec())
}

pub fn update_directory() -> PathBuf {
    crate::db::default_data_dir().join("updates")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn a_newer_version_is_detected_and_the_same_version_is_not() {
        assert!(is_newer("0.2.0", "0.1.0"));
        assert!(!is_newer("0.1.0", "0.1.0"));
        assert!(!is_newer("0.1.0", "0.1.1"));
    }

    #[test]
    fn an_empty_address_does_not_download() {
        let report = fetch_newer("", &std::env::temp_dir(), "0.1.0").unwrap();
        assert!(report.online);
        assert!(report.downloaded_path.is_none());
        assert!(report.message.contains("No update address"));
    }

    #[test]
    fn a_published_newer_program_is_downloaded() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let feed = format!(r#"{{"version":"0.2.0","url":"http://127.0.0.1:{port}/package.exe"}}"#);
        thread::spawn(move || {
            for _ in 0..2 {
                let Ok((mut stream, _)) = listener.accept() else { break };
                let mut request = [0_u8; 1024];
                let _ = stream.read(&mut request);
                let text = String::from_utf8_lossy(&request);
                let body = if text.contains("GET /package.exe") { b"MZ-update".to_vec() } else { feed.as_bytes().to_vec() };
                let header = format!("HTTP/1.0 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                let _ = stream.write_all(header.as_bytes());
                let _ = stream.write_all(&body);
            }
        });
        let folder = std::env::temp_dir().join(format!("he-update-{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        let report = fetch_newer(&format!("http://127.0.0.1:{port}/feed.json"), &folder, "0.1.0").unwrap();
        assert_eq!(report.remote_version.as_deref(), Some("0.2.0"));
        let saved = report.downloaded_path.expect("downloaded path");
        assert_eq!(fs::read(saved).unwrap(), b"MZ-update");
        let _ = fs::remove_dir_all(&folder);
    }
}
