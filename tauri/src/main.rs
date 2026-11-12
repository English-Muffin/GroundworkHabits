// Groundwork Habits on Tauri: the desktop shell for the full app and Lite. The app itself is ../www (embedded at build
// time); this file gives it the desktop bridge (window.groundworkFS, see bridge.js): automatic backups, the backups
// folder, the mini widget, reminder pop-ups, notifications and finishing saves before the window closes.
// Built with `--features full` (the full app) it adds the data folder, the calendar feed, updates and the move from
// the Electron app (full.rs). Lite is built without it and contains no network code.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "full")] mod full;
#[cfg(feature = "full")] mod net;

use std::{fs, path::PathBuf, sync::atomic::{AtomicBool, Ordering}, time::Duration};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_notification::NotificationExt;

static FLUSHED: AtomicBool = AtomicBool::new(false);
// the bridge every window gets before the app's scripts (main, widget and reminder pop-ups)
const BRIDGE: &str = include_str!("bridge.js");

// the bridge plus the app's route for this window (#widget, #ask~habit~key). Set from the start-up script because a
// '#' in the window's address gets encoded and the page would not load; the route is checked by the callers
fn route(hash: &str) -> String {
    format!("{BRIDGE}\nif (location.hash !== '#{hash}') history.replaceState(null, '', '#{hash}');")
}
// tests only: GROUNDWORK_DEBUG_PORT opens WebView2's debugging port (some machines ignore WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS).
// Every window must get the same arguments, or WebView2 refuses to make the second one. The flags are Tauri's defaults.
fn web_args() -> String {
    let mut a = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");
    if let Ok(p) = std::env::var("GROUNDWORK_DEBUG_PORT") { if p.parse::<u16>().is_ok() { a.push_str(&format!(" --remote-debugging-port={p}")); } }
    a
}
fn product(app: &AppHandle) -> String { app.config().product_name.clone().unwrap_or_else(|| "Groundwork Habits".into()) }

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "full")] { return Ok(full::backup_dir(app)); } // the data folder's backups, or the app's own
    #[allow(unreachable_code)]
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups"))
}

// weekly backup: <backups>/<name>, newest 8 kept. The name is checked: it becomes a file name
#[tauri::command]
fn backup(app: AppHandle, name: String, text: String) -> Result<String, String> {
    let ok = name.starts_with("groundwork-backup-") && name.ends_with(".json") && name.len() <= 70
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.');
    if !ok { return Err("bad name".into()); }
    let dir = backup_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!("{name}.tmp"));
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, dir.join(&name)).map_err(|e| e.to_string())?; // never a half-written backup
    let mut all: Vec<_> = fs::read_dir(&dir).map_err(|e| e.to_string())?.filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("groundwork-backup-") && n.ends_with(".json")).collect();
    all.sort(); all.reverse();
    for old in all.iter().skip(8) { let _ = fs::remove_file(dir.join(old)); }
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_backups(app: AppHandle) -> Result<(), String> {
    let dir = backup_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")] let cmd = "explorer";
    #[cfg(target_os = "macos")] let cmd = "open";
    #[cfg(target_os = "linux")] let cmd = "xdg-open";
    std::process::Command::new(cmd).arg(&dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// http(s) links open in the browser, nothing else
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) { return Err("not a web link".into()); }
    #[cfg(target_os = "windows")] { std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")] { std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")] { std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
}

// the mini widget: today's ring, habits and tasks in a small always-on-top window (the app's #widget route)
// async: on Windows a window made from a synchronous command deadlocks the app
#[tauri::command]
async fn widget(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("widget") { let _ = w.set_focus(); return Ok(()); }
    WebviewWindowBuilder::new(&app, "widget", WebviewUrl::App("index.html".into()))
        .title(format!("{} widget", product(&app))).inner_size(340.0, 560.0).min_inner_size(280.0, 320.0)
        .always_on_top(true).initialization_script(&route("widget")).additional_browser_args(&web_args()).build().map_err(|e| e.to_string())?;
    Ok(())
}

