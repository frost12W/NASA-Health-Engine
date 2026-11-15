// TYPED COMMANDS TO THE LOCAL DESKTOP CORE.
import { invoke } from "@tauri-apps/api/core";
import type {
  AlertRow,
  AppInfo,
  Astronaut,
  HomeCard,
  JournalRow,
  MetricRow,
  MissionClock,
  MissionConfig,
  StorageStatus,
  SyncStatus,
  TaskView,
} from "./types";

export function desktopAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!desktopAvailable()) {
    throw new Error("Desktop shell is not connected. Open Health Engine on this computer.");
  }
  return invoke<T>(command, args);
}

export const api = {
  clock: () => call<MissionClock>("mission_clock"),
  info: () => call<AppInfo>("app_info"),
  config: () => call<MissionConfig>("get_mission_config"),
  setConfig: (missionEpochUtc: string, circadianStart: string, circadianEnd: string, exportFormat: string) =>
    call<void>("set_mission_config", { missionEpochUtc, circadianStart, circadianEnd, exportFormat }),
  storage: () => call<StorageStatus>("storage_status"),
  backup: () => call<string>("create_backup"),
  snapshot: () => call<string>("write_month_snapshot"),
  exportRecords: (astronautId: string) => call<string>("export_records", { astronautId }),
  astronauts: () => call<Astronaut[]>("list_astronauts"),
  bindPerson: (displayName: string, ageYears: number, role: string) =>
    call<Astronaut>("bind_person", { displayName, ageYears, role }),
  matchPerson: (displayName: string) => call<Astronaut>("match_person", { displayName }),
  overwritePerson: (displayName: string) => call<Astronaut>("overwrite_person_name", { displayName }),
  createAstronaut: (displayName: string, ageYears: number, role: string, systolic: number, diastolic: number, pulse: number) =>
    call<string>("create_astronaut", { displayName, ageYears, role, systolic, diastolic, pulse }),
  startMission: () => call<void>("start_mission"),
  pauseMission: () => call<void>("pause_mission"),
  resumeMission: () => call<void>("resume_mission"),
  home: () => call<HomeCard[]>("home_cards"),
  tasks: () => call<TaskView[]>("list_tasks"),
  metrics: (astronautId: string) => call<MetricRow[]>("list_metrics", { astronautId }),
  journal: (astronautId: string) => call<JournalRow[]>("list_journal", { astronautId }),
  symptoms: () => call<Array<{ id: string; label: string }>>("journal_catalog"),
  addJournal: (astronautId: string, entryType: string, value: string) =>
    call<string>("add_journal_entry", { astronautId, entryType, value }),
  addManual: (astronautId: string, systolic: string, diastolic: string, temperature: string, source: string) =>
    call<number>("add_manual_entries", { astronautId, systolic, diastolic, temperature, source }),
  sync: () => call<SyncStatus>("sync_status"),
  alerts: () => call<AlertRow[]>("list_alerts"),
  acknowledge: (alertId: string) => call<void>("acknowledge_alert", { alertId }),
  worker: () => call<Record<string, unknown>>("worker_status"),
  cameras: () => call<{ cameras: Array<{ device_index: number; label: string }> }>("list_cameras"),
  openCamera: (deviceIndex: number) => call<Record<string, unknown>>("open_camera", { deviceIndex }),
  closeCamera: () => call<Record<string, unknown>>("close_camera"),
  startMeasurement: (astronautId: string) => call<Record<string, unknown>>("start_measurement", { astronautId }),
  stopMeasurement: () => call<Record<string, unknown>>("stop_measurement"),
  saveResult: (astronautId: string) => call<string>("save_last_result", { astronautId }),
};
