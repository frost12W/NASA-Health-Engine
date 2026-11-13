CREATE TABLE astronauts (
    astronaut_id TEXT PRIMARY KEY,
    crew_identifier TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CREW',
    profile_status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE measurement_sessions (
    session_id TEXT PRIMARY KEY,
    astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
    started_at_utc TEXT NOT NULL,
    ended_at_utc TEXT,
    method TEXT NOT NULL CHECK (method IN ('FACE_RPPG', 'FINGER_PPG', 'EXTERNAL_DEVICE', 'OTHER')),
    session_status TEXT NOT NULL CHECK (session_status IN ('COMPLETED_VALID', 'COMPLETED_INCONCLUSIVE')),
    camera_device_id TEXT,
    capture_backend TEXT,
    capture_pixel_format TEXT,
    capture_width INTEGER,
    capture_height INTEGER,
    effective_fps REAL,
    usable_duration_seconds REAL,
    algorithm_name TEXT,
    algorithm_version TEXT,
    worker_version TEXT
);

CREATE TABLE metric_records (
    metric_id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES measurement_sessions(session_id),
    astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
    metric_type TEXT NOT NULL,
    value REAL,
    unit TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('CAMERA_DERIVED', 'EXTERNAL_DEVICE', 'SELF_REPORTED', 'CALCULATED', 'IMPORTED', 'SIMULATED')),
    validity_status TEXT NOT NULL CHECK (validity_status IN ('VALID', 'INCONCLUSIVE', 'INVALID', 'UNAVAILABLE')),
    quality_score REAL,
    quality_metadata_json TEXT,
    method_name TEXT,
    method_version TEXT,
    measured_at_utc TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    CHECK (validity_status != 'VALID' OR value IS NOT NULL),
    CHECK (validity_status != 'INCONCLUSIVE' OR value IS NULL)
);

CREATE TABLE journal_entries (
    entry_id TEXT PRIMARY KEY,
    astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('SLEEP', 'MOOD', 'SYMPTOM')),
    value TEXT NOT NULL,
    unit_or_scale TEXT,
    source_type TEXT NOT NULL DEFAULT 'SELF_REPORTED' CHECK (source_type IN ('SELF_REPORTED', 'IMPORTED', 'EXTERNAL_DEVICE')),
    recorded_at_utc TEXT NOT NULL
);

CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    astronaut_id TEXT NOT NULL REFERENCES astronauts(astronaut_id),
    task_type TEXT NOT NULL,
    due_at_utc TEXT NOT NULL,
    status TEXT NOT NULL,
    completed_at_utc TEXT,
    rule_version TEXT NOT NULL
);

CREATE TABLE alerts (
    alert_id TEXT PRIMARY KEY,
    astronaut_id TEXT REFERENCES astronauts(astronaut_id),
    severity TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    source_record_id TEXT,
    created_at_utc TEXT NOT NULL,
    acknowledged_at_utc TEXT,
    acknowledged_by TEXT,
    resolved_at_utc TEXT,
    status TEXT NOT NULL
);

CREATE TABLE sync_queue (
    item_id TEXT PRIMARY KEY,
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload_version INTEGER NOT NULL,
    created_at_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('LOCAL_ONLY', 'PENDING', 'SENDING', 'RETRY_WAIT', 'SYNCED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at_utc TEXT,
    last_error_code TEXT,
    acknowledged_at_utc TEXT
);

CREATE TABLE audit_events (
    event_id TEXT PRIMARY KEY,
    actor_id TEXT,
    event_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    timestamp_utc TEXT NOT NULL,
    details_json TEXT
);

CREATE TABLE mission_configuration (
    config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
    mission_epoch_utc TEXT,
    circadian_start_utc TEXT,
    circadian_end_utc TEXT,
    circadian_day_label TEXT NOT NULL DEFAULT 'DAY SHIFT',
    circadian_night_label TEXT NOT NULL DEFAULT 'SLEEP CYCLE',
    reminder_cadence TEXT NOT NULL DEFAULT 'ONCE_PER_UTC_DAY',
    low_space_bytes INTEGER NOT NULL DEFAULT 524288000,
    rule_set_version TEXT NOT NULL DEFAULT 'NONE',
    export_format TEXT NOT NULL DEFAULT 'JSON',
    updated_at_utc TEXT NOT NULL
);

INSERT INTO mission_configuration (
    config_id, mission_epoch_utc, circadian_start_utc, circadian_end_utc,
    circadian_day_label, circadian_night_label, reminder_cadence,
    low_space_bytes, rule_set_version, export_format, updated_at_utc
) VALUES (
    1, NULL, NULL, NULL,
    'DAY SHIFT', 'SLEEP CYCLE', 'ONCE_PER_UTC_DAY',
    524288000, 'NONE', 'JSON', '1970-01-01T00:00:00Z'
);

CREATE INDEX idx_metrics_astronaut_time ON metric_records (astronaut_id, measured_at_utc);
CREATE INDEX idx_journal_astronaut_time ON journal_entries (astronaut_id, recorded_at_utc);
CREATE INDEX idx_tasks_astronaut ON tasks (astronaut_id, due_at_utc);
CREATE INDEX idx_alerts_status ON alerts (status);
CREATE UNIQUE INDEX idx_sync_record ON sync_queue (record_type, record_id);
