//! File operations on the open project. Plain functions over a canonical
//! project root, so they can be tested without a running application.

use crate::error::{AppError, Result};
use crate::paths::{resolve_existing, resolve_new, valid_folder_name};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Files larger than this are listed but not opened in the editor.
pub const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;
/// A listing stops after this many entries and says so.
pub const MAX_ENTRIES: usize = 10_000;
/// Folders that are never listed: version-control data and OpenPaper's own working files.
const SKIPPED: [&str; 4] = [".git", ".openpaper", "node_modules", ".DS_Store"];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// Path relative to the project, with forward slashes.
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// Last modification, in milliseconds since 1970.
    pub modified_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub entries: Vec<Entry>,
    /// True when the project has more than MAX_ENTRIES files and folders.
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile {
    pub content: String,
    pub modified_ms: u64,
}

/// A file to write when creating a project.
#[derive(Debug, Deserialize)]
pub struct StarterFile {
    pub path: String,
    pub content: String,
}

fn modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Canonical form of a folder the user chose as a project.
pub fn canonical_root(path: &Path) -> Result<PathBuf> {
    let root = dunce::canonicalize(path).map_err(|e| AppError::io("Could not open the folder", e))?;
    if !root.is_dir() {
        return Err(AppError::InvalidPath("That is not a folder.".into()));
    }
    Ok(root)
}

/// Every file and folder in the project, sorted by path.
/// Symbolic links are not followed, so a listing never leaves the project.
pub fn list_entries(root: &Path) -> Result<Listing> {
    let mut entries = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    let mut truncated = false;

    'walk: while let Some(dir) = pending.pop() {
        let reader = match fs::read_dir(&dir) {
            Ok(reader) => reader,
            Err(e) if dir == root => return Err(AppError::io("Could not read the project folder", e)),
            Err(_) => continue, // an unreadable sub-folder is skipped, not fatal
        };
        for item in reader.flatten() {
            let name = item.file_name();
            let Some(name) = name.to_str() else { continue };
            if SKIPPED.contains(&name) {
                continue;
            }
            let Ok(kind) = item.file_type() else { continue };
            if kind.is_symlink() {
                continue;
            }
            let Ok(meta) = item.metadata() else { continue };
            let Ok(relative) = item.path().strip_prefix(root).map(Path::to_path_buf) else { continue };
            let path = relative.iter().filter_map(|part| part.to_str()).collect::<Vec<_>>().join("/");

            if entries.len() >= MAX_ENTRIES {
                truncated = true;
                break 'walk;
            }
            entries.push(Entry { path, is_dir: kind.is_dir(), size: if kind.is_dir() { 0 } else { meta.len() }, modified_ms: modified_ms(&meta) });
            if kind.is_dir() {
                pending.push(item.path());
            }
        }
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(Listing { entries, truncated })
}

pub fn read_text(root: &Path, rel: &str) -> Result<TextFile> {
    let path = resolve_existing(root, rel)?;
    let meta = fs::metadata(&path).map_err(|e| AppError::io(&format!("Could not read \"{rel}\""), e))?;
    if meta.is_dir() {
        return Err(AppError::InvalidPath(format!("\"{rel}\" is a folder.")));
    }
    if meta.len() > MAX_TEXT_BYTES {
        return Err(AppError::TooLarge(format!("\"{rel}\" is too large to open in the editor.")));
    }
    let bytes = fs::read(&path).map_err(|e| AppError::io(&format!("Could not read \"{rel}\""), e))?;
    let content = String::from_utf8(bytes).map_err(|_| AppError::NotText(format!("\"{rel}\" is not UTF-8 text.")))?;
    Ok(TextFile { content, modified_ms: modified_ms(&meta) })
}

