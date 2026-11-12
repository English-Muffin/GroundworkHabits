// The full app's desktop features, first written for the Electron app (same rules and wording): the data folder,
// the calendar feed, updates, and moving data over from the Electron app on the first start.
use crate::net::{self, Got};
use std::{fs, path::{Path, PathBuf}, time::Duration};
use tauri::{AppHandle, Manager};

// config.json and backups live where the Electron app kept them, so a chosen data folder carries over
pub fn base_dir(app: &AppHandle) -> PathBuf {
    app.path().data_dir().map(|d| d.join("Groundwork Habits")).unwrap_or_else(|_| PathBuf::from("."))
}
fn cfg_path(app: &AppHandle) -> PathBuf { base_dir(app).join("config.json") }
pub fn read_cfg(app: &AppHandle) -> serde_json::Value {
    fs::read_to_string(cfg_path(app)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!({}))
}
fn write_cfg(app: &AppHandle, c: &serde_json::Value) {
    let _ = fs::create_dir_all(base_dir(app));
    let _ = fs::write(cfg_path(app), c.to_string());
}
pub fn folder(app: &AppHandle) -> String { read_cfg(app)["folder"].as_str().unwrap_or("").to_string() }
fn data_file(app: &AppHandle) -> Option<PathBuf> { let f = folder(app); if f.is_empty() { None } else { Some(Path::new(&f).join("groundwork.json")) } }
// the save's name before the rename: read until the first write
fn old_file(f: &Path) -> PathBuf { f.with_file_name("daybook.json") }

pub fn read(app: &AppHandle) -> Option<String> {
    let f = data_file(app)?;
    fs::read_to_string(&f).ok().or_else(|| fs::read_to_string(old_file(&f)).ok())
}
pub fn write(app: &AppHandle, text: &str) -> bool {
    let Some(f) = data_file(app) else { return false };
    let tmp = f.with_extension("json.tmp");
    if fs::write(&tmp, text).is_err() || fs::rename(&tmp, &f).is_err() { return false; } // never a half-written file
    let _ = fs::remove_file(old_file(&f)); // no stale (possibly unencrypted) copy under the old name
    true
}
pub fn reset(app: &AppHandle) { let mut c = read_cfg(app); if let Some(o) = c.as_object_mut() { o.remove("folder"); } write_cfg(app, &c); }
pub fn backup_dir(app: &AppHandle) -> PathBuf {
    let f = folder(app);
    if f.is_empty() { base_dir(app).join("backups") } else { Path::new(&f).join("backups") }
}

// tests: GROUNDWORK_TEST_PICK = folder to "pick", GROUNDWORK_TEST_ANSWERS = comma list of dialog button indexes
fn test_answer() -> Option<usize> {
    let a = std::env::var("GROUNDWORK_TEST_ANSWERS").ok()?;
    let mut v: Vec<&str> = a.split(',').filter(|s| !s.is_empty()).collect();
    if v.is_empty() { return None; }
    let first = v.remove(0).parse().ok();
    std::env::set_var("GROUNDWORK_TEST_ANSWERS", v.join(","));
    first
}
fn ask(title: &str, detail: &str, buttons: &[&str]) -> usize {
    if let Some(a) = test_answer() { return a; }
    use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
    let b = match buttons.len() {
        3 => MessageButtons::YesNoCancelCustom(buttons[0].into(), buttons[1].into(), buttons[2].into()),
        _ => MessageButtons::OkCancelCustom(buttons[0].into(), buttons[1].into()),
    };
    match MessageDialog::new().set_level(MessageLevel::Info).set_title("Groundwork Habits").set_description(format!("{title}\n\n{detail}")).set_buttons(b).show() {
        MessageDialogResult::Custom(s) => buttons.iter().position(|x| *x == s).unwrap_or(buttons.len() - 1),
        MessageDialogResult::Yes | MessageDialogResult::Ok => 0,
        MessageDialogResult::No => 1,
        _ => buttons.len() - 1,
    }
}

