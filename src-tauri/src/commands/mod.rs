//! Tauri command handlers organized by domain.
//!
//! Each submodule contains related commands and their helper functions.
//! Import specific commands via their submodule (e.g., `commands::preferences::greet`).

pub mod notifications;
pub mod preferences;
pub mod provider_scan;
pub mod quick_pane;
pub mod recovery;
pub mod skills_cli;
pub mod skills_sh;

/// A bare `#[tauri::command]` on a non-async `fn` compiles to
/// `ExecutionContext::Blocking`: the body runs inline in the IPC handler on the
/// main thread, so the webview cannot paint until it returns. A cold
/// `scan_installed_skills` measured 3.4s on a 174-skill machine, which froze the
/// window mid-interaction. Commands that walk the filesystem or spawn a process
/// must carry `(async)` so Tauri runs them on the threadpool instead.
#[cfg(test)]
mod blocking_command_guard {
    const BLOCKING_WORK: &[(&str, &str)] = &[
        (include_str!("provider_scan.rs"), "scan_installed_skills"),
        (include_str!("provider_scan.rs"), "scan_project_skills"),
        (include_str!("provider_scan.rs"), "list_projects"),
        (include_str!("provider_scan.rs"), "install_skill"),
        (include_str!("provider_scan.rs"), "uninstall_skill"),
        (include_str!("provider_scan.rs"), "copy_skill_to_providers"),
        (include_str!("provider_scan.rs"), "delete_universal_skill"),
        (include_str!("skills_cli.rs"), "run_skills_cli"),
    ];

    #[test]
    fn io_commands_never_run_on_the_main_thread() {
        for (source, name) in BLOCKING_WORK {
            let signature = format!("pub fn {name}(");
            let start = source
                .find(&signature)
                .unwrap_or_else(|| panic!("{name} is no longer declared as `pub fn {name}(`"));
            let attributes = &source[start.saturating_sub(200)..start];
            assert!(
                attributes.contains("#[tauri::command(async)]"),
                "{name} does an I/O workload but is registered as a blocking command, \
                 so it will run on the main thread and freeze the webview"
            );
        }
    }
}
