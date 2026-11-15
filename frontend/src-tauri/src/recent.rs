//! The list of recently opened projects, kept as a small JSON file in the
//! application's data folder. It is also the allow-list for reopening a
//! project without a folder dialog: only folders the user once chose are on it.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_RECENT: usize = 15;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recent {
    pub path: String,
    pub name: String,
    pub opened_ms: u64,
}

pub fn load(file: &Path) -> Vec<Recent> {
    fs::read_to_string(file).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default()
}

fn save(file: &Path, list: &[Recent]) {
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(text) = serde_json::to_string_pretty(list) {
        let _ = fs::write(file, text);
    }
}

/// Put a project at the top of the list.
pub fn remember(file: &Path, root: &Path) {
    let path = root.to_string_lossy().to_string();
    let name = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path.clone());
    let opened_ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let mut list = load(file);
    list.retain(|r| r.path != path);
    list.insert(0, Recent { path, name, opened_ms });
    list.truncate(MAX_RECENT);
    save(file, &list);
}

pub fn forget(file: &Path, path: &str) {
    let mut list = load(file);
    list.retain(|r| r.path != path);
    save(file, &list);
}

pub fn contains(file: &Path, path: &str) -> bool {
    load(file).iter().any(|r| r.path == path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remembers_most_recent_first_without_duplicates() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("data/recent.json");
        remember(&file, Path::new("/home/me/paper-a"));
        remember(&file, Path::new("/home/me/paper-b"));
        remember(&file, Path::new("/home/me/paper-a"));
        let list = load(&file);
        assert_eq!(list.iter().map(|r| r.name.as_str()).collect::<Vec<_>>(), ["paper-a", "paper-b"]);
        assert!(contains(&file, "/home/me/paper-b"));
        forget(&file, "/home/me/paper-b");
        assert!(!contains(&file, "/home/me/paper-b"));
    }

    #[test]
    fn a_missing_or_damaged_file_is_an_empty_list() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(&dir.path().join("none.json")).is_empty());
        fs::write(dir.path().join("bad.json"), "{not json").unwrap();
        assert!(load(&dir.path().join("bad.json")).is_empty());
    }

    #[test]
    fn keeps_a_bounded_list() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("recent.json");
        for i in 0..(MAX_RECENT + 5) {
            remember(&file, Path::new(&format!("/p/{i}")));
        }
        assert_eq!(load(&file).len(), MAX_RECENT);
    }
}
