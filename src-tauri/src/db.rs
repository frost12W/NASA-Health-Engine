// LOCAL SQLITE STORE FOR CREW RECORDS ON THIS COMPUTER.
use crate::clock::{self, parse_epoch, parse_hhmm};
use chrono::{DateTime, Duration, NaiveTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const SYMPTOMS: &[(&str, &str)] = &[
    ("headache", "Headache"),
    ("nausea", "Nausea"),
    ("fatigue", "Fatigue"),
    ("insomnia", "Insomnia"),
    ("swelling", "Swelling"),
    ("chest_pain", "Chest pain"),
    ("shortness_of_breath", "Shortness of breath"),
    ("confusion", "Confusion"),
    ("loss_of_consciousness", "Loss of consciousness"),
    ("severe_dizziness", "Severe dizziness"),
];

#[derive(Debug, Clone, Serialize)]
pub struct Astronaut {
    pub astronaut_id: String,
    pub crew_identifier: String,
    pub display_name: String,
    pub role: String,
    pub profile_status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MissionConfig {
    pub mission_epoch_utc: Option<String>,
    pub circadian_start_utc: Option<String>,
    pub circadian_end_utc: Option<String>,
    pub reminder_cadence: String,
    pub export_format: String,
    pub low_space_bytes: i64,
    pub rule_set_version: String,
    pub met_paused: bool,
    pub met_frozen_seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct HomeCard {
    pub astronaut_id: String,
    pub crew_identifier: String,
    pub display_name: String,
    pub role: String,
    pub latest_attempt_at: Option<String>,
    pub latest_attempt_validity: Option<String>,
    pub latest_valid_pulse_bpm: Option<f64>,
    pub latest_valid_pulse_at: Option<String>,
    pub workflow_state: String,
    pub task_display_status: String,
    pub age_years: Option<i64>,
    pub pulse_bpm: Option<f64>,
    pub pulse_source: Option<String>,
    pub respiratory_rate: Option<f64>,
    pub respiratory_source: Option<String>,
    pub sleep_hours: Option<f64>,
    pub sleep_source: Option<String>,
    pub wellbeing: Option<f64>,
    pub wellbeing_source: Option<String>,
    pub last_systolic: Option<f64>,
    pub last_diastolic: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskView {
    pub task_id: String,
    pub astronaut_id: String,
    pub crew_identifier: String,
    pub display_name: String,
    pub task_type: String,
    pub due_at_utc: String,
    pub display_status: String,
    pub completed_at_utc: Option<String>,
}

pub fn utc_now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn default_data_dir() -> PathBuf {
    if let Ok(override_dir) = std::env::var("HEALTH_ENGINE_DATA_DIR") {
        return PathBuf::from(override_dir);
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(local).join("HealthEngine");
    }
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        return PathBuf::from(home).join(".health-engine");
    }
    PathBuf::from("HealthEngine-data")
}

pub fn ensure_layout(root: &Path) -> std::io::Result<()> {
    for name in ["database", "logs", "exports", "backups", "ASTRONAUTS-HEALTH-RESULTS-MONTH"] {
        std::fs::create_dir_all(root.join(name))?;
    }
    Ok(())
}

pub fn open_default() -> Result<Connection, String> {
    let root = default_data_dir();
    ensure_layout(&root).map_err(|error| error.to_string())?;
    open_at(&root.join("database").join("health_engine.sqlite"))
}

pub fn open_at(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| error.to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at_utc TEXT NOT NULL
        );",
    )
    .map_err(|error| error.to_string())?;
    apply_migration(conn, 1, include_str!("../migrations/001_initial.sql"))?;
    apply_migration(conn, 2, include_str!("../migrations/002_profile_and_mission_clock.sql"))?;
    Ok(())
}

fn apply_migration(conn: &Connection, version: i64, sql: &str) -> Result<(), String> {
    let applied: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            [version],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if applied > 0 {
        return Ok(());
    }
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    tx.execute_batch(sql).map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO schema_migrations (version, applied_at_utc) VALUES (?1, ?2)",
        params![version, utc_now()],
    )
    .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn load_config(conn: &Connection) -> Result<MissionConfig, String> {
    conn.query_row(
        "SELECT mission_epoch_utc, circadian_start_utc, circadian_end_utc, reminder_cadence, export_format, low_space_bytes, rule_set_version, met_paused, met_frozen_seconds
         FROM mission_configuration WHERE config_id = 1",
        [],
        |row| {
            let paused: i64 = row.get(7)?;
            Ok(MissionConfig {
                mission_epoch_utc: row.get(0)?,
                circadian_start_utc: row.get(1)?,
                circadian_end_utc: row.get(2)?,
                reminder_cadence: row.get(3)?,
                export_format: row.get(4)?,
                low_space_bytes: row.get(5)?,
                rule_set_version: row.get(6)?,
                met_paused: paused != 0,
                met_frozen_seconds: row.get(8)?,
            })
        },
    )
    .map_err(|error| error.to_string())
}

pub fn clock_parts(config: &MissionConfig) -> Result<(Option<DateTime<Utc>>, Option<NaiveTime>, Option<NaiveTime>), String> {
    let epoch = match config.mission_epoch_utc.as_deref() {
        Some(value) if !value.is_empty() => Some(parse_epoch(value)?),
        _ => None,
    };
    let start = match config.circadian_start_utc.as_deref() {
        Some(value) if !value.is_empty() => Some(parse_hhmm(value)?),
        _ => None,
    };
    let end = match config.circadian_end_utc.as_deref() {
        Some(value) if !value.is_empty() => Some(parse_hhmm(value)?),
        _ => None,
    };
    Ok((epoch, start, end))
}

pub fn set_config(
    conn: &Connection,
    epoch: &str,
    start: &str,
    end: &str,
    export_format: &str,
) -> Result<(), String> {
    let epoch_value = if epoch.trim().is_empty() {
        None
    } else {
        parse_epoch(epoch)?;
        Some(epoch.trim().to_string())
    };
    let start_trim = start.trim();
    let end_trim = end.trim();
    if start_trim.is_empty() != end_trim.is_empty() {
        return Err("Set both circadian times, or leave both empty.".into());
    }
    if !start_trim.is_empty() {
        let parsed_start = parse_hhmm(start_trim)?;
        let parsed_end = parse_hhmm(end_trim)?;
        if parsed_start == parsed_end {
            return Err("The day shift start and end must be different.".into());
        }
    }
    let format_name = export_format.trim().to_uppercase();
    if format_name != "JSON" && format_name != "TXT" {
        return Err("This version can export JSON or TXT. PDF is not available yet.".into());
    }
    conn.execute(
        "UPDATE mission_configuration
         SET mission_epoch_utc = ?1, circadian_start_utc = ?2, circadian_end_utc = ?3,
             export_format = ?4, updated_at_utc = ?5, met_paused = 0, met_frozen_seconds = 0
         WHERE config_id = 1",
        params![
            epoch_value,
            if start_trim.is_empty() { None } else { Some(start_trim) },
            if end_trim.is_empty() { None } else { Some(end_trim) },
            format_name,
            utc_now()
        ],
    )
    .map_err(|error| error.to_string())?;
    audit(conn, "CONFIG_UPDATED", "mission_configuration", "1", "Mission clock or export format was updated.")?;
    Ok(())
}

pub fn create_astronaut(
    conn: &Connection,
    display_name: &str,
    age_years: i64,
    role: &str,
    systolic: f64,
    diastolic: f64,
    pulse: f64,
) -> Result<String, String> {
    let name = display_name.trim();
    if name.is_empty() || name.len() > 80 || !name.chars().any(|ch| ch.is_alphabetic()) {
        return Err("Enter a family name and a given name, up to 80 characters.".into());
    }
    if !(18..=99).contains(&age_years) {
        return Err("Age is whole years from 18 to 99. This is an entry bound, not a health category.".into());
    }
    if !(40.0..=300.0).contains(&systolic) || !(20.0..=200.0).contains(&diastolic) || systolic <= diastolic {
        return Err("Blood pressure needs two numbers inside the entry bounds, with the first number higher.".into());
    }
    if pulse.fract() != 0.0 || !(30.0..=220.0).contains(&pulse) {
        return Err("Pulse is a whole number from 30 to 220 bpm. This is an entry bound, not a health category.".into());
    }
    let stored_role = match role.trim().to_uppercase().as_str() {
        "MEDICAL" => "MEDICAL",
        "ADMIN" => "ADMIN",
        "CREW" => "CREW",
        _ => return Err("Role is CREW, MEDICAL, or ADMIN.".into()),
    };
    let id = Uuid::new_v4().to_string();
    let identifier = next_crew_identifier(conn)?;
    let now = utc_now();
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO astronauts (astronaut_id, crew_identifier, display_name, role, profile_status, age_years, created_at_utc, updated_at_utc)
         VALUES (?1, ?2, ?3, ?4, 'ACTIVE', ?5, ?6, ?6)",
        params![id, identifier, name, stored_role, age_years, now],
    )
    .map_err(|error| error.to_string())?;
    insert_manual_metric(&tx, &id, "BLOOD_PRESSURE_SYSTOLIC", systolic, "mmHg")?;
    insert_manual_metric(&tx, &id, "BLOOD_PRESSURE_DIASTOLIC", diastolic, "mmHg")?;
    insert_manual_metric(&tx, &id, "PULSE_RATE", pulse, "bpm")?;
    audit(&tx, "ASTRONAUT_CREATED", "astronaut", &id, &identifier)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(id)
}

