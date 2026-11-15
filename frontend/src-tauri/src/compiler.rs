use crate::error::{AppError, Result};
use crate::paths;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompilerInfo {
    pub available: bool,
    pub name: String,
    pub path: String,
    pub kind: String,
    pub version: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompileOutput {
    pub success: bool,
    pub log: String,
    pub pdf_filename: Option<String>,
    pub duration_ms: u64,
}

const PLACEHOLDER_PDF: &[u8] = include_bytes!("../assets/placeholder.pdf");
const PLACEHOLDER_PNG: &[u8] = include_bytes!("../assets/placeholder.png");
const PLACEHOLDER_JPG: &[u8] = include_bytes!("../assets/placeholder.jpg");

/// Extract target image file names from \includegraphics commands in LaTeX text
fn extract_graphics_targets(text: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut remaining = text;
    while let Some(idx) = remaining.find(r"\includegraphics") {
        let after_cmd = &remaining[idx + r"\includegraphics".len()..];
        let after_trim = after_cmd.trim_start();
        let after_opts = if after_trim.starts_with('[') {
            if let Some(close_bracket) = after_trim.find(']') {
                &after_trim[close_bracket + 1..]
            } else {
                after_trim
            }
        } else {
            after_trim
        };
        let after_opts_trim = after_opts.trim_start();
        if after_opts_trim.starts_with('{') {
            if let Some(close_brace) = after_opts_trim.find('}') {
                let inner = after_opts_trim[1..close_brace].trim();
                if !inner.is_empty() {
                    let clean = inner.trim_matches('"').trim_matches('\'').replace('\\', "/");
                    let clean_trim = clean.trim_start_matches("./");
                    if !clean_trim.is_empty() && !targets.contains(&clean_trim.to_string()) {
                        targets.push(clean_trim.to_string());
                    }
                }
                remaining = &after_opts_trim[close_brace + 1..];
                continue;
            }
        }
        remaining = &remaining[idx + r"\includegraphics".len()..];
    }
    targets
}

/// Recursively find all .tex files in project
fn find_tex_files(dir: &Path, list: &mut Vec<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str != ".git" && name_str != ".openpaper" && name_str != "node_modules" {
                        find_tex_files(&path, list);
                    }
                } else if ft.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().eq_ignore_ascii_case("tex") {
                            list.push(path);
                        }
                    }
                }
            }
        }
    }
}

