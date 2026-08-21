//! Spawn the skills CLI through an absolute Node runtime.
//!
//! The webview cannot spawn this itself: the shell scope pins the command name at
//! config time, so it can never carry the path we resolve at runtime.

use crate::node_runtime::{self, NodeLookup};
use serde::Serialize;
use specta::Type;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SkillsCliOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Run `npx <args>` with the resolved Node runtime on the child's `PATH`.
/// Returns the exit code and output; a non-zero exit is the caller's to interpret.
#[tauri::command]
#[specta::specta]
pub fn run_skills_cli(args: Vec<String>, cwd: Option<String>) -> Result<SkillsCliOutput, String> {
    let lookup = NodeLookup::from_environment();
    let runtime = node_runtime::cached(&lookup)?;

    let mut command = std::process::Command::new(&runtime.npx);
    command.args(&args);
    command.envs(node_runtime::child_env(&runtime, &lookup));
    if let Some(cwd) = cwd.as_deref().filter(|value| !value.trim().is_empty()) {
        command.current_dir(cwd);
    }

    let output = command
        .output()
        .map_err(|error| format!("Could not run {}: {error}", runtime.npx.display()))?;

    Ok(SkillsCliOutput {
        // A signal-terminated child has no code; -1 matches the shell plugin's shape.
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}
