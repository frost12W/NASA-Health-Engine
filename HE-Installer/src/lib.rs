use std::fs;
use std::path::{Path, PathBuf};

#[cfg(windows)]
mod registry;
#[cfg(windows)]
mod shortcut;

pub const VERSION: &str = "0.1.0";

#[derive(Clone, Copy)]
pub struct InstallOptions {
    pub shortcut: bool,
    pub registry: bool,
    pub copy_uninstaller: bool,
}

pub struct Installed {
    pub program_dir: PathBuf,
    pub executable: PathBuf,
}

pub fn program_dir(prefix: &Path) -> PathBuf {
    prefix.join("HealthEngine").join("program")
}

pub fn database_file(prefix: &Path) -> PathBuf {
    prefix.join("HealthEngine").join("database").join("health_engine.sqlite")
}

pub fn install(
    prefix: &Path,
    payload: &[u8],
    installer_exe: Option<&Path>,
    options: InstallOptions,
) -> Result<Installed, String> {
    if payload.len() < 2 || &payload[..2] != b"MZ" {
        return Err("The Health Engine program file is not a Windows executable.".to_string());
    }
    let folder = program_dir(prefix);
    fs::create_dir_all(&folder).map_err(|error| format!("The program folder was not created: {error}"))?;
    let executable = folder.join("health-engine.exe");
    fs::write(&executable, payload).map_err(|error| format!("The program was not written: {error}"))?;
    fs::write(folder.join("version.txt"), VERSION).map_err(|error| format!("The version file was not written: {error}"))?;
    if options.copy_uninstaller {
        if let Some(source) = installer_exe {
            let destination = folder.join("HE-Installer.exe");
            if source != destination {
                fs::copy(source, &destination).map_err(|error| format!("The installer was not copied: {error}"))?;
            }
        }
    }
    if options.shortcut {
        write_shortcut(&executable)?;
    }
    if options.registry {
        write_uninstall_key(&folder.join("HE-Installer.exe"), &executable)?;
    }
    Ok(Installed { program_dir: folder, executable })
}

pub fn uninstall(prefix: &Path) -> Result<(), String> {
    let folder = program_dir(prefix);
    if folder.exists() {
        fs::remove_dir_all(&folder).map_err(|error| format!("The program folder was not removed: {error}"))?;
    }
    remove_shortcut();
    remove_uninstall_key();
    Ok(())
}

fn write_shortcut(executable: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        crate::shortcut::create_start_menu_shortcut(executable)
    }
    #[cfg(not(windows))]
    {
        let _ = executable;
        Ok(())
    }
}

fn remove_shortcut() {
    #[cfg(windows)]
    crate::shortcut::remove_start_menu_shortcut();
}

fn write_uninstall_key(uninstaller: &Path, executable: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        crate::registry::write_uninstall(uninstaller, executable)
    }
    #[cfg(not(windows))]
    {
        let _ = (uninstaller, executable);
        Ok(())
    }
}

fn remove_uninstall_key() {
    #[cfg(windows)]
    crate::registry::remove_uninstall();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_writes_the_program_and_uninstall_keeps_the_database() {
        let prefix = std::env::temp_dir().join(format!("he-install-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&prefix);
        let database = database_file(&prefix);
        fs::create_dir_all(database.parent().unwrap()).unwrap();
        fs::write(&database, b"keep").unwrap();
        let payload = b"MZ-health-engine-test";
        let installed = install(
            &prefix,
            payload,
            None,
            InstallOptions { shortcut: false, registry: false, copy_uninstaller: false },
        )
        .unwrap();
        assert_eq!(fs::read(&installed.executable).unwrap(), payload);
        assert_eq!(fs::read_to_string(installed.program_dir.join("version.txt")).unwrap(), VERSION);
        uninstall(&prefix).unwrap();
        assert!(!installed.executable.exists());
        assert_eq!(fs::read(&database).unwrap(), b"keep");
        let _ = fs::remove_dir_all(&prefix);
    }
}