fn next_crew_identifier(conn: &Connection) -> Result<String, String> {
    for _ in 0..8 {
        let token = Uuid::new_v4().simple().to_string();
        let identifier = format!("CREW-{}", token[..4].to_uppercase());
        let taken: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM astronauts WHERE crew_identifier = ?1",
                [&identifier],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if taken == 0 {
            return Ok(identifier);
        }
    }
    Err("A crew identifier could not be assigned.".into())
}

pub fn start_mission(conn: &Connection) -> Result<(), String> {
    let config = load_config(conn)?;
    if config.mission_epoch_utc.as_ref().is_some_and(|value| !value.is_empty()) {
        if config.met_paused {
            return Err("The mission clock is paused. Resume it instead of starting a new one.".into());
        }
        return Err("The mission clock is already running.".into());
    }
    conn.execute(
        "UPDATE mission_configuration
         SET mission_epoch_utc = ?1, met_paused = 0, met_frozen_seconds = 0, updated_at_utc = ?1
         WHERE config_id = 1",
        [utc_now()],
    )
    .map_err(|error| error.to_string())?;
    audit(conn, "MISSION_STARTED", "mission_configuration", "1", "Mission elapsed time started.")?;
    Ok(())
}

pub fn pause_mission(conn: &Connection) -> Result<(), String> {
    let config = load_config(conn)?;
    if config.met_paused {
        return Ok(());
    }
    let (epoch, _, _) = clock_parts(&config)?;
    let epoch = epoch.ok_or_else(|| "Start the mission clock before pausing it.".to_string())?;
    let frozen = Utc::now().signed_duration_since(epoch).num_seconds().max(0);
    conn.execute(
        "UPDATE mission_configuration
         SET met_paused = 1, met_frozen_seconds = ?1, updated_at_utc = ?2
         WHERE config_id = 1",
        params![frozen, utc_now()],
    )
    .map_err(|error| error.to_string())?;
    audit(conn, "MISSION_PAUSED", "mission_configuration", "1", "Mission elapsed time frozen.")?;
    Ok(())
}

