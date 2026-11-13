// DESKTOP COMMANDS EXPOSED TO THE LOCAL INTERFACE.
use crate::clock;
use crate::db::{self, MissionConfig};
use crate::worker::Worker;
use chrono::Utc;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub worker: Mutex<Option<Worker>>,
    pub worker_error: Mutex<Option<String>>,
}

fn db(state: &AppState) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
    state.db.lock().map_err(|_| "The local database lock failed.".to_string())
}

fn worker(state: &AppState) -> Result<std::sync::MutexGuard<'_, Option<Worker>>, String> {
    state.worker.lock().map_err(|_| "The vision worker lock failed.".to_string())
}

#[derive(Serialize)]
pub struct StorageStatus {
    pub data_dir: String,
    pub database_path: String,
    pub data_bytes: u64,
    pub free_bytes: Option<u64>,
    pub low_space: bool,
    pub warning: Option<String>,
}

#[tauri::command]
pub fn mission_clock(state: State<AppState>) -> Result<clock::MissionClock, String> {
    let conn = db(&state)?;
    let config = db::load_config(&conn)?;
    let (epoch, start, end) = db::clock_parts(&config)?;
    Ok(clock::describe(Utc::now(), epoch, start, end))
}

#[tauri::command]
pub fn app_info(state: State<AppState>) -> Result<Value, String> {
    let root = db::default_data_dir();
    let error = state
        .worker_error
        .lock()
        .ok()
        .and_then(|slot| slot.clone());
    Ok(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "data_dir": root,
        "database_path": root.join("database").join("health_engine.sqlite"),
        "offline": true,
        "ground_endpoint_configured": false,
        "accounts_enabled": false,
        "worker_error": error,
    }))
}

#[tauri::command]
pub fn get_mission_config(state: State<AppState>) -> Result<MissionConfig, String> {
    let conn = db(&state)?;
    db::load_config(&conn)
}

#[tauri::command]
pub fn set_mission_config(
    state: State<AppState>,
    mission_epoch_utc: String,
    circadian_start: String,
    circadian_end: String,
    export_format: String,
) -> Result<(), String> {
    let conn = db(&state)?;
    db::set_config(&conn, &mission_epoch_utc, &circadian_start, &circadian_end, &export_format)
}

#[tauri::command]
pub fn storage_status(state: State<AppState>) -> Result<StorageStatus, String> {
    let conn = db(&state)?;
    let config = db::load_config(&conn)?;
    let root = db::default_data_dir();
    let free = db::free_bytes(&root);
    let low = free.is_some_and(|bytes| bytes < config.low_space_bytes as u64);
    db::sync_storage_alert(&conn, low)?;
    let warning = if low {
        Some("Free disk space is below the configured warning level. Health records are not deleted.".to_string())
    } else if free.is_none() {
        Some("Free disk space could not be read.".to_string())
    } else {
        None
    };
    Ok(StorageStatus {
        data_dir: root.display().to_string(),
        database_path: root.join("database").join("health_engine.sqlite").display().to_string(),
        data_bytes: db::directory_size(&root),
        free_bytes: free,
        low_space: low,
        warning,
    })
}

#[tauri::command]
pub fn create_backup(state: State<AppState>) -> Result<String, String> {
    let conn = db(&state)?;
    db::backup_database(&conn, &db::default_data_dir())
}

#[tauri::command]
pub fn write_month_snapshot(state: State<AppState>) -> Result<String, String> {
    let conn = db(&state)?;
    db::write_month_snapshot(&conn, &db::default_data_dir(), Utc::now())
}

#[tauri::command]
pub fn export_records(state: State<AppState>, astronaut_id: String) -> Result<String, String> {
    let conn = db(&state)?;
    let format_name = db::load_config(&conn)?.export_format;
    db::export_records(&conn, &db::default_data_dir(), &astronaut_id, &format_name)
}

#[tauri::command]
pub fn list_astronauts(state: State<AppState>) -> Result<Vec<db::Astronaut>, String> {
    let conn = db(&state)?;
    db::list_astronauts(&conn)
}

#[tauri::command]
pub fn create_astronaut(
    state: State<AppState>,
    crew_identifier: String,
    display_name: String,
    role: String,
) -> Result<String, String> {
    let conn = db(&state)?;
    db::create_astronaut(&conn, &crew_identifier, &display_name, &role)
}

#[tauri::command]
pub fn home_cards(state: State<AppState>) -> Result<Vec<db::HomeCard>, String> {
    let conn = db(&state)?;
    db::home_cards(&conn, Utc::now())
}

#[tauri::command]
pub fn list_tasks(state: State<AppState>) -> Result<Vec<db::TaskView>, String> {
    let conn = db(&state)?;
    db::list_tasks(&conn, Utc::now())
}

#[tauri::command]
pub fn list_metrics(state: State<AppState>, astronaut_id: String) -> Result<Value, String> {
    let conn = db(&state)?;
    db::list_metrics(&conn, &astronaut_id).map(Value::Array)
}