// pick a data folder; a folder that already has a save asks: replace it (the old file is kept) or load it (second warning)
pub fn choose(app: &AppHandle) -> serde_json::Value {
    let folder = match std::env::var("GROUNDWORK_TEST_PICK") {
        Ok(f) => PathBuf::from(f),
        Err(_) => match rfd::FileDialog::new().set_title("Choose where Groundwork Habits saves your data").pick_folder() { Some(f) => f, None => return serde_json::Value::Null },
    };
    let mut file = folder.join("groundwork.json");
    if !file.exists() && old_file(&file).exists() { file = old_file(&file); }
    let mut mode = "replace";
    if file.exists() {
        let mut info = String::new();
        if let (Ok(meta), Ok(text)) = (fs::metadata(&file), fs::read_to_string(&file)) {
            if let Ok(d) = serde_json::from_str::<serde_json::Value>(&text) {
                let n = |k: &str| d[k].as_array().map_or(0, |a| a.len());
                let when = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
                info = format!("\n\nThat save has {} habits and {} goals (last changed {} days ago).", n("habits"), n("goals"),
                    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|n| (n.as_secs().saturating_sub(when)) / 86400).unwrap_or(0));
            }
        }
        let a = ask("There’s already a Groundwork Habits save in this folder.",
            &format!("Do you want to replace it with your current data, or load the save that’s in the folder?{info}"),
            &["Replace with my current data", "Load the save in this folder", "Cancel"]);
        if a == 2 { return serde_json::Value::Null; }
        if a == 1 {
            let b = ask("Load the save from this folder?",
                "This will overwrite the data you have now with the save from the folder. Make sure it isn’t an old save before continuing. Your current data can’t be recovered afterwards unless you’ve exported a backup.",
                &["Load folder save", "Cancel"]);
            if b != 0 { return serde_json::Value::Null; }
            mode = "load";
        } else {
            let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            let _ = fs::copy(&file, folder.join(format!("groundwork-replaced-{stamp}.json"))); // keep the file being replaced, just in case
        }
    }
    let mut c = read_cfg(app);
    c["folder"] = serde_json::Value::String(folder.to_string_lossy().into_owned());
    write_cfg(app, &c);
    serde_json::json!({ "folder": folder.to_string_lossy(), "mode": mode })
}

// the calendar feed, fetched here because the page itself is blocked by CORS
pub async fn fetch_cal(url: String) -> serde_json::Value {
    let bad = || serde_json::json!({ "ok": false, "error": "The address must be a public https:// link" });
    let Ok(mut u) = reqwest::Url::parse(&url) else { return bad() };
    let c = net::client(Duration::from_secs(20));
    for hop in 0.. {
        let host = u.host_str().unwrap_or("").to_lowercase();
        let local = host == "localhost" || host.ends_with(".localhost") || host.ends_with(".local") || host.ends_with(".internal");
        if u.scheme() != "https" || local { return bad(); }
        match net::get_once(&c, &u, 5_000_000, "text/calendar").await {
            Err(e) if e.contains("private address") => return bad(),
            Err(e) if e.contains("timed out") || e.contains("timeout") => return serde_json::json!({ "ok": false, "error": "Your calendar took too long to respond" }),
            Err(_) => return serde_json::json!({ "ok": false, "error": "Could not reach your calendar" }),
            Ok(Got::Redirect(l)) => {
                if hop >= 5 { return serde_json::json!({ "ok": false, "error": "Too many redirects" }); }
                match u.join(&l) { Ok(n) => u = n, Err(_) => return bad() }
            }
            Ok(Got::TooBig) => return serde_json::json!({ "ok": false, "error": "That calendar is too large" }),
            Ok(Got::Status(s)) => return serde_json::json!({ "ok": false, "error": if s == 404 { "Calendar address not found. Copy the secret iCal address again".to_string() } else { format!("Calendar returned an error ({s})") } }),
            Ok(Got::Body(b)) => {
                let text = String::from_utf8_lossy(&b).into_owned();
                if !text.contains("BEGIN:VCALENDAR") { return serde_json::json!({ "ok": false, "error": "That address is not an iCal calendar" }); }
                return serde_json::json!({ "ok": true, "text": text });
            }
        }
    }
    unreachable!()
}

/* updates (only when the user switches them on): GitHub's latest release. The installed app downloads the setup, checks it
   against the published .sha256 and runs it after this app has exited; the portable exe only gets a link */
