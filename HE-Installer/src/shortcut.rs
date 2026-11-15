use std::path::Path;

use windows::core::{w, Interface, PCWSTR};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{IShellLinkW, SHGetKnownFolderPath, FOLDERID_Programs, KF_FLAG_DEFAULT, ShellLink};

pub fn create_start_menu_shortcut(executable: &Path) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("The shortcut service did not start: {error}"))?;
        let target = wide(executable);
        link.SetPath(PCWSTR(target.as_ptr())).map_err(|error| format!("The shortcut target was rejected: {error}"))?;
        link.SetDescription(w!("Health Engine")).ok();
        let file: IPersistFile = link.cast().map_err(|error| format!("The shortcut could not be saved: {error}"))?;
        let shortcut = programs_folder()?.join("Health Engine.lnk");
        let name = wide(shortcut);
        file.Save(PCWSTR(name.as_ptr()), true).map_err(|error| format!("The Start menu shortcut was not written: {error}"))?;
    }
    Ok(())
}

pub fn remove_start_menu_shortcut() {
    if let Ok(folder) = programs_folder() {
        let _ = std::fs::remove_file(folder.join("Health Engine.lnk"));
    }
}

fn programs_folder() -> Result<std::path::PathBuf, String> {
    unsafe {
        let raw = SHGetKnownFolderPath(&FOLDERID_Programs, KF_FLAG_DEFAULT, None)
            .map_err(|error| format!("The Start menu folder was not found: {error}"))?;
        let text = raw.to_string().map_err(|error| format!("The Start menu path was not readable: {error}"))?;
        Ok(std::path::PathBuf::from(text))
    }
}

fn wide(value: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    value.as_ref().encode_wide().chain(std::iter::once(0)).collect()
}