#[tauri::command]
pub fn list_journal(state: State<AppState>, astronaut_id: String) -> Result<Value, String> {
    let conn = db(&state)?;
    db::list_journal(&conn, &astronaut_id).map(Value::Array)
}

#[tauri::command]
pub fn journal_catalog() -> Value {
    Value::Array(
        db::SYMPTOMS
            .iter()
            .map(|(id, label)| json!({ "id": id, "label": label }))
            .collect(),
    )
}

#[tauri::command]
pub fn add_journal_entry(
    state: State<AppState>,
    astronaut_id: String,
    entry_type: String,
    value: String,
) -> Result<String, String> {
    let conn = db(&state)?;
    db::add_journal_entry(&conn, &astronaut_id, &entry_type, &value)
}

#[tauri::command]
pub fn add_manual_entries(
    state: State<AppState>,
    astronaut_id: String,
    systolic: String,
    diastolic: String,
    temperature: String,
) -> Result<usize, String> {
    let conn = db(&state)?;
    db::add_manual_entries(&conn, &astronaut_id, &systolic, &diastolic, &temperature)
}

#[tauri::command]
pub fn sync_status(state: State<AppState>) -> Result<Value, String> {
    let conn = db(&state)?;
    Ok(json!({
        "ground_endpoint_configured": false,
        "last_acknowledged_at": Value::Null,
        "local_only_count": db::local_only_count(&conn)?,
        "note": "No ground link is configured. Records stay on this computer and are not marked synchronized."
    }))
}

#[tauri::command]
pub fn list_alerts(state: State<AppState>) -> Result<Value, String> {
    let conn = db(&state)?;
    db::list_alerts(&conn).map(Value::Array)
}

#[tauri::command]
pub fn acknowledge_alert(state: State<AppState>, alert_id: String) -> Result<(), String> {
    let conn = db(&state)?;
    db::acknowledge_alert(&conn, &alert_id)
}

#[tauri::command]
pub fn worker_status(state: State<AppState>) -> Result<Value, String> {
    let guard = worker(&state)?;
    let Some(active) = guard.as_ref() else {
        let message = state.worker_error.lock().ok().and_then(|slot| slot.clone());
        return Ok(json!({
            "running": false,
            "error": message.unwrap_or_else(|| "The vision worker is not running.".to_string())
        }));
    };
    match active.request("health", json!({}), Duration::from_secs(5)) {
        Ok(health) => Ok(json!({ "running": true, "health": health })),
        Err(error) => Ok(json!({ "running": false, "error": error })),
    }
}

#[tauri::command]
pub fn list_cameras(state: State<AppState>) -> Result<Value, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let response = active.request("list_cameras", json!({}), Duration::from_secs(20))?;
    command_payload(response)
}

#[tauri::command]
pub fn open_camera(state: State<AppState>, device_index: u32) -> Result<Value, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let response = active.request("open_camera", json!({ "device_index": device_index }), Duration::from_secs(12))?;
    command_payload(response)
}

#[tauri::command]
pub fn close_camera(state: State<AppState>) -> Result<Value, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let response = active.request("close_camera", json!({}), Duration::from_secs(8))?;
    command_payload(response)
}

#[tauri::command]
pub fn start_measurement(state: State<AppState>, astronaut_id: String) -> Result<Value, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let response = active.request(
        "start_measurement",
        json!({
            "session_id": session_id,
            "astronaut_id": astronaut_id,
            "duration_seconds": 15
        }),
        Duration::from_secs(8),
    )?;
    command_payload(response)
}

#[tauri::command]
pub fn stop_measurement(state: State<AppState>) -> Result<Value, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let response = active.request("stop_measurement", json!({}), Duration::from_secs(8))?;
    command_payload(response)
}

#[tauri::command]
pub fn save_last_result(state: State<AppState>, astronaut_id: String) -> Result<String, String> {
    let guard = worker(&state)?;
    let active = guard.as_ref().ok_or_else(|| worker_missing(&state))?;
    let payload = active.unsaved_result(&astronaut_id)?;
    let session_id = payload.get("session_id").and_then(Value::as_str).unwrap_or("").to_string();
    let conn = db(&state)?;
    let metric_id = db::save_face_result(&conn, &payload)?;
    active.mark_saved(&session_id);
    Ok(metric_id)
}

fn worker_missing(state: &AppState) -> String {
    state
        .worker_error
        .lock()
        .ok()
        .and_then(|slot| slot.clone())
        .unwrap_or_else(|| "The vision worker is not running.".to_string())
}

fn command_payload(response: Value) -> Result<Value, String> {
    if response.get("ok").and_then(Value::as_bool) == Some(true) {
        Ok(response.get("payload").cloned().unwrap_or_else(|| json!({})))
    } else {
        Err(response
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("The vision worker rejected the command.")
            .to_string())
    }
}
