// SHARED RECORD SHAPES FOR THE LOCAL DESKTOP INTERFACE.

export interface Astronaut {
  astronaut_id: string;
  crew_identifier: string;
  display_name: string;
  role: string;
  profile_status: string;
  age_years: number | null;
}

export interface PersonSession {
  astronautId: string;
  crewIdentifier: string;
  displayName: string;
  ageYears: number;
  role: string;
  sessionPassword: string;
}

export interface MissionClock {
  utc: string;
  doy: number;
  doy_label: string;
  met: string;
  circadian: string;
  mission_state: "idle" | "running" | "paused" | string;
  clock_sync: string;
  clock_note: string;
}

export interface MissionConfig {
  mission_epoch_utc: string | null;
  circadian_start_utc: string | null;
  circadian_end_utc: string | null;
  reminder_cadence: string;
  export_format: string;
  low_space_bytes: number;
  rule_set_version: string;
  met_paused: boolean;
  met_frozen_seconds: number;
}

export interface HomeCard {
  astronaut_id: string;
  crew_identifier: string;
  display_name: string;
  role: string;
  latest_attempt_at: string | null;
  latest_attempt_validity: string | null;
  latest_valid_pulse_bpm: number | null;
  latest_valid_pulse_at: string | null;
  workflow_state: string;
  task_display_status: string;
  age_years: number | null;
  pulse_bpm: number | null;
  pulse_source: string | null;
  respiratory_rate: number | null;
  respiratory_source: string | null;
  sleep_hours: number | null;
  sleep_source: string | null;
  wellbeing: number | null;
  wellbeing_source: string | null;
  last_systolic: number | null;
  last_diastolic: number | null;
}

export interface TaskView {
  task_id: string;
  astronaut_id: string;
  crew_identifier: string;
  display_name: string;
  task_type: string;
  due_at_utc: string;
  display_status: string;
  completed_at_utc: string | null;
}

export interface StorageStatus {
  data_dir: string;
  database_path: string;
  data_bytes: number;
  free_bytes: number | null;
  low_space: boolean;
  warning: string | null;
}

export interface AppInfo {
  version: string;
  data_dir: string;
  database_path: string;
  offline: boolean;
  ground_endpoint_configured: boolean;
  accounts_enabled: boolean;
  worker_error: string | null;
}

export interface MetricRow {
  metric_id: string;
  metric_type: string;
  value: number | null;
  unit: string;
  source_type: string;
  validity_status: string;
  quality_score: number | null;
  method_name: string | null;
  measured_at_utc: string;
}

export interface JournalRow {
  entry_id: string;
  entry_type: string;
  value: string;
  unit_or_scale: string | null;
  source_type: string;
  recorded_at_utc: string;
}

export interface AlertRow {
  alert_id: string;
  severity: string;
  rule_id: string;
  status: string;
  created_at_utc: string;
  acknowledged_at_utc: string | null;
}

export interface SyncStatus {
  ground_endpoint_configured: boolean;
  channel?: string;
  last_acknowledged_at: string | null;
  local_only_count: number;
  waiting_count?: number;
  sent_count?: number;
  error_count?: number;
  note: string;
}

export interface WorkerEvent {
  event?: string;
  jpeg_base64?: string;
  readiness?: { can_start?: boolean; message?: string; face_count?: number; detector?: string };
  capture?: {
    pixel_format?: string;
    width?: number;
    height?: number;
    nominal_fps?: number;
    measured_fps?: number | null;
    backend?: string;
    yuy2_requested?: boolean;
    yuy2_active?: boolean;
  };
  elapsed_seconds?: number;
  duration_seconds?: number;
  status?: string;
  validity_status?: string;
  value_bpm?: number | null;
  rejection_reasons?: string[];
  diagnostic_summary?: string;
  quality_score?: number | null;
  quality_components?: Record<string, unknown>;
  usable_duration_seconds?: number;
  effective_fps?: number;
}
