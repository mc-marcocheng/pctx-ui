use std::ffi::OsString;

use crate::commands::CommandError;
use crate::models::generation::{
    ConfigSelection, GenerateRequest, GenerationDestination, PathAliasRequest, ScanRootRequest,
};

pub type EngineArgs = Vec<OsString>;

fn push_flag(args: &mut EngineArgs, flag: &str) {
    args.push(OsString::from(flag));
}

fn push_value(args: &mut EngineArgs, flag: &str, value: impl Into<OsString>) {
    args.push(OsString::from(flag));
    args.push(value.into());
}

pub fn canonical_key(path: &std::path::Path) -> String {
    let value = path.to_string_lossy().to_string();

    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

fn append_config_selection(args: &mut EngineArgs, config: &ConfigSelection) {
    match config {
        ConfigSelection::None => {
            push_flag(args, "--no-config");
        }
        ConfigSelection::File(path) => {
            push_value(args, "--config", path.as_os_str());
        }
    }
}

pub fn build_scan_args(request: &ScanRootRequest) -> EngineArgs {
    let mut args = Vec::new();

    push_flag(&mut args, "--json");
    push_flag(&mut args, "--no-color");

    append_config_selection(&mut args, &request.config);

    push_flag(&mut args, "files");
    push_flag(&mut args, "list");

    for pattern in &request.filters.include {
        push_value(&mut args, "--include", pattern.as_str());
    }

    for pattern in &request.filters.exclude {
        push_value(&mut args, "--exclude", pattern.as_str());
    }

    if request.filters.hidden {
        push_flag(&mut args, "--hidden");
    }

    if request.filters.no_default_excludes {
        push_flag(&mut args, "--no-default-excludes");
    }

    if request.filters.no_gitignore {
        push_flag(&mut args, "--no-gitignore");
    }

    push_value(
        &mut args,
        "--max-size",
        request.filters.max_size_kb.to_string(),
    );

    push_value(
        &mut args,
        "--max-depth",
        request.filters.max_depth.to_string(),
    );

    args
}

pub fn build_generate_args(request: &GenerateRequest) -> Result<EngineArgs, CommandError> {
    let mut args = Vec::new();

    push_flag(&mut args, "--json");
    push_flag(&mut args, "--no-color");
    push_flag(&mut args, "--no-config");
    push_flag(&mut args, "--stdin0");

    // The UI has already produced an exact selected set.
    push_flag(&mut args, "--no-default-excludes");
    push_flag(&mut args, "--no-gitignore");

    // Prevent pctx's default 1024 KB limit from unexpectedly overriding a
    // larger workspace setting.
    push_value(
        &mut args,
        "--max-size",
        request.filters.max_size_kb.to_string(),
    );

    push_value(&mut args, "--format", request.output.format.as_str());

    if request.output.tree {
        push_flag(&mut args, "--tree");
    }

    if request.output.absolute_paths {
        push_flag(&mut args, "--absolute-paths");
    }

    push_value(
        &mut args,
        "--token-model",
        request.output.token_model.clone(),
    );

    if request.truncation.disabled {
        push_flag(&mut args, "--no-truncation");
    } else {
        push_value(
            &mut args,
            "--max-lines",
            request.truncation.max_lines.to_string(),
        );
        push_value(
            &mut args,
            "--head-lines",
            request.truncation.head_lines.to_string(),
        );
        push_value(
            &mut args,
            "--tail-lines",
            request.truncation.tail_lines.to_string(),
        );
        push_value(
            &mut args,
            "--max-line-length",
            request.truncation.max_line_length.to_string(),
        );
        push_value(
            &mut args,
            "--head-chars",
            request.truncation.head_chars.to_string(),
        );
        push_value(
            &mut args,
            "--tail-chars",
            request.truncation.tail_chars.to_string(),
        );
    }

    let aliases = normalize_aliases(&request.aliases)?;
    for mapping in aliases {
        let root = mapping.root.to_str().ok_or_else(|| CommandError {
            code: "unsupported_path_encoding".into(),
            message: format!(
                "Alias root is not valid Unicode: {}",
                mapping.root.display()
            ),
        })?;

        push_value(
            &mut args,
            "--path-alias",
            format!("{}={}", mapping.alias, root),
        );
    }

    match &request.destination {
        GenerationDestination::Preview => {}
        GenerationDestination::Clipboard => {
            push_flag(&mut args, "--clipboard");
        }
        GenerationDestination::File { path, force } => {
            push_value(&mut args, "--output", path.as_os_str());
            if *force {
                push_flag(&mut args, "--force");
            }
        }
    }

    Ok(args)
}

pub fn validate_alias(alias: &str) -> Result<(), CommandError> {
    let valid = !alias.is_empty()
        && alias != "."
        && alias != ".."
        && alias.chars().enumerate().all(|(index, character)| {
            if index == 0 {
                character.is_ascii_alphanumeric()
            } else {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
            }
        });

    if valid {
        Ok(())
    } else {
        Err(CommandError {
            code: "invalid_alias".into(),
            message: format!("Invalid path alias: {alias}"),
        })
    }
}

pub fn normalize_aliases(
    aliases: &[PathAliasRequest],
) -> Result<Vec<PathAliasRequest>, CommandError> {
    let mut by_root = std::collections::HashMap::<String, PathAliasRequest>::new();
    let mut used_aliases = std::collections::HashSet::<String>::new();

    for mapping in aliases {
        validate_alias(&mapping.alias)?;

        let canonical = dunce::canonicalize(&mapping.root).map_err(|error| CommandError {
            code: "invalid_alias_root".into(),
            message: format!("{}: {}", mapping.root.display(), error),
        })?;

        if !canonical.is_dir() {
            return Err(CommandError {
                code: "invalid_alias_root".into(),
                message: format!(
                    "Path alias root is not a directory: {}",
                    canonical.display()
                ),
            });
        }

        let alias_key = if cfg!(windows) || cfg!(target_os = "macos") {
            mapping.alias.to_lowercase()
        } else {
            mapping.alias.clone()
        };

        let root_key = canonical_key(&canonical);

        if let Some(previous) = by_root.get(&root_key) {
            if previous.alias != mapping.alias {
                return Err(CommandError {
                    code: "conflicting_alias_root".into(),
                    message: format!(
                        "{} is mapped to both '{}' and '{}'",
                        canonical.display(),
                        previous.alias,
                        mapping.alias
                    ),
                });
            }
            continue;
        }

        if !used_aliases.insert(alias_key) {
            return Err(CommandError {
                code: "duplicate_alias".into(),
                message: format!("Duplicate path alias: {}", mapping.alias),
            });
        }

        by_root.insert(
            root_key,
            PathAliasRequest {
                alias: mapping.alias.clone(),
                root: canonical,
            },
        );
    }

    let mut result: Vec<_> = by_root.into_values().collect();

    // Most specific roots first. This matches pctx's alias-selection behavior.
    result.sort_by(|left, right| {
        right
            .root
            .components()
            .count()
            .cmp(&left.root.components().count())
            .then_with(|| left.alias.cmp(&right.alias))
    });

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::generation::{
        ConfigSelection, FinalFilterSettings, GenerateRequest, GenerationDestination,
    };
    use crate::models::workspace::{OutputFormat, TruncationSettings};

    fn string_args(args: &[OsString]) -> Vec<String> {
        args.iter().map(|a| a.to_string_lossy().into_owned()).collect()
    }

    fn assert_arg_pair(args: &[OsString], flag: &str, value: &str) {
        let values = string_args(args);
        let index = values
            .iter()
            .position(|item| item == flag)
            .unwrap_or_else(|| panic!("missing flag {flag}"));
        assert_eq!(values[index + 1], value);
    }

    fn sample_generate_request() -> GenerateRequest {
        GenerateRequest {
            operation_id: "op-1".into(),
            selected_paths: vec![],
            aliases: vec![],
            filters: FinalFilterSettings { max_size_kb: 1024 },
            truncation: TruncationSettings::default(),
            output: crate::models::generation::OutputSettings {
                format: OutputFormat::Markdown,
                tree: false,
                absolute_paths: false,
                token_model: "cl100k_base".into(),
            },
            destination: GenerationDestination::Preview,
            timeout_seconds: None,
        }
    }

    #[test]
    fn final_generation_disables_rediscovery_filters() {
        let request = sample_generate_request();
        let args = build_generate_args(&request).unwrap();
        let values = string_args(&args);

        assert!(values.contains(&"--stdin0".into()));
        assert!(values.contains(&"--no-config".into()));
        assert!(values.contains(&"--no-default-excludes".into()));
        assert!(values.contains(&"--no-gitignore".into()));
        assert!(!values.contains(&"--include".into()));
        assert!(!values.contains(&"--exclude".into()));
    }

    #[test]
    fn final_generation_passes_explicit_truncation() {
        let request = sample_generate_request();
        let args = build_generate_args(&request).unwrap();

        assert_arg_pair(&args, "--max-lines", "500");
        assert_arg_pair(&args, "--head-lines", "20");
        assert_arg_pair(&args, "--tail-lines", "10");
    }

    #[test]
    fn no_truncation_uses_single_conflict_free_flag() {
        let mut request = sample_generate_request();
        request.truncation.disabled = true;

        let args = build_generate_args(&request).unwrap();
        let values = string_args(&args);

        assert!(values.contains(&"--no-truncation".into()));
        assert!(!values.contains(&"--max-lines".into()));
        assert!(!values.contains(&"--max-line-length".into()));
    }

    #[test]
    fn scan_args_include_config_selection() {
        let request = ScanRootRequest {
            operation_id: "op-2".into(),
            root_id: "root-1".into(),
            root: "/tmp/example".into(),
            config: ConfigSelection::None,
            filters: crate::models::workspace::FilterSettings::default(),
        };

        let args = build_scan_args(&request);
        let values = string_args(&args);

        assert!(values.contains(&"--no-config".into()));
        assert!(values.contains(&"files".into()));
        assert!(values.contains(&"list".into()));
    }

    #[test]
    fn invalid_alias_rejected() {
        assert!(validate_alias("").is_err());
        assert!(validate_alias(".").is_err());
        assert!(validate_alias("..").is_err());
        assert!(validate_alias("has space").is_err());
        assert!(validate_alias("-leading-dash").is_err());
        assert!(validate_alias("valid-alias_1.2").is_ok());
    }

    #[test]
    fn duplicate_alias_roots_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_path_buf();

        let aliases = vec![
            PathAliasRequest {
                alias: "a".into(),
                root: root.clone(),
            },
            PathAliasRequest {
                alias: "b".into(),
                root,
            },
        ];

        let result = normalize_aliases(&aliases);
        assert!(result.is_err());
    }

    #[test]
    fn nested_aliases_sorted_deepest_first() {
        let dir = tempfile::tempdir().unwrap();
        let child = dir.path().join("child");
        std::fs::create_dir(&child).unwrap();

        let aliases = vec![
            PathAliasRequest {
                alias: "outer".into(),
                root: dir.path().to_path_buf(),
            },
            PathAliasRequest {
                alias: "inner".into(),
                root: child,
            },
        ];

        let result = normalize_aliases(&aliases).unwrap();
        assert_eq!(result[0].alias, "inner");
        assert_eq!(result[1].alias, "outer");
    }
}
