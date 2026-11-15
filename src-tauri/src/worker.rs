// SUPERVISED PYTHON WORKER FOR CAMERA AND PULSE CHECKS ON THIS COMPUTER.
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

struct CachedResult {
    payload: Value,
    saved: bool,
}

pub struct Worker {
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    pending: Arc<Mutex<HashMap<String, Sender<Value>>>>,
    last_result: Arc<Mutex<Option<CachedResult>>>,
}

impl Worker {
    pub fn spawn(app: AppHandle) -> Result<Self, String> {
        let root = worker_root()?;
        let python = python_executable(&root)?;
        let log_path = crate::db::default_data_dir().join("logs").join("python-worker.log");
        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|error| error.to_string())?;
        let mut command = Command::new(&python);
        command
            .arg("-m")
            .arg("worker")
            .current_dir(&root)
            .env("PYTHONUNBUFFERED", "1")
            .env("PYTHONIOENCODING", "utf-8")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(log_file));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start the vision worker: {error}"))?;
        let stdin = child.stdin.take().ok_or("The vision worker has no command pipe.")?;
        let stdout = child.stdout.take().ok_or("The vision worker has no result pipe.")?;
        let pending = Arc::new(Mutex::new(HashMap::new()));
        let last_result = Arc::new(Mutex::new(None));
        let pending_thread = Arc::clone(&pending);
        let last_thread = Arc::clone(&last_result);
        std::thread::spawn(move || read_worker(stdout, app, pending_thread, last_thread));
        let worker = Self {
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            pending,
            last_result,
        };
        let health = worker.request("health", json!({}), Duration::from_secs(30))?;
        if health.get("ok").and_then(Value::as_bool) != Some(true) {
            let message = health
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("The vision worker failed its health check.");
            return Err(message.to_string());
        }
        if health.pointer("/payload/ready").and_then(Value::as_bool) != Some(true) {
            let message = health
                .pointer("/payload/import_error")
                .and_then(Value::as_str)
                .unwrap_or("The vision runtime is not ready.");
            return Err(message.to_string());
        }
        Ok(worker)
    }

    pub fn request(&self, command: &str, mut extra: Value, timeout: Duration) -> Result<Value, String> {
        if !extra.is_object() {
            extra = json!({});
        }
        let id = Uuid::new_v4().to_string();
        let (sender, receiver) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "The vision worker request lock failed.".to_string())?
            .insert(id.clone(), sender);
        extra["protocol_version"] = json!(1);
        extra["request_id"] = json!(id);
        extra["command"] = json!(command);
        let line = serde_json::to_string(&extra).map_err(|error| error.to_string())?;
        {
            let mut stdin = self
                .stdin
                .lock()
                .map_err(|_| "The vision worker command pipe is locked.".to_string())?;
            stdin.write_all(line.as_bytes()).map_err(|error| error.to_string())?;
            stdin.write_all(b"\n").map_err(|error| error.to_string())?;
            stdin.flush().map_err(|error| error.to_string())?;
        }
        match receiver.recv_timeout(timeout) {
            Ok(value) => Ok(value),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if let Ok(mut pending) = self.pending.lock() {
                    pending.remove(&id);
                }
                Err(format!("The vision worker did not answer {command} in time."))
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => Err("The vision worker stopped.".into()),
        }
    }

    pub fn unsaved_result(&self, astronaut_id: &str) -> Result<Value, String> {
        let slot = self
            .last_result
            .lock()
            .map_err(|_| "The measurement result lock failed.".to_string())?;
        let cached = slot.as_ref().ok_or("There is no measurement result to save.")?;
        if cached.saved {
            return Err("This result is already saved.".into());
        }
        let owner = cached.payload.get("astronaut_id").and_then(Value::as_str).unwrap_or("");
        if owner != astronaut_id {
            return Err("The result belongs to a different crew member.".into());
        }
        let validity = cached.payload.get("validity_status").and_then(Value::as_str).unwrap_or("");
        if validity != "VALID" && validity != "INCONCLUSIVE" {
            return Err("This attempt cannot be saved as a health record.".into());
        }
        Ok(cached.payload.clone())
    }

    pub fn mark_saved(&self, session_id: &str) {
        if let Ok(mut slot) = self.last_result.lock() {
            if let Some(cached) = slot.as_mut() {
                let current = cached.payload.get("session_id").and_then(Value::as_str).unwrap_or("");
                if current == session_id {
                    cached.saved = true;
                }
            }
        }
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn read_worker(
    stdout: impl std::io::Read,
    app: AppHandle,
    pending: Arc<Mutex<HashMap<String, Sender<Value>>>>,
    last_result: Arc<Mutex<Option<CachedResult>>>,
) {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        let Ok(value) = serde_json::from_str::<Value>(&line) else { continue };
        let kind = value.get("type").and_then(Value::as_str).unwrap_or("");
        if kind == "response" {
            if let Some(id) = value.get("request_id").and_then(Value::as_str) {
                if let Ok(mut waiting) = pending.lock() {
                    if let Some(sender) = waiting.remove(id) {
                        let _ = sender.send(value);
                    }
                }
            }
        } else if kind == "event" {
            if value.get("event").and_then(Value::as_str) == Some("result") {
                if let Ok(mut slot) = last_result.lock() {
                    *slot = Some(CachedResult {
                        payload: value.clone(),
                        saved: false,
                    });
                }
            }
            let _ = app.emit("worker-event", value);
        }
    }
}

pub(crate) fn worker_root() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("HEALTH_ENGINE_WORKER_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python-worker");
    if dev.join("worker").join("__main__.py").exists() {
        return Ok(dev);
    }
    Err("The vision worker files were not found beside the application.".into())
}

pub(crate) fn python_executable(root: &Path) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("HEALTH_ENGINE_PYTHON") {
        return Ok(PathBuf::from(path));
    }
    let windows = root.join(".venv").join("Scripts").join("python.exe");
    if windows.exists() {
        return Ok(windows);
    }
    let unix = root.join(".venv").join("bin").join("python");
    if unix.exists() {
        return Ok(unix);
    }
    Err(format!(
        "The bundled Python runtime was not found at {}. Install the local worker environment before measuring.",
        windows.display()
    ))
}