/// Write a text file and return its new modification time.
///
/// `expected_modified_ms` is the modification time the editor last saw. If the
/// file on disk is newer or older than that, something else changed it and the
/// write is refused with `Conflict`, so nothing is silently overwritten. Pass
/// `None` to write regardless (a new file, or an explicit "keep my version").
///
/// The content goes to a temporary file first and is then renamed into place,
/// so a crash mid-write cannot leave a half-written document.
pub fn write_text(root: &Path, rel: &str, content: &str, expected_modified_ms: Option<u64>) -> Result<u64> {
    let path = resolve_new(root, rel)?;
    let failed = |e| AppError::io(&format!("Could not save \"{rel}\""), e);

    match fs::metadata(&path) {
        Ok(meta) if meta.is_dir() => return Err(AppError::InvalidPath(format!("\"{rel}\" is a folder."))),
        Ok(meta) => {
            if let Some(expected) = expected_modified_ms {
                if modified_ms(&meta) != expected {
                    return Err(AppError::Conflict(format!("\"{rel}\" was changed outside OpenPaper.")));
                }
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            if expected_modified_ms.is_some() {
                return Err(AppError::Conflict(format!("\"{rel}\" was deleted or moved outside OpenPaper.")));
            }
        }
        Err(e) => return Err(failed(e)),
    }

    let parent = path.parent().ok_or_else(|| AppError::InvalidPath(format!("\"{rel}\" has no parent folder.")))?;
    fs::create_dir_all(parent).map_err(failed)?;
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let temp = parent.join(format!(".{file_name}.openpaper-tmp"));
    let written = (|| {
        let mut file = fs::File::create(&temp)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temp, &path)
    })();
    if let Err(e) = written {
        let _ = fs::remove_file(&temp);
        return Err(failed(e));
    }
    let meta = fs::metadata(&path).map_err(failed)?;
    Ok(modified_ms(&meta))
}

/// Create an empty file. Fails if something with that name exists.
pub fn create_file(root: &Path, rel: &str) -> Result<u64> {
    let path = resolve_new(root, rel)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(format!("\"{rel}\" already exists.")));
    }
    write_text(root, rel, "", None)
}

/// Create a folder (and any missing parents). Fails if something with that name exists.
pub fn create_dir(root: &Path, rel: &str) -> Result<()> {
    let path = resolve_new(root, rel)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(format!("\"{rel}\" already exists.")));
    }
    fs::create_dir_all(&path).map_err(|e| AppError::io(&format!("Could not create \"{rel}\""), e))
}

/// Delete a file or directory inside the project.
pub fn delete_entry(root: &Path, rel: &str) -> Result<()> {
    let path = resolve_existing(root, rel)?;
    if path == root {
        return Err(AppError::InvalidPath("Cannot delete the project root folder.".into()));
    }
    if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| AppError::io(&format!("Could not delete \"{rel}\""), e))
    } else {
        fs::remove_file(&path).map_err(|e| AppError::io(&format!("Could not delete \"{rel}\""), e))
    }
}