const REPO: &str = "English-Muffin/GroundworkHabits";
const GH_HOSTS: [&str; 4] = ["api.github.com", "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"];
pub static PENDING: std::sync::Mutex<Option<(String, String, String)>> = std::sync::Mutex::new(None); // version, setup url, sha256 url

async fn get_github(url: &str, max: usize, accept: &str) -> Result<Vec<u8>, String> {
    let c = net::client(Duration::from_secs(120));
    let mut u = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    for _ in 0..6 {
        if u.scheme() != "https" || !GH_HOSTS.contains(&u.host_str().unwrap_or("")) { return Err("GitHub https only".into()); }
        match net::get_once(&c, &u, max, accept).await? {
            Got::Redirect(l) => u = u.join(&l).map_err(|e| e.to_string())?,
            Got::Status(s) => return Err(format!("HTTP {s}")),
            Got::TooBig => return Err("too large".into()),
            Got::Body(b) => return Ok(b),
        }
    }
    Err("too many redirects".into())
}
fn newer(a: &str, b: &str) -> bool {
    let p = |s: &str| s.split('.').map(|x| x.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    let (x, y) = (p(a), p(b));
    for i in 0..3 { let (m, n) = (x.get(i).copied().unwrap_or(0), y.get(i).copied().unwrap_or(0)); if m != n { return m > n; } }
    false
}
// installed by our setup: its uninstaller sits next to the exe (the portable exe has none)
fn installed() -> bool {
    std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.join("Uninstall Groundwork Habits.exe").exists())).unwrap_or(false)
}
pub async fn update_check(app: &AppHandle) -> serde_json::Value {
    let fail = serde_json::json!({ "ok": false });
    let Ok(body) = get_github(&format!("https://api.github.com/repos/{REPO}/releases/latest"), 2_000_000, "application/vnd.github+json").await else { return fail };
    let Ok(rel) = serde_json::from_slice::<serde_json::Value>(&body) else { return fail };
    let v = rel["tag_name"].as_str().unwrap_or("").trim_start_matches('v').to_string();
    let ok_v = v.split('.').count() == 3 && v.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
    if !ok_v || !newer(&v, &app.package_info().version.to_string()) { return serde_json::json!({ "ok": true, "update": false }); }
    let assets = rel["assets"].as_array().cloned().unwrap_or_default();
    let name_ok = |n: &str| n.starts_with("Groundwork-Habits-") && n.ends_with("-Windows-setup.exe") && n["Groundwork-Habits-".len()..].starts_with(|c: char| c.is_ascii_digit());
    let setup = assets.iter().find(|a| a["name"].as_str().map_or(false, name_ok));
    let sum = setup.and_then(|s| assets.iter().find(|a| a["name"].as_str() == Some(&format!("{}.sha256", s["name"].as_str().unwrap_or("")))));
    let ours = |x: &str| reqwest::Url::parse(x).map_or(false, |u| u.scheme() == "https" && u.host_str() == Some("github.com") && u.path().starts_with(&format!("/{REPO}/releases/download/")));
    // the download addresses stay here; the page can only say "install"
    let pending = match (setup, sum) {
        (Some(s), Some(h)) if installed() => {
            let (su, hu) = (s["browser_download_url"].as_str().unwrap_or(""), h["browser_download_url"].as_str().unwrap_or(""));
            if ours(su) && ours(hu) { Some((v.clone(), su.to_string(), hu.to_string())) } else { None }
        }
        _ => None,
    };
    let auto = pending.is_some();
    *PENDING.lock().unwrap() = pending;
    serde_json::json!({ "ok": true, "update": true, "version": v, "page": format!("https://github.com/{REPO}/releases/latest"), "auto": auto })
}
pub async fn update_install(app: AppHandle) -> serde_json::Value {
    let Some((version, setup, sum)) = PENDING.lock().unwrap().clone() else { return serde_json::json!({ "ok": false, "error": "No update to install" }) };
    let dl = async {
        let exp = String::from_utf8_lossy(&get_github(&sum, 4096, "*/*").await?).split_whitespace().next().unwrap_or("").to_lowercase();
        let buf = get_github(&setup, 400_000_000, "application/octet-stream").await?;
        use sha2::Digest;
        let got: String = sha2::Sha256::digest(&buf).iter().map(|b| format!("{b:02x}")).collect();
        if got != exp { return Err("checksum".to_string()); }
        let f = std::env::temp_dir().join(format!("Groundwork-Habits-update-{version}.exe"));
        fs::write(&f, &buf).map_err(|e| e.to_string())?;
        Ok(f)
    };
    match dl.await {
        Err(e) if e == "checksum" => serde_json::json!({ "ok": false, "error": "The download did not match its checksum" }),
        Err(_) => serde_json::json!({ "ok": false, "error": "Download failed" }),
        Ok(f) => {
            // start the installer once this app has exited, so it never finds the app still open
            // and delete the downloaded setup once it is done (WaitForExit: -Wait would also wait for the app the setup reopens)
            let q = f.to_string_lossy().replace('\'', "''");
            let ps = format!("Wait-Process -Id {} -Timeout 30 -ErrorAction SilentlyContinue; (Start-Process -FilePath '{q}' -ArgumentList '/update' -PassThru).WaitForExit(); Remove-Item -LiteralPath '{q}' -Force -ErrorAction SilentlyContinue",
                std::process::id());
            let _ = std::process::Command::new("powershell.exe").args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps]).spawn();
            let a = app.clone();
            std::thread::spawn(move || { std::thread::sleep(Duration::from_millis(300)); a.exit(0); });
            serde_json::json!({ "ok": true })
        }
    }
}

