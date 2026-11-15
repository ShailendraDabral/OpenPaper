use serde::Serialize;

/// An error the interface can show. `kind` lets it react (for example, offer
/// "reload or overwrite" on a conflict); `message` is written for the user.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    /// No project folder is open.
    NoProject(String),
    /// The path is not allowed: outside the project, or malformed.
    InvalidPath(String),
    NotFound(String),
    AlreadyExists(String),
    /// The file is too large to open in the editor.
    TooLarge(String),
    /// The file is not UTF-8 text.
    NotText(String),
    /// The file changed on disk since the editor last read it.
    Conflict(String),
    Io(String),
}

pub type Result<T> = std::result::Result<T, AppError>;

impl AppError {
    pub fn io(action: &str, err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(format!("{action}: the file or folder no longer exists.")),
            std::io::ErrorKind::PermissionDenied => AppError::Io(format!("{action}: permission denied.")),
            _ => AppError::Io(format!("{action}: {err}.")),
        }
    }
}
