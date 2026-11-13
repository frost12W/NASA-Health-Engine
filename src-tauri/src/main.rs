#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// WINDOWS DESKTOP PROCESS ENTRY.
fn main() {
    health_engine_lib::run()
}