pub fn resume_mission(conn: &Connection) -> Result<(), String> {
    let config = load_config(conn)?;
    if !config.met_paused {
        return Err("The mission clock is not paused.".into());
    }
    let resumed = Utc::now() - Duration::seconds(config.met_frozen_seconds.max(0));
    let epoch = resumed.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    conn.execute(
        "UPDATE mission_configuration
         SET mission_epoch_utc = ?1, met_paused = 0, met_frozen_seconds = 0, updated_at_utc = ?2
         WHERE config_id = 1",
        params![epoch, utc_now()],
    )
    .map_err(|error| error.to_string())?;
    audit(conn, "MISSION_RESUMED", "mission_configuration", "1", "Mission elapsed time resumed.")?;
    Ok(())
}

pub fn list_astronauts(conn: &Connection) -> Result<Vec<Astronaut>, String> {
    let mut statement = conn
        .prepare(
            "SELECT astronaut_id, crew_identifier, display_name, role, profile_status
             FROM astronauts WHERE profile_status = 'ACTIVE' ORDER BY crew_identifier",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Astronaut {
                astronaut_id: row.get(0)?,
                crew_identifier: row.get(1)?,
                display_name: row.get(2)?,
                role: row.get(3)?,
                profile_status: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

pub fn ensure_daily_tasks(conn: &Connection, now: DateTime<Utc>) -> Result<(), String> {
    let day = clock::today_utc(now);
    let due = format!("{day}T00:00:00Z");
    let astronauts = list_astronauts(conn)?;
    for astronaut in astronauts {
        let task_id = format!("{}:FACE_HEALTH_CHECK:{day}", astronaut.astronaut_id);
        conn.execute(
            "INSERT OR IGNORE INTO tasks (task_id, astronaut_id, task_type, due_at_utc, status, completed_at_utc, rule_version)
             VALUES (?1, ?2, 'FACE_HEALTH_CHECK', ?3, 'PENDING', NULL, 'reminder-once-per-utc-day-v1')",
            params![task_id, astronaut.astronaut_id, due],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn display_task_status(status: &str, due_at: &str, now: DateTime<Utc>) -> String {
    if status == "COMPLETED" {
        return "COMPLETED".to_string();
    }
    if let Ok(due) = parse_epoch(due_at) {
        if now.date_naive() > due.date_naive() {
            return "OVERDUE".to_string();
        }
    }
    "DUE".to_string()
}

pub fn list_tasks(conn: &Connection, now: DateTime<Utc>) -> Result<Vec<TaskView>, String> {
    ensure_daily_tasks(conn, now)?;
    let mut statement = conn
        .prepare(
            "SELECT t.task_id, t.astronaut_id, a.crew_identifier, a.display_name, t.task_type, t.due_at_utc, t.status, t.completed_at_utc
             FROM tasks t JOIN astronauts a ON a.astronaut_id = t.astronaut_id
             ORDER BY t.due_at_utc DESC, a.crew_identifier",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let status: String = row.get(6)?;
            let due: String = row.get(5)?;
            Ok(TaskView {
                task_id: row.get(0)?,
                astronaut_id: row.get(1)?,
                crew_identifier: row.get(2)?,
                display_name: row.get(3)?,
                task_type: row.get(4)?,
                due_at_utc: due.clone(),
                display_status: display_task_status(&status, &due, now),
                completed_at_utc: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn latest_metric(conn: &Connection, astronaut_id: &str, metric_type: &str) -> Option<(f64, String, String)> {
    conn.query_row(
        "SELECT value, measured_at_utc, source_type FROM metric_records
         WHERE astronaut_id = ?1 AND metric_type = ?2 AND value IS NOT NULL
         ORDER BY measured_at_utc DESC LIMIT 1",
        params![astronaut_id, metric_type],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .ok()
}

fn insert_sample(conn: &Connection, astronaut_id: &str, metric_type: &str, value: f64, unit: &str) -> Result<(), String> {
    let metric_id = Uuid::new_v4().to_string();
    let note = json!({
        "note": "Sample profile value so the home card can show a number. A newer record replaces it.",
        "sample": true
    });
    conn.execute(
        "INSERT INTO metric_records (
            metric_id, session_id, astronaut_id, metric_type, value, unit, source_type, validity_status,
            quality_score, quality_metadata_json, method_name, method_version, measured_at_utc, created_at_utc
         ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, 'SIMULATED', 'VALID', NULL, ?6, 'SAMPLE_PROFILE', 'sample-profile-v1', '2026-01-01T00:00:00Z', ?7)",
        params![metric_id, astronaut_id, metric_type, value, unit, note.to_string(), utc_now()],
    )
    .map_err(|error| error.to_string())?;
    queue_local(conn, "metric_record", &metric_id)?;
    Ok(())
}

fn seed_display_samples(conn: &Connection) -> Result<(), String> {
    for astronaut in list_astronauts(conn)? {
        let index = astronaut.astronaut_id.bytes().fold(0usize, |total, byte| total.wrapping_add(byte as usize)) % 3;
        let rows = [
            ("RESPIRATORY_RATE", [12.0, 15.0, 16.0][index], "breaths/min"),
            ("SLEEP_HOURS", [6.5, 7.2, 8.0][index], "h"),
            ("MOOD_SCORE", [3.0, 4.0, 5.0][index], "1-5"),
        ];
        for (metric_type, value, unit) in rows {
            if latest_metric(conn, &astronaut.astronaut_id, metric_type).is_none() {
                insert_sample(conn, &astronaut.astronaut_id, metric_type, value, unit)?;
            }
        }
        if latest_metric(conn, &astronaut.astronaut_id, "PULSE_RATE").is_none() {
            insert_sample(conn, &astronaut.astronaut_id, "PULSE_RATE", [68.0, 74.0, 81.0][index], "bpm")?;
        }
    }
    Ok(())
}

pub fn home_cards(conn: &Connection, now: DateTime<Utc>) -> Result<Vec<HomeCard>, String> {
    ensure_daily_tasks(conn, now)?;
    seed_display_samples(conn)?;
    let astronauts = list_astronauts(conn)?;
    let mut cards = Vec::new();
    for astronaut in astronauts {
        let latest_valid: Option<(f64, String)> = conn
            .query_row(
                "SELECT value, measured_at_utc FROM metric_records
                 WHERE astronaut_id = ?1 AND metric_type = 'PULSE_RATE' AND source_type = 'CAMERA_DERIVED' AND validity_status = 'VALID'
                 ORDER BY measured_at_utc DESC LIMIT 1",
                [&astronaut.astronaut_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        let latest_attempt: Option<(String, String)> = conn
            .query_row(
                "SELECT validity_status, measured_at_utc FROM metric_records
                 WHERE astronaut_id = ?1 AND metric_type = 'PULSE_RATE' AND source_type = 'CAMERA_DERIVED'
                 ORDER BY measured_at_utc DESC LIMIT 1",
                [&astronaut.astronaut_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        let has_valid_pulse = latest_valid.is_some();
        let age_years: Option<i64> = conn
            .query_row(
                "SELECT age_years FROM astronauts WHERE astronaut_id = ?1",
                [&astronaut.astronaut_id],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        let pulse = latest_metric(conn, &astronaut.astronaut_id, "PULSE_RATE");
        let breath = latest_metric(conn, &astronaut.astronaut_id, "RESPIRATORY_RATE");
        let sleep = latest_metric(conn, &astronaut.astronaut_id, "SLEEP_HOURS");
        let mood = latest_metric(conn, &astronaut.astronaut_id, "MOOD_SCORE");
        let systolic = latest_metric(conn, &astronaut.astronaut_id, "BLOOD_PRESSURE_SYSTOLIC");
        let diastolic = latest_metric(conn, &astronaut.astronaut_id, "BLOOD_PRESSURE_DIASTOLIC");
        let day = clock::today_utc(now);
        let task_status: String = conn
            .query_row(
                "SELECT status, due_at_utc FROM tasks WHERE astronaut_id = ?1 AND task_type = 'FACE_HEALTH_CHECK' AND substr(due_at_utc, 1, 10) = ?2",
                params![astronaut.astronaut_id, day],
                |row| {
                    let status: String = row.get(0)?;
                    let due: String = row.get(1)?;
                    Ok(display_task_status(&status, &due, now))
                },
            )
            .unwrap_or_else(|_| "DUE".to_string());
        cards.push(HomeCard {
            astronaut_id: astronaut.astronaut_id,
            crew_identifier: astronaut.crew_identifier,
            display_name: astronaut.display_name,
            role: astronaut.role,
            latest_attempt_at: latest_attempt.as_ref().map(|item| item.1.clone()),
            latest_attempt_validity: latest_attempt.map(|item| item.0),
            latest_valid_pulse_bpm: latest_valid.as_ref().map(|item| item.0),
            latest_valid_pulse_at: latest_valid.map(|item| item.1),
            workflow_state: if has_valid_pulse {
                "CHECK RECORDED".to_string()
            } else {
                "INSUFFICIENT DATA".to_string()
            },
            task_display_status: task_status,
            age_years,
            pulse_bpm: pulse.as_ref().map(|item| item.0),
            pulse_source: pulse.map(|item| item.2),
            respiratory_rate: breath.as_ref().map(|item| item.0),
            respiratory_source: breath.map(|item| item.2),
            sleep_hours: sleep.as_ref().map(|item| item.0),
            sleep_source: sleep.map(|item| item.2),
            wellbeing: mood.as_ref().map(|item| item.0),
            wellbeing_source: mood.map(|item| item.2),
            last_systolic: systolic.map(|item| item.0),
            last_diastolic: diastolic.map(|item| item.0),
        });
    }
    Ok(cards)
}

pub fn storable_pulse(validity: &str, value: Option<f64>) -> Result<Option<f64>, String> {
    match validity {
        "VALID" => value
            .filter(|item| item.is_finite())
            .map(Some)
            .ok_or_else(|| "A valid pulse result is missing its number.".to_string()),
        "INCONCLUSIVE" => Ok(None),
        _ => Err("This attempt cannot be saved as a health record.".into()),
    }
}

pub fn save_face_result(conn: &Connection, payload: &Value) -> Result<String, String> {
    let astronaut_id = payload
        .get("astronaut_id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let session_id = payload.get("session_id").and_then(Value::as_str).unwrap_or("").to_string();
    if astronaut_id.is_empty() || session_id.is_empty() {
        return Err("The measurement result is missing its session identity.".into());
    }
    let validity = payload.get("validity_status").and_then(Value::as_str).unwrap_or("");
    let raw_value = payload.get("value_bpm").and_then(Value::as_f64);
    let stored_value = storable_pulse(validity, raw_value)?;
    let session_status = if validity == "VALID" { "COMPLETED_VALID" } else { "COMPLETED_INCONCLUSIVE" };
    let capture = payload.get("capture").cloned().unwrap_or_else(|| json!({}));
    let now = utc_now();
    let started = payload
        .get("started_at_utc")
        .and_then(Value::as_str)
        .unwrap_or(&now)
        .to_string();
    let ended = payload.get("ended_at_utc").and_then(Value::as_str).unwrap_or(&now).to_string();
    let metric_id = Uuid::new_v4().to_string();
    let quality = payload.get("quality_components").cloned().unwrap_or_else(|| json!({}));
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO measurement_sessions (
            session_id, astronaut_id, started_at_utc, ended_at_utc, method, session_status,
            camera_device_id, capture_backend, capture_pixel_format, capture_width, capture_height,
            effective_fps, usable_duration_seconds, algorithm_name, algorithm_version, worker_version
         ) VALUES (?1, ?2, ?3, ?4, 'FACE_RPPG', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            session_id,
            astronaut_id,
            started,
            ended,
            session_status,
            capture.get("device_id").and_then(Value::as_str),
            capture.get("backend").and_then(Value::as_str),
            capture.get("pixel_format").and_then(Value::as_str),
            capture.get("width").and_then(Value::as_i64),
            capture.get("height").and_then(Value::as_i64),
            payload.get("effective_fps").and_then(Value::as_f64),
            payload.get("usable_duration_seconds").and_then(Value::as_f64),
            payload.get("algorithm_name").and_then(Value::as_str),
            payload.get("algorithm_version").and_then(Value::as_str),
            payload.get("worker_version").and_then(Value::as_str),
        ],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO metric_records (
            metric_id, session_id, astronaut_id, metric_type, value, unit, source_type, validity_status,
            quality_score, quality_metadata_json, method_name, method_version, measured_at_utc, created_at_utc
         ) VALUES (?1, ?2, ?3, 'PULSE_RATE', ?4, 'bpm', 'CAMERA_DERIVED', ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            metric_id,
            session_id,
            astronaut_id,
            stored_value,
            validity,
            payload.get("quality_score").and_then(Value::as_f64),
            serde_json::to_string(&quality).unwrap_or_else(|_| "{}".to_string()),
            payload.get("algorithm_name").and_then(Value::as_str),
            payload.get("algorithm_version").and_then(Value::as_str),
            ended,
            now,
        ],
    )
    .map_err(|error| error.to_string())?;
    let day = &started[..10.min(started.len())];
    tx.execute(
        "UPDATE tasks SET status = 'COMPLETED', completed_at_utc = ?1
         WHERE astronaut_id = ?2 AND task_type = 'FACE_HEALTH_CHECK' AND status = 'PENDING' AND substr(due_at_utc, 1, 10) = ?3",
        params![now, astronaut_id, day],
    )
    .map_err(|error| error.to_string())?;
    queue_local(&tx, "metric_record", &metric_id)?;
    audit(&tx, "MEASUREMENT_SAVED", "metric_record", &metric_id, validity)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(metric_id)
}

fn queue_local(conn: &Connection, record_type: &str, record_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sync_queue (
            item_id, record_type, record_id, payload_version, created_at_utc, status, retry_count, last_error_code
         ) VALUES (?1, ?2, ?3, 1, ?4, 'LOCAL_ONLY', 0, 'NO_GROUND_ENDPOINT')",
        params![Uuid::new_v4().to_string(), record_type, record_id, utc_now()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn audit(conn: &Connection, event_type: &str, target_type: &str, target_id: &str, details: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO audit_events (event_id, actor_id, event_type, target_type, target_id, timestamp_utc, details_json)
         VALUES (?1, 'LOCAL_OPERATOR', ?2, ?3, ?4, ?5, ?6)",
        params![
            Uuid::new_v4().to_string(),
            event_type,
            target_type,
            target_id,
            utc_now(),
            serde_json::to_string(&json!({ "note": details })).unwrap_or_else(|_| "{}".to_string())
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_metrics(conn: &Connection, astronaut_id: &str) -> Result<Vec<Value>, String> {
    let mut statement = conn
        .prepare(
            "SELECT metric_id, metric_type, value, unit, source_type, validity_status, quality_score, method_name, measured_at_utc
             FROM metric_records WHERE astronaut_id = ?1 ORDER BY measured_at_utc DESC LIMIT 200",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([astronaut_id], |row| {
            Ok(json!({
                "metric_id": row.get::<_, String>(0)?,
                "metric_type": row.get::<_, String>(1)?,
                "value": row.get::<_, Option<f64>>(2)?,
                "unit": row.get::<_, String>(3)?,
                "source_type": row.get::<_, String>(4)?,
                "validity_status": row.get::<_, String>(5)?,
                "quality_score": row.get::<_, Option<f64>>(6)?,
                "method_name": row.get::<_, Option<String>>(7)?,
                "measured_at_utc": row.get::<_, String>(8)?,
            }))
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

pub fn list_journal(conn: &Connection, astronaut_id: &str) -> Result<Vec<Value>, String> {
    let mut statement = conn
        .prepare(
            "SELECT entry_id, entry_type, value, unit_or_scale, source_type, recorded_at_utc
             FROM journal_entries WHERE astronaut_id = ?1 ORDER BY recorded_at_utc DESC LIMIT 200",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([astronaut_id], |row| {
            Ok(json!({
                "entry_id": row.get::<_, String>(0)?,
                "entry_type": row.get::<_, String>(1)?,
                "value": row.get::<_, String>(2)?,
                "unit_or_scale": row.get::<_, Option<String>>(3)?,
                "source_type": row.get::<_, String>(4)?,
                "recorded_at_utc": row.get::<_, String>(5)?,
            }))
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn parse_decimal(text: &str) -> Result<f64, String> {
    let cleaned = text.trim().replace(',', ".");
    cleaned.parse::<f64>().map_err(|_| "Enter a number.".to_string()).and_then(|value| {
        if value.is_finite() {
            Ok(value)
        } else {
            Err("Enter a finite number.".into())
        }
    })
}

pub fn add_journal_entry(conn: &Connection, astronaut_id: &str, entry_type: &str, value: &str) -> Result<String, String> {
    let (stored_value, unit) = match entry_type {
        "SLEEP" => {
            let hours = parse_decimal(value)?;
            if !(0.0..=24.0).contains(&hours) {
                return Err("Sleep hours must be from 0 to 24.".into());
            }
            (format!("{hours:.2}"), "hours")
        }
        "MOOD" => {
            let score = parse_decimal(value)?;
            if score.fract() != 0.0 || !(1.0..=5.0).contains(&score) {
                return Err("Mood is a self-reported whole number from 1 to 5.".into());
            }
            (format!("{}", score as i32), "self-reported 1-5")
        }
        "SYMPTOM" => {
            let id = value.trim();
            if !SYMPTOMS.iter().any(|(key, _)| *key == id) {
                return Err("That symptom is not in the journal list.".into());
            }
            (id.to_string(), "reported")
        }
        _ => return Err("Unsupported journal entry.".into()),
    };
    let entry_id = Uuid::new_v4().to_string();
    let now = utc_now();
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO journal_entries (entry_id, astronaut_id, entry_type, value, unit_or_scale, source_type, recorded_at_utc)
         VALUES (?1, ?2, ?3, ?4, ?5, 'SELF_REPORTED', ?6)",
        params![entry_id, astronaut_id, entry_type, stored_value, unit, now],
    )
    .map_err(|error| error.to_string())?;
    queue_local(&tx, "journal_entry", &entry_id)?;
    audit(&tx, "JOURNAL_SAVED", "journal_entry", &entry_id, entry_type)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(entry_id)
}

pub fn add_manual_entries(
    conn: &Connection,
    astronaut_id: &str,
    systolic: &str,
    diastolic: &str,
    temperature: &str,
) -> Result<usize, String> {
    let mut count = 0;
    let sys_text = systolic.trim();
    let dia_text = diastolic.trim();
    let temp_text = temperature.trim();
    if sys_text.is_empty() && dia_text.is_empty() && temp_text.is_empty() {
        return Err("Enter a blood pressure, a temperature, or both.".into());
    }
    if sys_text.is_empty() != dia_text.is_empty() {
        return Err("Enter both blood pressure numbers.".into());
    }
    let tx = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    if !sys_text.is_empty() {
        let sys = parse_decimal(sys_text)?;
        let dia = parse_decimal(dia_text)?;
        if !(40.0..=300.0).contains(&sys) || !(20.0..=200.0).contains(&dia) || sys <= dia {
            return Err("Those blood pressure numbers are outside the entry bounds, or the first number is not higher than the second.".into());
        }
        insert_manual_metric(&tx, astronaut_id, "BLOOD_PRESSURE_SYSTOLIC", sys, "mmHg")?;
        insert_manual_metric(&tx, astronaut_id, "BLOOD_PRESSURE_DIASTOLIC", dia, "mmHg")?;
        count += 2;
    }
    if !temp_text.is_empty() {
        let temp = parse_decimal(temp_text)?;
        if !(20.0..=50.0).contains(&temp) {
            return Err("Temperature must be from 20 to 50 C. This is an entry bound, not a health category.".into());
        }
        insert_manual_metric(&tx, astronaut_id, "BODY_TEMPERATURE", temp, "C")?;
        count += 1;
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(count)
}

fn insert_manual_metric(conn: &Connection, astronaut_id: &str, metric_type: &str, value: f64, unit: &str) -> Result<(), String> {
    let metric_id = Uuid::new_v4().to_string();
    let now = utc_now();
    let note = json!({
        "note": "Manually entered by the crew. The camera did not measure this value.",
        "entry_bound_only": true
    });
    conn.execute(
        "INSERT INTO metric_records (
            metric_id, session_id, astronaut_id, metric_type, value, unit, source_type, validity_status,
            quality_score, quality_metadata_json, method_name, method_version, measured_at_utc, created_at_utc
         ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, 'SELF_REPORTED', 'VALID', NULL, ?6, 'MANUAL_ENTRY', 'manual-entry-v1', ?7, ?7)",
        params![metric_id, astronaut_id, metric_type, value, unit, note.to_string(), now],
    )
    .map_err(|error| error.to_string())?;
    queue_local(conn, "metric_record", &metric_id)?;
    audit(conn, "MANUAL_ENTRY_SAVED", "metric_record", &metric_id, metric_type)?;
    Ok(())
}

pub fn local_only_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM sync_queue WHERE status != 'SYNCED'",
        [],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

pub fn list_alerts(conn: &Connection) -> Result<Vec<Value>, String> {
    let mut statement = conn
        .prepare(
            "SELECT alert_id, severity, rule_id, status, created_at_utc, acknowledged_at_utc
             FROM alerts WHERE status IN ('OPEN', 'ACKNOWLEDGED') ORDER BY created_at_utc DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(json!({
                "alert_id": row.get::<_, String>(0)?,
                "severity": row.get::<_, String>(1)?,
                "rule_id": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "created_at_utc": row.get::<_, String>(4)?,
                "acknowledged_at_utc": row.get::<_, Option<String>>(5)?,
            }))
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

pub fn sync_storage_alert(conn: &Connection, low: bool) -> Result<(), String> {
    let open_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM alerts WHERE rule_id = 'STORAGE_LOW' AND status IN ('OPEN', 'ACKNOWLEDGED')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if low && open_count == 0 {
        let alert_id = Uuid::new_v4().to_string();
        let now = utc_now();
        conn.execute(
            "INSERT INTO alerts (
                alert_id, astronaut_id, severity, rule_id, rule_version, source_record_id,
                created_at_utc, acknowledged_at_utc, acknowledged_by, resolved_at_utc, status
             ) VALUES (?1, NULL, 'SYSTEM', 'STORAGE_LOW', 'storage-v1', NULL, ?2, NULL, NULL, NULL, 'OPEN')",
            params![alert_id, now],
        )
        .map_err(|error| error.to_string())?;
        audit(conn, "ALERT_OPENED", "alert", &alert_id, "STORAGE_LOW")?;
    }
    if !low && open_count > 0 {
        let now = utc_now();
        conn.execute(
            "UPDATE alerts SET status = 'RESOLVED', resolved_at_utc = ?1
             WHERE rule_id = 'STORAGE_LOW' AND status IN ('OPEN', 'ACKNOWLEDGED')",
            [now],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn acknowledge_alert(conn: &Connection, alert_id: &str) -> Result<(), String> {
    let now = utc_now();
    let changed = conn
        .execute(
            "UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at_utc = ?1, acknowledged_by = 'LOCAL_OPERATOR'
             WHERE alert_id = ?2 AND status = 'OPEN'",
            params![now, alert_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("That alert is not waiting for acknowledgement.".into());
    }
    audit(conn, "ALERT_ACKNOWLEDGED", "alert", alert_id, "LOCAL_OPERATOR")?;
    Ok(())
}

pub fn export_records(conn: &Connection, data_dir: &Path, astronaut_id: &str, format_name: &str) -> Result<String, String> {
    let astronaut = conn
        .query_row(
            "SELECT crew_identifier, display_name FROM astronauts WHERE astronaut_id = ?1",
            [astronaut_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| "Crew member was not found.".to_string())?;
    let metrics = list_metrics(conn, astronaut_id)?;
    let journal = list_journal(conn, astronaut_id)?;
    let generated = utc_now();
    let stamp = generated.replace(':', "").replace('-', "");
    let safe_id: String = astronaut.0.chars().filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-').collect();
    let extension = if format_name == "TXT" { "txt" } else { "json" };
    let path = data_dir.join("exports").join(format!("{safe_id}-{stamp}.{extension}"));
    let body = if format_name == "TXT" {
        render_txt(&astronaut.0, &astronaut.1, &generated, &metrics, &journal)
    } else {
        serde_json::to_string_pretty(&json!({
            "generated_at_utc": generated,
            "astronaut_id": astronaut_id,
            "crew_identifier": astronaut.0,
            "display_name": astronaut.1,
            "note": "Values keep their source and validity. This file is not a diagnosis.",
            "metrics": metrics,
            "journal": journal
        }))
        .map_err(|error| error.to_string())?
    };
    std::fs::write(&path, body).map_err(|error| error.to_string())?;
    audit(conn, "EXPORT_WRITTEN", "astronaut", astronaut_id, &path.display().to_string())?;
    Ok(path.display().to_string())
}

fn render_txt(identifier: &str, name: &str, generated: &str, metrics: &[Value], journal: &[Value]) -> String {
    let mut lines = vec![
        format!("Health Engine export"),
        format!("Generated at: {generated}"),
        format!("Crew identifier: {identifier}"),
        format!("Display name: {name}"),
        "This file is not a diagnosis.".to_string(),
        String::new(),
        "Metrics".to_string(),
    ];
    for metric in metrics {
        lines.push(format!(
            "{} | {} {} | source {} | validity {} | {}",
            metric["measured_at_utc"].as_str().unwrap_or(""),
            metric["value"].as_f64().map(|value| value.to_string()).unwrap_or_else(|| "—".to_string()),
            metric["unit"].as_str().unwrap_or(""),
            metric["source_type"].as_str().unwrap_or(""),
            metric["validity_status"].as_str().unwrap_or(""),
            metric["metric_type"].as_str().unwrap_or("")
        ));
    }
    lines.push(String::new());
    lines.push("Journal (self-reported)".to_string());
    for entry in journal {
        lines.push(format!(
            "{} | {} | {} | {}",
            entry["recorded_at_utc"].as_str().unwrap_or(""),
            entry["entry_type"].as_str().unwrap_or(""),
            entry["value"].as_str().unwrap_or(""),
            entry["source_type"].as_str().unwrap_or("")
        ));
    }
    lines.join("\n")
}

pub fn write_month_snapshot(conn: &Connection, data_dir: &Path, now: DateTime<Utc>) -> Result<String, String> {
    let month = now.format("%Y-%m").to_string();
    let dir = data_dir.join("ASTRONAUTS-HEALTH-RESULTS-MONTH").join(&month);
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let cards = home_cards(conn, now)?;
    let metrics = query_all_json(
        conn,
        "SELECT astronaut_id, metric_type, value, unit, source_type, validity_status, measured_at_utc FROM metric_records ORDER BY measured_at_utc",
    )?;
    let journal = query_all_json(
        conn,
        "SELECT astronaut_id, entry_type, value, unit_or_scale, source_type, recorded_at_utc FROM journal_entries ORDER BY recorded_at_utc",
    )?;
    let audit_rows = query_all_json(
        conn,
        "SELECT event_type, target_type, target_id, timestamp_utc, details_json FROM audit_events ORDER BY timestamp_utc",
    )?;
    std::fs::write(dir.join("crew-summary.json"), serde_json::to_string_pretty(&cards).map_err(|e| e.to_string())?)
        .map_err(|error| error.to_string())?;
    std::fs::write(dir.join("measurements.json"), serde_json::to_string_pretty(&metrics).map_err(|e| e.to_string())?)
        .map_err(|error| error.to_string())?;
    std::fs::write(dir.join("journal-summary.json"), serde_json::to_string_pretty(&journal).map_err(|e| e.to_string())?)
        .map_err(|error| error.to_string())?;
    std::fs::write(dir.join("audit-log.json"), serde_json::to_string_pretty(&audit_rows).map_err(|e| e.to_string())?)
        .map_err(|error| error.to_string())?;
    let report = format!(
        "Health Engine monthly snapshot {month}\nGenerated at {}\nThe SQLite database remains the record. This folder is a copy.\nPDF is not produced by this version.\n",
        utc_now()
    );
    std::fs::write(dir.join("report.txt"), report).map_err(|error| error.to_string())?;
    audit(conn, "MONTH_SNAPSHOT", "snapshot", &month, &dir.display().to_string())?;
    Ok(dir.display().to_string())
}

fn query_all_json(conn: &Connection, sql: &str) -> Result<Vec<Value>, String> {
    let mut statement = conn.prepare(sql).map_err(|error| error.to_string())?;
    let names: Vec<String> = statement.column_names().into_iter().map(str::to_string).collect();
    let mut rows = statement.query([]).map_err(|error| error.to_string())?;
    let mut items = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut object = serde_json::Map::new();
        for (index, name) in names.iter().enumerate() {
            object.insert(name.clone(), sqlite_to_json(row, index)?);
        }
        items.push(Value::Object(object));
    }
    Ok(items)
}

fn sqlite_to_json(row: &rusqlite::Row, index: usize) -> Result<Value, String> {
    let value = row.get_ref(index).map_err(|error| error.to_string())?;
    Ok(match value {
        rusqlite::types::ValueRef::Null => Value::Null,
        rusqlite::types::ValueRef::Integer(number) => json!(number),
        rusqlite::types::ValueRef::Real(number) => json!(number),
        rusqlite::types::ValueRef::Text(bytes) => json!(String::from_utf8_lossy(bytes)),
        rusqlite::types::ValueRef::Blob(_) => json!("(binary omitted)"),
    })
}

pub fn backup_database(conn: &Connection, data_dir: &Path) -> Result<String, String> {
    let stamp = utc_now().replace(':', "").replace('-', "");
    let path = data_dir.join("backups").join(format!("health_engine-{stamp}.sqlite"));
    let mut destination = Connection::open(&path).map_err(|error| error.to_string())?;
    let backup = rusqlite::backup::Backup::new(conn, &mut destination).map_err(|error| error.to_string())?;
    backup.step(-1).map_err(|error| error.to_string())?;
    audit(conn, "BACKUP_CREATED", "database", "health_engine.sqlite", &path.display().to_string())?;
    Ok(path.display().to_string())
}

pub fn directory_size(path: &Path) -> u64 {
    let mut total = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let Ok(metadata) = entry.metadata() else { continue };
            if metadata.is_dir() {
                stack.push(entry.path());
            } else {
                total = total.saturating_add(metadata.len());
            }
        }
    }
    total
}

#[cfg(windows)]
unsafe extern "system" {
    fn GetDiskFreeSpaceExW(
        directory: *const u16,
        free_to_caller: *mut u64,
        total_bytes: *mut u64,
        total_free: *mut u64,
    ) -> i32;
}

pub fn free_bytes(path: &Path) -> Option<u64> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let mut free_to_caller = 0u64;
        let mut total = 0u64;
        let mut total_free = 0u64;
        let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut free_to_caller, &mut total, &mut total_free) };
        if ok != 0 {
            return Some(free_to_caller);
        }
        None
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_conn() -> (PathBuf, Connection) {
        let path = std::env::temp_dir().join(format!("health-engine-{}.sqlite", Uuid::new_v4()));
        let conn = open_at(&path).unwrap();
        (path, conn)
    }

    #[test]
    fn valid_pulse_round_trips_and_inconclusive_cannot_keep_a_number() {
        let (path, conn) = temp_conn();
        let astronaut = create_astronaut(&conn, "Crew One", 34, "CREW", 120.0, 80.0, 70.0).unwrap();
        let valid = json!({
            "astronaut_id": astronaut,
            "session_id": Uuid::new_v4().to_string(),
            "validity_status": "VALID",
            "value_bpm": 72.0,
            "quality_score": 1.0,
            "quality_components": {},
            "algorithm_name": "POS",
            "algorithm_version": "pos-wang-2017-v1",
            "worker_version": "0.1.0",
            "effective_fps": 30.0,
            "usable_duration_seconds": 15.0,
            "started_at_utc": "2026-11-14T00:00:00Z",
            "ended_at_utc": "2026-11-14T00:00:15Z",
            "capture": {"device_id": "index:0", "backend": "CAP_DSHOW", "pixel_format": "MJPG", "width": 640, "height": 480}
        });
        save_face_result(&conn, &valid).unwrap();
        drop(conn);
        let reopened = open_at(&path).unwrap();
        let metrics = list_metrics(&reopened, &astronaut).unwrap();
        let camera = metrics.iter().find(|item| item["method_name"] == "POS").unwrap();
        assert_eq!(camera["value"].as_f64(), Some(72.0));
        assert_eq!(camera["validity_status"], "VALID");
        let inconclusive = json!({
            "astronaut_id": astronaut,
            "session_id": Uuid::new_v4().to_string(),
            "validity_status": "INCONCLUSIVE",
            "value_bpm": 70.0,
            "started_at_utc": "2026-11-14T01:00:00Z",
            "ended_at_utc": "2026-11-14T01:00:15Z",
            "capture": {}
        });
        save_face_result(&reopened, &inconclusive).unwrap();
        let stored = list_metrics(&reopened, &astronaut).unwrap();
        let hidden = stored.iter().find(|item| item["validity_status"] == "INCONCLUSIVE").unwrap();
        assert!(hidden["value"].is_null());
        drop(reopened);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn storable_pulse_strips_inconclusive_numbers() {
        assert_eq!(storable_pulse("INCONCLUSIVE", Some(80.0)).unwrap(), None);
        assert!(storable_pulse("VALID", None).is_err());
        assert_eq!(storable_pulse("VALID", Some(80.0)).unwrap(), Some(80.0));
    }
}
