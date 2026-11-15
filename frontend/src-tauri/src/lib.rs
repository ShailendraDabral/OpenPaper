//! OpenPaper desktop: the Rust side.
//!
//! The interface (a web view) cannot touch the filesystem itself. It asks for
//! things through the commands below, and each command works only inside the
//! one project folder the user opened:
//!
//! * A project folder is chosen in a native dialog that this side opens, taken
//!   from the list of folders chosen before, or given on the command line. The
//!   interface cannot nominate an arbitrary folder.
//! * Every file path is relative to that folder and is validated (`paths.rs`).

mod error;
mod paths;
mod project;
mod recent;

use error::{AppError, Result};
use project::{Listing, StarterFile, TextFile};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct AppState {
    /// Canonical path of the open project folder.
    root: Mutex<Option<PathBuf>>,
    /// A folder passed on the command line, consumed by the first `initial_project` call.
    launch_folder: Mutex<Option<PathBuf>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectInfo {
    /// Absolute path, for display.
    path: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentProject {
    path: String,
    name: String,
    opened_ms: u64,
    /// False when the folder has been moved or deleted since.
    exists: bool,
}

fn recent_file(app: &AppHandle) -> Result<PathBuf> {
    let dir = app.path().app_data_dir().map_err(|e| AppError::Io(format!("Could not find the application data folder: {e}.")))?;
    Ok(dir.join("recent-projects.json"))
}

fn current_root(state: &State<AppState>) -> Result<PathBuf> {
    state.root.lock().unwrap().clone().ok_or_else(|| AppError::NoProject("No project is open.".into()))
}

/// Make `folder` the open project and remember it.
fn open(app: &AppHandle, state: &State<AppState>, folder: &Path) -> Result<ProjectInfo> {
    let root = project::canonical_root(folder)?;
    recent::remember(&recent_file(app)?, &root);
    let info = ProjectInfo {
        path: root.to_string_lossy().to_string(),
        name: root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
    };
    *state.root.lock().unwrap() = Some(root);
    Ok(info)
}

fn pick_folder(app: &AppHandle, title: &str) -> Option<PathBuf> {
    app.dialog().file().set_title(title).blocking_pick_folder().and_then(|chosen| chosen.into_path().ok())
}

/// The project named on the command line (`openpaper path/to/folder`), if any.
#[tauri::command]
async fn initial_project(app: AppHandle, state: State<'_, AppState>) -> Result<Option<ProjectInfo>> {
    let folder = state.launch_folder.lock().unwrap().take();
    match folder {
        Some(folder) => open(&app, &state, &folder).map(Some),
        None => Ok(None),
    }
}

/// Show the system folder dialog and open the chosen folder. `None` if cancelled.
#[tauri::command]
async fn pick_project(app: AppHandle, state: State<'_, AppState>) -> Result<Option<ProjectInfo>> {
    match pick_folder(&app, "Open a project folder") {
        Some(folder) => open(&app, &state, &folder).map(Some),
        None => Ok(None),
    }
}

/// Reopen a project from the recent list. Folders that are not on the list are refused.
#[tauri::command]
async fn open_recent(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<ProjectInfo> {
    if !recent::contains(&recent_file(&app)?, &path) {
        return Err(AppError::InvalidPath("That folder is not in the list of recent projects. Use Open folder instead.".into()));
    }
    open(&app, &state, Path::new(&path))
}

/// Ask where to put a new project, create its folder and starter files, and open it.
/// `None` if the folder dialog was cancelled.
#[tauri::command]
async fn create_project(app: AppHandle, state: State<'_, AppState>, name: String, files: Vec<StarterFile>) -> Result<Option<ProjectInfo>> {
    paths::valid_folder_name(&name)?;
    let Some(parent) = pick_folder(&app, &format!("Choose where to create \"{name}\"")) else {
        return Ok(None);
    };
    let root = project::create_project(&parent, &name, &files)?;
    open(&app, &state, &root).map(Some)
}

#[tauri::command]
async fn close_project(state: State<'_, AppState>) -> Result<()> {
    *state.root.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
async fn recent_projects(app: AppHandle) -> Result<Vec<RecentProject>> {
    Ok(recent::load(&recent_file(&app)?)
        .into_iter()
        .map(|r| RecentProject { exists: Path::new(&r.path).is_dir(), path: r.path, name: r.name, opened_ms: r.opened_ms })
        .collect())
}

#[tauri::command]
async fn forget_recent(app: AppHandle, path: String) -> Result<()> {
    recent::forget(&recent_file(&app)?, &path);
    Ok(())
}

#[tauri::command]
async fn list_files(state: State<'_, AppState>) -> Result<Listing> {
    project::list_entries(&current_root(&state)?)
}

#[tauri::command]
async fn read_text_file(state: State<'_, AppState>, path: String) -> Result<TextFile> {
    project::read_text(&current_root(&state)?, &path)
}

#[tauri::command]
async fn write_text_file(state: State<'_, AppState>, path: String, content: String, expected_modified_ms: Option<u64>) -> Result<u64> {
    project::write_text(&current_root(&state)?, &path, &content, expected_modified_ms)
}

#[tauri::command]
async fn create_file(state: State<'_, AppState>, path: String) -> Result<u64> {
    project::create_file(&current_root(&state)?, &path)
}

#[tauri::command]
async fn create_folder(state: State<'_, AppState>, path: String) -> Result<()> {
    project::create_dir(&current_root(&state)?, &path)
}

pub fn run() {
    // `openpaper path/to/project` opens that folder, like `code .`
    let launch_folder = std::env::args().skip(1).find(|arg| !arg.starts_with('-')).map(PathBuf::from).filter(|p| p.is_dir());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { root: Mutex::new(None), launch_folder: Mutex::new(launch_folder) })
        .invoke_handler(tauri::generate_handler![
            initial_project,
            pick_project,
            open_recent,
            create_project,
            close_project,
            recent_projects,
            forget_recent,
            list_files,
            read_text_file,
            write_text_file,
            create_file,
            create_folder,
        ])
        .run(tauri::generate_context!())
        .expect("OpenPaper could not start");
}