/// Create a new project folder `name` inside `parent` and fill it with starter files.
/// Returns the canonical path of the new folder.
pub fn create_project(parent: &Path, name: &str, files: &[StarterFile]) -> Result<PathBuf> {
    valid_folder_name(name)?;
    let dir = parent.join(name);
    if dir.exists() {
        return Err(AppError::AlreadyExists(format!("A folder named \"{name}\" already exists there.")));
    }
    fs::create_dir(&dir).map_err(|e| AppError::io("Could not create the project folder", e))?;
    let root = canonical_root(&dir)?;
    for file in files {
        write_text(&root, &file.path, &file.content, None)?;
    }
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let root = canonical_root(dir.path()).unwrap();
        fs::create_dir_all(root.join("sections")).unwrap();
        fs::create_dir_all(root.join(".git/objects")).unwrap();
        fs::write(root.join("main.tex"), "\\documentclass{article}\n").unwrap();
        fs::write(root.join("sections/intro.tex"), "Wärme κ\n").unwrap();
        fs::write(root.join(".git/config"), "x").unwrap();
        fs::write(root.join("figure.png"), [0x89, 0x50, 0xff, 0x00]).unwrap();
        (dir, root)
    }

    #[test]
    fn lists_files_and_folders_but_not_git_data() {
        let (_dir, root) = project();
        let listing = list_entries(&root).unwrap();
        let paths: Vec<_> = listing.entries.iter().map(|e| (e.path.as_str(), e.is_dir)).collect();
        assert_eq!(paths, [("figure.png", false), ("main.tex", false), ("sections", true), ("sections/intro.tex", false)]);
        assert!(!listing.truncated);
    }

    #[cfg(unix)]
    #[test]
    fn listing_does_not_follow_symlinks() {
        let (_dir, root) = project();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "s").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("link")).unwrap();
        let listing = list_entries(&root).unwrap();
        assert!(listing.entries.iter().all(|e| !e.path.starts_with("link")));
    }

    #[test]
    fn reads_utf8_text_and_refuses_binary() {
        let (_dir, root) = project();
        assert_eq!(read_text(&root, "sections/intro.tex").unwrap().content, "Wärme κ\n");
        assert!(matches!(read_text(&root, "figure.png"), Err(AppError::NotText(_))));
        assert!(matches!(read_text(&root, "sections"), Err(AppError::InvalidPath(_))));
        assert!(matches!(read_text(&root, "../outside.tex"), Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn refuses_files_that_are_too_large() {
        let (_dir, root) = project();
        fs::write(root.join("big.tex"), vec![b'a'; (MAX_TEXT_BYTES + 1) as usize]).unwrap();
        assert!(matches!(read_text(&root, "big.tex"), Err(AppError::TooLarge(_))));
    }

    #[test]
    fn writes_and_reads_back() {
        let (_dir, root) = project();
        let before = read_text(&root, "main.tex").unwrap();
        let modified = write_text(&root, "main.tex", "new content\n", Some(before.modified_ms)).unwrap();
        let after = read_text(&root, "main.tex").unwrap();
        assert_eq!(after.content, "new content\n");
        assert_eq!(after.modified_ms, modified);
        // No temporary file is left behind.
        assert!(list_entries(&root).unwrap().entries.iter().all(|e| !e.path.contains("openpaper-tmp")));
    }

    #[test]
    fn refuses_to_overwrite_a_file_changed_elsewhere() {
        let (_dir, root) = project();
        let seen = read_text(&root, "main.tex").unwrap().modified_ms;
        let result = write_text(&root, "main.tex", "mine\n", Some(seen + 5));
        assert!(matches!(result, Err(AppError::Conflict(_))));
        assert_eq!(fs::read_to_string(root.join("main.tex")).unwrap(), "\\documentclass{article}\n");

        // Explicitly keeping my version works.
        write_text(&root, "main.tex", "mine\n", None).unwrap();
        assert_eq!(fs::read_to_string(root.join("main.tex")).unwrap(), "mine\n");
    }

    #[test]
    fn reports_a_file_deleted_elsewhere() {
        let (_dir, root) = project();
        let seen = read_text(&root, "main.tex").unwrap().modified_ms;
        fs::remove_file(root.join("main.tex")).unwrap();
        assert!(matches!(write_text(&root, "main.tex", "mine\n", Some(seen)), Err(AppError::Conflict(_))));
    }

    #[test]
    fn creates_files_and_folders_once() {
        let (_dir, root) = project();
        create_file(&root, "tables/samples.tex").unwrap();
        assert_eq!(fs::read_to_string(root.join("tables/samples.tex")).unwrap(), "");
        assert!(matches!(create_file(&root, "tables/samples.tex"), Err(AppError::AlreadyExists(_))));
        create_dir(&root, "figures/raw").unwrap();
        assert!(root.join("figures/raw").is_dir());
        assert!(matches!(create_dir(&root, "figures"), Err(AppError::AlreadyExists(_))));
        assert!(matches!(create_file(&root, "../escape.tex"), Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn creates_a_project_with_starter_files() {
        let parent = tempfile::tempdir().unwrap();
        let files = [
            StarterFile { path: "main.tex".into(), content: "hello\n".into() },
            StarterFile { path: "chapters/one.tex".into(), content: "one\n".into() },
        ];
        let root = create_project(parent.path(), "My Thesis", &files).unwrap();
        assert_eq!(fs::read_to_string(root.join("chapters/one.tex")).unwrap(), "one\n");
        assert!(matches!(create_project(parent.path(), "My Thesis", &files), Err(AppError::AlreadyExists(_))));
        assert!(matches!(create_project(parent.path(), "../oops", &files), Err(AppError::InvalidPath(_))));

        let escaping = [StarterFile { path: "../outside.tex".into(), content: "x".into() }];
        assert!(matches!(create_project(parent.path(), "Other", &escaping), Err(AppError::InvalidPath(_))));
        assert!(!parent.path().join("outside.tex").exists());
    }

    #[test]
    fn deletes_file_and_directory() {
        let (_dir, root) = project();
        assert!(root.join("sections/intro.tex").exists());
        delete_entry(&root, "sections/intro.tex").unwrap();
        assert!(!root.join("sections/intro.tex").exists());

        assert!(root.join("sections").is_dir());
        delete_entry(&root, "sections").unwrap();
        assert!(!root.join("sections").exists());
    }
}