// a habit reminder pop-up with Yes/No (the app's #ask~habit~key route), bottom right, stacked when there are several
#[tauri::command]
async fn ask(app: AppHandle, h: String, k: String) -> Result<(), String> {
    let safe = |s: &str| !s.is_empty() && s.len() <= 40 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !safe(&h) || !safe(&k) { return Err("bad reminder".into()); }
    let label = format!("ask-{h}-{k}");
    if app.get_webview_window(&label).is_some() { return Ok(()); }
    let n = app.webview_windows().keys().filter(|l| l.starts_with("ask-")).count() as f64;
    let (mut x, mut y) = (40.0, 40.0);
    if let Ok(Some(m)) = app.primary_monitor() {
        let s = m.scale_factor(); let sz = m.size();
        x = sz.width as f64 / s - 356.0; y = (sz.height as f64 / s - 300.0 - n * 240.0).max(0.0);
    }
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("{} reminder", product(&app))).inner_size(340.0, 230.0).position(x, y)
        .decorations(false).resizable(false).always_on_top(true).skip_taskbar(true)
        .initialization_script(&route(&format!("ask~{h}~{k}"))).additional_browser_args(&web_args()).build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_main(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") { let _ = w.unminimize(); let _ = w.show(); let _ = w.set_focus(); }
}

// the page finished its last (possibly encrypted) save: quit, taking the widget and any pop-ups with it
#[tauri::command]
fn flushed(app: AppHandle) {
    FLUSHED.store(true, Ordering::SeqCst);
    app.exit(0);
}

// the full app's commands (Lite builds without them; its bridge never calls them)
#[cfg(feature = "full")]
#[tauri::command]
async fn choose(app: AppHandle) -> serde_json::Value { full::choose(&app) }
#[cfg(feature = "full")]
#[tauri::command]
async fn fetch_cal(url: String) -> serde_json::Value { full::fetch_cal(url).await }
#[cfg(feature = "full")]
#[tauri::command]
async fn update_check(app: AppHandle) -> serde_json::Value { full::update_check(&app).await }
#[cfg(feature = "full")]
#[tauri::command]
async fn update_install(app: AppHandle) -> serde_json::Value { full::update_install(app).await }

/* the full app's data folder is read and written synchronously by the page (a save on close must not be lost), which
   Tauri's commands can't do; the bridge uses a synchronous request to this local "gw" address instead. Only the app's
   own pages may use it (Origin checked). Paths: /folder /read /write /reset /electron /electron-done */
#[cfg(feature = "full")]
fn gw(app: &AppHandle, req: tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let origin = req.headers().get("origin").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let ours = origin == "http://tauri.localhost" || origin == "tauri://localhost" || origin == "https://tauri.localhost";
    let res = |code: u16, body: Vec<u8>| tauri::http::Response::builder().status(code)
        .header("Access-Control-Allow-Origin", if ours { origin.as_str() } else { "null" })
        .header("Content-Type", "text/plain; charset=utf-8").body(body).unwrap();
    if !ours { return res(403, vec![]); }
    let post = req.method() == "POST";
    match (req.uri().path(), post) {
        ("/folder", false) => res(200, full::folder(app).into_bytes()),
        ("/read", false) => match full::read(app) { Some(t) => res(200, t.into_bytes()), None => res(204, vec![]) },
        ("/write", true) => res(200, if full::write(app, &String::from_utf8_lossy(req.body())) { b"1".to_vec() } else { b"0".to_vec() }),
        ("/reset", true) => { full::reset(app); res(200, b"1".to_vec()) }
        ("/electron", false) => res(200, full::electron_data(app).to_string().into_bytes()),
        ("/electron-done", true) => { full::electron_done(app); res(200, b"1".to_vec()) }
        _ => res(404, vec![]),
    }
}

fn main() {
    let builder = tauri::Builder::default()
        // a second start brings the open window forward instead of opening another copy
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app.clone())))
        .plugin(tauri_plugin_notification::init());
    #[cfg(feature = "full")]
    let builder = builder.register_uri_scheme_protocol("gw", |ctx, req| gw(ctx.app_handle(), req));
    builder
        .setup(|app| {
            let name = app.config().product_name.clone().unwrap_or_else(|| "Groundwork Habits".into());
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title(name).inner_size(1320.0, 860.0).min_inner_size(420.0, 600.0)
                .initialization_script(BRIDGE).additional_browser_args(&web_args()).build()?;
            Ok(())
        })
        .invoke_handler({
            #[cfg(feature = "full")] { tauri::generate_handler![backup, open_backups, open_external, notify, widget, ask, show_main, flushed, choose, fetch_cal, update_check, update_install] }
            #[cfg(not(feature = "full"))] { tauri::generate_handler![backup, open_backups, open_external, notify, widget, ask, show_main, flushed] }
        })
        .on_window_event(|window, event| {
            // closing the main window: let the page finish saving first (at most 3 s), like the Electron app
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if !FLUSHED.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.emit("app:flush", ());
                        let app = window.app_handle().clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_secs(3)); // the page never answered: quit anyway
                            FLUSHED.store(true, Ordering::SeqCst);
                            app.exit(0);
                        });
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Groundwork Habits could not start");
}
