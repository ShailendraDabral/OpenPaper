//! Path validation. Every file operation the interface requests names a path
//! relative to the open project; these functions turn it into an absolute path
//! and refuse anything that would land outside the project folder.

use crate::error::{AppError, Result};
use std::path::{Component, Path, PathBuf};

/// Parse a project-relative path written with forward slashes.
/// Rejects empty paths, absolute paths, `.` and `..`, drive letters and odd characters.
fn clean_relative(rel: &str) -> Result<PathBuf> {
    let invalid = || AppError::InvalidPath(format!("\"{rel}\" is not a valid path inside the project."));
    if rel.is_empty() || rel.len() > 1024 || rel.starts_with('/') || rel.contains('\\') || rel.contains('\0') {
        return Err(invalid());
    }
    let mut out = PathBuf::new();
    for part in rel.split('/') {
        if part.is_empty() || part == "." || part == ".." || part.contains(':') {
            return Err(invalid());
        }
        // Belt and braces: the part must be one ordinary path component on this platform.
        let mut components = Path::new(part).components();
        match (components.next(), components.next()) {
            (Some(Component::Normal(_)), None) => out.push(part),
            _ => return Err(invalid()),
        }
    }
    Ok(out)
}

fn ensure_inside(root: &Path, candidate: &Path, rel: &str) -> Result<()> {
    if candidate.starts_with(root) {
        Ok(())
    } else {
        Err(AppError::InvalidPath(format!("\"{rel}\" leads outside the project folder.")))
    }
}

/// Absolute path of an existing file or folder inside the project.
/// Symbolic links are followed and the real location must still be inside `root`.
/// `root` must already be canonical.
pub fn resolve_existing(root: &Path, rel: &str) -> Result<PathBuf> {
    let joined = root.join(clean_relative(rel)?);
    let real = dunce::canonicalize(&joined).map_err(|e| AppError::io(&format!("Could not open \"{rel}\""), e))?;
    ensure_inside(root, &real, rel)?;
    Ok(real)
}

/// Absolute path for a file or folder that may not exist yet.
/// The nearest existing parent must really be inside `root`.
pub fn resolve_new(root: &Path, rel: &str) -> Result<PathBuf> {
    let relative = clean_relative(rel)?;
    let joined = root.join(&relative);
    let mut ancestor = joined.as_path();
    loop {
        if ancestor.exists() {
            let real = dunce::canonicalize(ancestor).map_err(|e| AppError::io(&format!("Could not use \"{rel}\""), e))?;
            ensure_inside(root, &real, rel)?;
            break;
        }
        ancestor = ancestor
            .parent()
            .ok_or_else(|| AppError::InvalidPath(format!("\"{rel}\" is not a valid path inside the project.")))?;
    }
    Ok(joined)
}

/// Check a name for a new project folder: one plain folder name, nothing else.
pub fn valid_folder_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    let bad_char = |c: char| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0') || c.is_control();
    if trimmed.is_empty() || trimmed != name || name.len() > 100 || name == "." || name == ".." || name.ends_with('.') || name.chars().any(bad_char) {
        return Err(AppError::InvalidPath(
            "Use a folder name without slashes or the characters : * ? \" < > |, and not ending in a dot.".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn project() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path().join(".")).unwrap();
        fs::create_dir_all(root.join("sections")).unwrap();
        fs::write(root.join("main.tex"), "x").unwrap();
        fs::write(root.join("sections/intro.tex"), "y").unwrap();
        (dir, root)
    }

    #[test]
    fn accepts_files_inside_the_project() {
        let (_dir, root) = project();
        assert_eq!(resolve_existing(&root, "main.tex").unwrap(), root.join("main.tex"));
        assert_eq!(resolve_existing(&root, "sections/intro.tex").unwrap(), root.join("sections").join("intro.tex"));
        assert_eq!(resolve_new(&root, "figures/new/plot.tex").unwrap(), root.join("figures").join("new").join("plot.tex"));
    }

    #[test]
    fn rejects_paths_that_climb_out() {
        let (_dir, root) = project();
        for bad in ["../secret", "sections/../../secret", "..", "./main.tex", "", "sections//intro.tex", "sections/"] {
            assert!(matches!(resolve_existing(&root, bad), Err(AppError::InvalidPath(_))), "{bad}");
            assert!(matches!(resolve_new(&root, bad), Err(AppError::InvalidPath(_))), "{bad}");
        }
    }

    #[test]
    fn rejects_absolute_paths_and_drive_letters() {
        let (_dir, root) = project();
        for bad in ["/etc/passwd", "C:/Windows/system.ini", "C:\\Windows", "\\\\server\\share", "a\\..\\..\\b", "nul\0byte"] {
            assert!(matches!(resolve_existing(&root, bad), Err(AppError::InvalidPath(_))), "{bad}");
            assert!(matches!(resolve_new(&root, bad), Err(AppError::InvalidPath(_))), "{bad}");
        }
    }

    #[test]
    fn reports_missing_files() {
        let (_dir, root) = project();
        assert!(matches!(resolve_existing(&root, "nope.tex"), Err(AppError::NotFound(_))));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_that_point_outside() {
        let (_dir, root) = project();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "s").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("link")).unwrap();
        std::os::unix::fs::symlink(outside.path().join("secret.txt"), root.join("alias.txt")).unwrap();

        assert!(matches!(resolve_existing(&root, "link/secret.txt"), Err(AppError::InvalidPath(_))));
        assert!(matches!(resolve_existing(&root, "alias.txt"), Err(AppError::InvalidPath(_))));
        assert!(matches!(resolve_new(&root, "link/new.tex"), Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn checks_new_project_names() {
        for good in ["thermal-transport", "Thesis 2026", "paper_v2", "Wärmeleitung"] {
            assert!(valid_folder_name(good).is_ok(), "{good}");
        }
        for bad in ["", " ", "a/b", "a\\b", "..", ".", "con:1", "what?", " padded", "trailing.", "tab\tname"] {
            assert!(valid_folder_name(bad).is_err(), "{bad:?}");
        }
    }
}
