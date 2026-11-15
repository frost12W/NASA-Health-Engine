use std::path::Path;

use windows::core::{w, PCWSTR};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteKeyW, RegSetValueExW, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_SZ, REG_OPTION_NON_VOLATILE,
};

const KEY: windows::core::PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\HealthEngine");

pub fn write_uninstall(uninstaller: &Path, executable: &Path) -> Result<(), String> {
    unsafe {
        let mut key = Default::default();
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            KEY,
            Some(0),
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        )
        .ok()
        .map_err(|error| format!("The uninstall entry was not created: {error}"))?;
        set_text(key, w!("DisplayName"), "Health Engine")?;
        set_text(key, w!("DisplayVersion"), crate::VERSION)?;
        set_text(key, w!("Publisher"), "Health Engine")?;
        set_text(key, w!("UninstallString"), &format!("\"{}\" --uninstall", uninstaller.display()))?;
        set_text(key, w!("DisplayIcon"), &executable.display().to_string())?;
        let _ = RegCloseKey(key);
    }
    Ok(())
}

pub fn remove_uninstall() {
    unsafe {
        let _ = RegDeleteKeyW(HKEY_CURRENT_USER, KEY);
    }
}

unsafe fn set_text(key: windows::Win32::System::Registry::HKEY, name: PCWSTR, value: &str) -> Result<(), String> {
    let mut wide: Vec<u16> = value.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = std::slice::from_raw_parts(wide.as_mut_ptr().cast::<u8>(), wide.len() * 2);
    RegSetValueExW(key, name, Some(0), REG_SZ, Some(bytes))
        .ok()
        .map_err(|error| format!("An uninstall value was not written: {error}"))
}