// first start after the move from Electron: the app's saved keys from the Electron profile (Chromium's localStorage
// database), read from a copy so the original is never touched. Electron kept the page at file://, values are
// UTF-16 (first byte 0) or Latin-1 (first byte 1). Only groundwork-* and daybook-* keys; empty once done
pub fn electron_data(app: &AppHandle) -> serde_json::Value {
    let mut out = serde_json::Map::new();
    let roaming = match app.path().data_dir() { Ok(d) => d, Err(_) => return out.into() };
    if base_dir(app).join("moved-from-electron.txt").exists() { return out.into(); }
    for prof in ["Groundwork Habits", "Daybook"] {
        let src = roaming.join(prof).join("Local Storage").join("leveldb");
        if !src.exists() { continue; }
        let tmp = std::env::temp_dir().join(format!("gh-electron-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        if fs::create_dir_all(&tmp).is_err() { continue; }
        for e in fs::read_dir(&src).into_iter().flatten().flatten() {
            if e.file_name() != "LOCK" { let _ = fs::copy(e.path(), tmp.join(e.file_name())); }
        }
        let mut o = rusty_leveldb::Options::default(); o.create_if_missing = false;
        if let Ok(mut db) = rusty_leveldb::DB::open(&tmp, o) {
            use rusty_leveldb::LdbIterator;
            if let Ok(mut it) = db.new_iter() {
                let (mut k, mut v) = (vec![], vec![]);
                let prefix = b"_file://\x00\x01";
                while it.advance() {
                    it.current(&mut k, &mut v);
                    if !k.starts_with(prefix) || v.is_empty() { continue; }
                    let key = String::from_utf8_lossy(&k[prefix.len()..]).into_owned();
                    if !(key.starts_with("groundwork-") || key.starts_with("daybook-")) { continue; }
                    let val = match v[0] {
                        0 => String::from_utf16_lossy(&v[1..].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect::<Vec<_>>()),
                        1 => v[1..].iter().map(|&b| b as char).collect(),
                        _ => continue,
                    };
                    out.insert(key, serde_json::Value::String(val));
                }
            }
        }
        drop(fs::remove_dir_all(&tmp));
        if !out.is_empty() { break; }
    }
    out.into()
}
pub fn electron_done(app: &AppHandle) {
    let _ = fs::create_dir_all(base_dir(app));
    let _ = fs::write(base_dir(app).join("moved-from-electron.txt"), "Saved data was copied from the Electron app into this one. The Electron profile is kept.");
}

#[cfg(test)]
mod tests {
    #[test]
    fn versions_compare() {
        assert!(super::newer("1.7.4", "1.7.3")); assert!(super::newer("2.0.0", "1.9.9")); assert!(!super::newer("1.7.3", "1.7.3")); assert!(!super::newer("1.7.2", "1.7.10"));
    }
}
