// APPLICATION ENTRY AND DESKTOP SHELL.
use tauri::Manager;
mod clock;
mod commands;
mod db;
mod worker;

use commands::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = db::default_data_dir();
            db::ensure_layout(&data_dir)?;
            let connection = db::open_default().map_err(|error| std::io::Error::other(error))?;
            let handle = app.handle().clone();
            let (worker, worker_error) = match worker::Worker::spawn(handle) {
                Ok(worker) => (Some(worker), None),
                Err(error) => (None, Some(error)),
            };
            app.manage(AppState {
                db: Mutex::new(connection),
                worker: Mutex::new(worker),
                worker_error: Mutex::new(worker_error),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::mission_clock,
            commands::start_mission,
            commands::pause_mission,
            commands::resume_mission,
            commands::app_info,
            commands::get_mission_config,
            commands::set_mission_config,
            commands::storage_status,
            commands::create_backup,
            commands::write_month_snapshot,
            commands::export_records,
            commands::list_astronauts,
            commands::match_person,
            commands::overwrite_person_name,
            commands::bind_person,
            commands::create_astronaut,
            commands::home_cards,
            commands::list_tasks,
            commands::list_metrics,
            commands::list_journal,
            commands::journal_catalog,
            commands::add_journal_entry,
            commands::add_manual_entries,
            commands::sync_status,
            commands::list_alerts,
            commands::acknowledge_alert,
            commands::worker_status,
            commands::list_cameras,
            commands::open_camera,
            commands::close_camera,
            commands::start_measurement,
            commands::stop_measurement,
            commands::save_last_result,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Health Engine");
}