/// Ensure all graphics referenced in \includegraphics commands exist, creating clean placeholders if missing
fn ensure_resilient_graphics(root: &Path) -> Vec<String> {
    let mut tex_files = Vec::new();
    find_tex_files(root, &mut tex_files);

    let mut missing_resolved = Vec::new();

    for tex_path in tex_files {
        let content = match std::fs::read_to_string(&tex_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for target in extract_graphics_targets(&content) {
            let target_path = root.join(&target);
            if target_path.is_file() {
                continue;
            }

            let has_ext = target.contains('.');
            let mut found_with_ext = false;
            if !has_ext {
                for ext in &["pdf", "png", "jpg", "jpeg"] {
                    let candidate = root.join(format!("{target}.{ext}"));
                    if candidate.is_file() {
                        found_with_ext = true;
                        break;
                    }
                }
            }
            if found_with_ext {
                continue;
            }

            let (target_file, bytes) = if target.to_lowercase().ends_with(".png") {
                (target.clone(), PLACEHOLDER_PNG)
            } else if target.to_lowercase().ends_with(".jpg") || target.to_lowercase().ends_with(".jpeg") {
                (target.clone(), PLACEHOLDER_JPG)
            } else if target.to_lowercase().ends_with(".pdf") {
                (target.clone(), PLACEHOLDER_PDF)
            } else {
                (format!("{target}.pdf"), PLACEHOLDER_PDF)
            };

            let out_file = root.join(&target_file);
            if !out_file.is_file() {
                if let Some(parent) = out_file.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if std::fs::write(&out_file, bytes).is_ok() {
                    if !missing_resolved.contains(&target_file) {
                        missing_resolved.push(target_file);
                    }
                }
            }
        }
    }

    missing_resolved
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// Look for tectonic in user home or local app data
fn find_user_tectonic() -> Option<PathBuf> {
    if let Some(home) = dirs_home() {
        let bin = home.join(".openpaper").join("bin").join(if cfg!(windows) { "tectonic.exe" } else { "tectonic" });
        if bin.is_file() {
            return Some(bin);
        }
    }
    None
}

/// Check if a command is executable and get its version line
fn test_command(cmd: &Path, version_flag: &str) -> Option<String> {
    let mut command = Command::new(cmd);
    command.arg(version_flag);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command.output().ok().and_then(|out| {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.lines().next().map(|s| s.trim().to_string())
        } else {
            None
        }
    })
}

/// Find an executable in system PATH
fn which(name: &str) -> Option<PathBuf> {
    let name_with_ext = if cfg!(windows) && !name.ends_with(".exe") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    if let Some(paths) = std::env::var_os("PATH") {
        for path in std::env::split_paths(&paths) {
            let candidate = path.join(&name_with_ext);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Search common TeX installation paths on Windows, macOS, Linux
fn find_tex_binary(name: &str) -> Option<PathBuf> {
    if let Some(p) = which(name) {
        return Some(p);
    }

    let bin_name = if cfg!(windows) && !name.ends_with(".exe") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    if cfg!(windows) {
        let candidates = [
            format!(r"C:\Program Files\MiKTeX\miktex\bin\x64\{}", bin_name),
            format!(r"C:\Program Files (x86)\MiKTeX\miktex\bin\{}", bin_name),
        ];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.is_file() {
                return Some(p);
            }
        }

        if let Some(home) = dirs_home() {
            let local_miktex = home.join(r"AppData\Local\Programs\MiKTeX\miktex\bin\x64").join(&bin_name);
            if local_miktex.is_file() {
                return Some(local_miktex);
            }
        }

        if let Ok(entries) = std::fs::read_dir(r"C:\texlive") {
            for entry in entries.flatten() {
                let candidate = entry.path().join(r"bin\windows").join(&bin_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
                let candidate32 = entry.path().join(r"bin\win32").join(&bin_name);
                if candidate32.is_file() {
                    return Some(candidate32);
                }
            }
        }
    }

    if cfg!(unix) {
        let candidates = [
            format!("/Library/TeX/texbin/{}", bin_name),
            format!("/usr/local/bin/{}", bin_name),
            format!("/opt/homebrew/bin/{}", bin_name),
            format!("/usr/bin/{}", bin_name),
        ];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.is_file() {
                return Some(p);
            }
        }
    }

    None
}

/// Detect all available LaTeX compilers
pub fn detect_compilers() -> Vec<CompilerInfo> {
    let mut list = Vec::new();

    // 1. Tectonic (User / Standalone ~/.openpaper/bin)
    if let Some(tectonic_user) = find_user_tectonic() {
        let version = test_command(&tectonic_user, "--version").unwrap_or_else(|| "Tectonic (Standalone)".into());
        list.push(CompilerInfo {
            available: true,
            name: "Tectonic (Standalone)".into(),
            path: tectonic_user.to_string_lossy().to_string(),
            kind: "tectonic".into(),
            version,
        });
    }

    // 2. Tectonic (System PATH)
    if let Some(tectonic_sys) = which("tectonic") {
        let path_str = tectonic_sys.to_string_lossy().to_string();
        if !list.iter().any(|c| c.path == path_str) {
            let version = test_command(&tectonic_sys, "--version").unwrap_or_else(|| "Tectonic".into());
            list.push(CompilerInfo {
                available: true,
                name: "Tectonic".into(),
                path: path_str,
                kind: "tectonic".into(),
                version,
            });
        }
    }

    // 3. latexmk
    if let Some(latexmk) = find_tex_binary("latexmk") {
        let version = test_command(&latexmk, "-v").unwrap_or_else(|| "Latexmk".into());
        list.push(CompilerInfo {
            available: true,
            name: "Latexmk".into(),
            path: latexmk.to_string_lossy().to_string(),
            kind: "latexmk".into(),
            version,
        });
    }

    // 4. pdflatex
    if let Some(pdflatex) = find_tex_binary("pdflatex") {
        let version = test_command(&pdflatex, "-version").unwrap_or_else(|| "pdfLaTeX".into());
        list.push(CompilerInfo {
            available: true,
            name: "pdfLaTeX".into(),
            path: pdflatex.to_string_lossy().to_string(),
            kind: "pdflatex".into(),
            version,
        });
    }

    // 5. xelatex
    if let Some(xelatex) = find_tex_binary("xelatex") {
        let version = test_command(&xelatex, "-version").unwrap_or_else(|| "XeLaTeX".into());
        list.push(CompilerInfo {
            available: true,
            name: "XeLaTeX".into(),
            path: xelatex.to_string_lossy().to_string(),
            kind: "xelatex".into(),
            version,
        });
    }

    // 6. lualatex
    if let Some(lualatex) = find_tex_binary("lualatex") {
        let version = test_command(&lualatex, "-version").unwrap_or_else(|| "LuaLaTeX".into());
        list.push(CompilerInfo {
            available: true,
            name: "LuaLaTeX".into(),
            path: lualatex.to_string_lossy().to_string(),
            kind: "lualatex".into(),
            version,
        });
    }

    list
}

/// Compile the project root file using the selected or auto-detected compiler
pub fn compile(root: &Path, root_file: &str, compiler_path: Option<&str>) -> Result<CompileOutput> {
    let start_time = Instant::now();

    // Verify root_file path is safe inside project
    let validated_source = paths::resolve_existing(root, root_file)?;
    if !validated_source.is_file() {
        return Err(AppError::NotFound(format!("File '{root_file}' does not exist.")));
    }

    // Determine compiler executable to use
    let comp = if let Some(cp) = compiler_path {
        let p = PathBuf::from(cp);
        if p.is_file() {
            p
        } else {
            return Err(AppError::InvalidPath(format!("Compiler at '{cp}' was not found.")));
        }
    } else {
        let detected = detect_compilers();
        if let Some(first) = detected.first() {
            PathBuf::from(&first.path)
        } else {
            return Err(AppError::NoProject(
                "No LaTeX compiler was found on your system. Please install Tectonic or MiKTeX, or configure a compiler.".into()
            ));
        }
    };

    // Pre-flight check: auto-recover any missing graphic assets to prevent TeX halts
    let auto_recovered = ensure_resilient_graphics(root);

    let comp_name = comp.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let mut cmd = Command::new(&comp);
    cmd.current_dir(root);
    cmd.stdin(std::process::Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    // Build compiler arguments
    if comp_name.contains("tectonic") {
        cmd.arg("-Z");
        cmd.arg("continue-on-errors");
        cmd.arg(root_file);
        cmd.arg("--outdir");
        cmd.arg(root);
    } else if comp_name.contains("latexmk") {
        cmd.arg("-pdf");
        cmd.arg("-interaction=nonstopmode");
        cmd.arg("-file-line-error");
        cmd.arg(root_file);
    } else {
        // pdflatex, xelatex, lualatex
        cmd.arg("-interaction=nonstopmode");
        cmd.arg("-file-line-error");
        cmd.arg(root_file);
    }

    let output = cmd.output().map_err(|e| {
        AppError::Io(format!("Failed to execute compiler '{}': {e}", comp.display()))
    })?;

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let mut log = String::new();
    if !auto_recovered.is_empty() {
        log.push_str("[OpenPaper Auto-Recovery] Missing figure file(s) detected in manuscript.\n");
        log.push_str("Clean placeholder graphics were automatically generated to ensure compilation succeeds:\n");
        for file in &auto_recovered {
            log.push_str(&format!("  • {file}\n"));
        }
        log.push_str("You can upload your actual image file to replace each placeholder anytime.\n");
        log.push_str("--------------------------------------------------------------------------------\n\n");
    }
    if !output.stdout.is_empty() {
        log.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !log.is_empty() {
            log.push_str("\n--- STDERR ---\n");
        }
        log.push_str(&String::from_utf8_lossy(&output.stderr));
    }

    // Determine the expected PDF name
    let pdf_stem = Path::new(root_file).file_stem().and_then(|s| s.to_str()).unwrap_or("main");
    let pdf_filename = format!("{}.pdf", pdf_stem);
    let pdf_path = root.join(&pdf_filename);

    let has_pdf = pdf_path.is_file();
    let success = output.status.success() && has_pdf;

    Ok(CompileOutput {
        success,
        log,
        pdf_filename: if has_pdf { Some(pdf_filename) } else { None },
        duration_ms,
    })
}

/// Read binary content of a compiled PDF file inside the project
pub fn read_pdf_file(root: &Path, filename: &str) -> Result<Vec<u8>> {
    let resolved = paths::resolve_existing(root, filename)?;
    if !resolved.is_file() {
        return Err(AppError::NotFound(format!("PDF file '{filename}' not found.")));
    }
    std::fs::read(&resolved).map_err(|e| AppError::Io(format!("Failed to read PDF file: {e}")))
}

/// Download and install Tectonic standalone to ~/.openpaper/bin/
pub fn install_tectonic() -> Result<String> {
    let home = dirs_home().ok_or_else(|| AppError::Io("Could not find user home directory.".into()))?;
    let bin_dir = home.join(".openpaper").join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| AppError::Io(format!("Could not create directory: {e}")))?;

    let target_exe = bin_dir.join(if cfg!(windows) { "tectonic.exe" } else { "tectonic" });
    if target_exe.is_file() {
        return Ok(target_exe.to_string_lossy().to_string());
    }

    #[cfg(windows)]
    {
        let url = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip";
        let zip_path = bin_dir.join("tectonic.zip");

        let ps_script = format!(
            "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing; Expand-Archive -Path '{}' -DestinationPath '{}' -Force; Remove-Item '{}' -Force",
            url,
            zip_path.display(),
            zip_path.display(),
            bin_dir.display(),
            zip_path.display()
        );

        let mut ps_cmd = Command::new("powershell");
        ps_cmd.arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-Command")
            .arg(&ps_script);
        {
            use std::os::windows::process::CommandExt;
            ps_cmd.creation_flags(0x08000000);
        }

        let out = ps_cmd.output().map_err(|e| AppError::Io(format!("Failed to download Tectonic: {e}")))?;

        if !out.status.success() || !target_exe.is_file() {
            let err = String::from_utf8_lossy(&out.stderr);
            return Err(AppError::Io(format!("Tectonic download failed: {err}")));
        }
    }

    #[cfg(unix)]
    {
        let url = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-aarch64-apple-darwin.tar.gz"
            } else {
                "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-apple-darwin.tar.gz"
            }
        } else if cfg!(target_arch = "aarch64") {
            "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-aarch64-unknown-linux-musl.tar.gz"
        } else {
            "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-unknown-linux-musl.tar.gz"
        };
        let tar_path = bin_dir.join("tectonic.tar.gz");

        let sh_script = format!(
            "curl -sL '{}' -o '{}' && tar -xzf '{}' -C '{}' && rm -f '{}' && chmod +x '{}'",
            url,
            tar_path.display(),
            tar_path.display(),
            bin_dir.display(),
            tar_path.display(),
            target_exe.display()
        );

        let out = Command::new("sh")
            .arg("-c")
            .arg(&sh_script)
            .output()
            .map_err(|e| AppError::Io(format!("Failed to download Tectonic: {e}")))?;

        if !out.status.success() || !target_exe.is_file() {
            let err = String::from_utf8_lossy(&out.stderr);
            return Err(AppError::Io(format!("Tectonic download failed: {err}")));
        }
    }

    Ok(target_exe.to_string_lossy().to_string())
}
