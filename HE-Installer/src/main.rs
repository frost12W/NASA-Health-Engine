// A console subsystem lets --version and --silent print in the terminal that started the installer.
// A plain double-click closes that console before the setup window opens.

use std::path::PathBuf;
use std::sync::Mutex;

use he_installer::{install, uninstall, InstallOptions, VERSION};
use image::imageops::FilterType;
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleDC, CreateDIBSection, DeleteDC, EndPaint, GetDC, GetSysColorBrush, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, COLOR_WINDOW, DIB_RGB_COLORS, HGDIOBJ, PAINTSTRUCT, RGBQUAD, SRCCOPY,
};
use windows::Win32::System::Console::FreeConsole;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, LoadCursorW, PostQuitMessage, RegisterClassW, SetWindowTextW, ShowWindow, TranslateMessage, CW_USEDEFAULT, IDC_ARROW, MSG, SW_SHOW, WINDOW_EX_STYLE, WM_COMMAND, WM_DESTROY, WM_PAINT, WNDCLASSW, WS_CHILD, WS_OVERLAPPEDWINDOW, WS_TABSTOP, WS_VISIBLE,
};

const LOGO_PNG: &[u8] = include_bytes!("../../src/assets/health-engine-logo.png");
const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/health-engine.exe"));
const ID_INSTALL: usize = 101;
const ID_CLOSE: usize = 102;

struct Ui {
    bitmap: isize,
    status: isize,
    prefix: PathBuf,
    personal: bool,
}

static UI: Mutex<Option<Ui>> = Mutex::new(None);

fn main() {
    let mut args = std::env::args().skip(1);
    let mut silent = false;
    let mut remove = false;
    let mut prefix: Option<PathBuf> = None;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--version" => {
                println!("{VERSION}");
                return;
            }
            "--silent" => silent = true,
            "--uninstall" => remove = true,
            "--prefix" => prefix = args.next().map(PathBuf::from),
            other => {
                eprintln!("Unknown argument: {other}");
                std::process::exit(2);
            }
        }
    }
    let destination = prefix.unwrap_or_else(default_prefix);
    let personal = default_prefix() == destination;
    let result = if remove {
        uninstall(&destination)
    } else if silent {
        install(
            &destination,
            PAYLOAD,
            std::env::current_exe().ok().as_deref(),
            InstallOptions { shortcut: personal, registry: personal, copy_uninstaller: personal },
        )
        .map(|installed| println!("{}", installed.executable.display()))
    } else {
        let _ = unsafe { FreeConsole() };
        show_window(destination, personal)
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn default_prefix() -> PathBuf {
    std::env::var("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("."))
}

fn show_window(prefix: PathBuf, personal: bool) -> Result<(), String> {
    unsafe {
        let instance = GetModuleHandleW(None).map_err(|error| format!("Windows did not provide the installer module: {error}"))?;
        let class_name = w!("HealthEngineInstaller");
        let class = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: class_name,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: GetSysColorBrush(COLOR_WINDOW),
            ..Default::default()
        };
        if RegisterClassW(&class) == 0 {
            return Err("The installer window class was not registered.".to_string());
        }
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            class_name,
            w!("Health Engine Setup"),
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            640,
            460,
            None,
            None,
            Some(instance.into()),
            None,
        )
        .map_err(|error| format!("The installer window did not open: {error}"))?;
        let status = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            w!("STATIC"),
            w!("Installs Health Engine for this Windows user. Health records stay on this computer."),
            WS_CHILD | WS_VISIBLE,
            24,
            250,
            580,
            64,
            Some(hwnd),
            None,
            Some(instance.into()),
            None,
        )
        .unwrap_or_default();
        let _ = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            w!("BUTTON"),
            w!("Install"),
            WS_CHILD | WS_VISIBLE | WS_TABSTOP,
            24,
            340,
            160,
            36,
            Some(hwnd),
            Some(windows::Win32::UI::WindowsAndMessaging::HMENU(ID_INSTALL as *mut _)),
            Some(instance.into()),
            None,
        );
        let _ = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            w!("BUTTON"),
            w!("Close"),
            WS_CHILD | WS_VISIBLE | WS_TABSTOP,
            200,
            340,
            160,
            36,
            Some(hwnd),
            Some(windows::Win32::UI::WindowsAndMessaging::HMENU(ID_CLOSE as *mut _)),
            Some(instance.into()),
            None,
        );
        *UI.lock().map_err(|_| "The installer window state was locked.".to_string())? = Some(Ui {
            bitmap: load_logo().unwrap_or(0),
            status: status.0 as isize,
            prefix,
            personal,
        });
        let _ = ShowWindow(hwnd, SW_SHOW);
        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).into() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    Ok(())
}

fn load_logo() -> Result<isize, String> {
    let picture = image::load_from_memory(LOGO_PNG).map_err(|error| format!("The logo could not be read: {error}"))?;
    let square = picture.resize(96, 96, FilterType::Lanczos3).to_rgba8();
    let (width, height) = square.dimensions();
    let mut bgra = Vec::with_capacity((width * height * 4) as usize);
    for pixel in square.pixels() {
        bgra.extend_from_slice(&[pixel[2], pixel[1], pixel[0], pixel[3]]);
    }
    unsafe {
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            bmiColors: [RGBQUAD::default(); 1],
        };
        let mut bits = std::ptr::null_mut();
        let screen = GetDC(None);
        let bitmap = CreateDIBSection(Some(screen), &info, DIB_RGB_COLORS, &mut bits, None, 0)
            .map_err(|error| format!("The logo was not drawn: {error}"))?;
        let _ = ReleaseDC(None, screen);
        if !bits.is_null() {
            std::ptr::copy_nonoverlapping(bgra.as_ptr(), bits.cast(), bgra.len());
        }
        Ok(bitmap.0 as isize)
    }
}

unsafe extern "system" fn window_proc(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match message {
        WM_PAINT => {
            let mut paint = PAINTSTRUCT::default();
            let target = BeginPaint(hwnd, &mut paint);
            if let Some(bitmap) = UI.lock().ok().and_then(|ui| ui.as_ref().map(|state| state.bitmap)).filter(|value| *value != 0) {
                let memory = CreateCompatibleDC(Some(target));
                let previous = SelectObject(memory, HGDIOBJ(bitmap as *mut _));
                let _ = BitBlt(target, 24, 24, 96, 96, Some(memory), 0, 0, SRCCOPY);
                let _ = SelectObject(memory, previous);
                let _ = DeleteDC(memory);
            }
            let _ = EndPaint(hwnd, &paint);
            LRESULT(0)
        }
        WM_COMMAND => {
            let id = (wparam.0 & 0xffff) as usize;
            if id == ID_INSTALL {
                let action = UI.lock().ok().and_then(|ui| {
                    ui.as_ref().map(|state| (state.prefix.clone(), state.personal, state.status))
                });
                if let Some((prefix, personal, status)) = action {
                    match install(
                        &prefix,
                        PAYLOAD,
                        std::env::current_exe().ok().as_deref(),
                        InstallOptions { shortcut: personal, registry: personal, copy_uninstaller: personal },
                    ) {
                        Ok(installed) => set_status(status, &format!("Installed: {}", installed.executable.display())),
                        Err(error) => set_status(status, &error),
                    }
                }
            }
            if id == ID_CLOSE {
                PostQuitMessage(0);
            }
            LRESULT(0)
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

fn set_status(status: isize, text: &str) {
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let _ = SetWindowTextW(HWND(status as *mut _), PCWSTR(wide.as_ptr()));
    }
}
