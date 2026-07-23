use std::path::Path;

use crate::commands::CommandError;

fn io_command_error(error: std::io::Error) -> CommandError {
    CommandError {
        code: "io_error".into(),
        message: error.to_string(),
    }
}

/// Writes `value` as pretty JSON to `path`, first writing to a sibling
/// temporary file and renaming it into place so a crash or concurrent read
/// never observes a partially written file.
pub fn write_json_atomic<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), CommandError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(io_command_error)?;
    }

    let contents = serde_json::to_vec_pretty(value).map_err(|error| CommandError {
        code: "serialization_error".into(),
        message: error.to_string(),
    })?;

    let unique = uuid::Uuid::new_v4();
    let tmp_path = path.with_extension(format!(
        "{}.tmp-{unique}",
        path.extension().and_then(|e| e.to_str()).unwrap_or("json")
    ));

    std::fs::write(&tmp_path, &contents).map_err(io_command_error)?;
    std::fs::rename(&tmp_path, path).map_err(|error| {
        let _ = std::fs::remove_file(&tmp_path);
        io_command_error(error)
    })?;

    Ok(())
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Option<T>, CommandError> {
    if !path.is_file() {
        return Ok(None);
    }

    let bytes = std::fs::read(path).map_err(io_command_error)?;
    let value = serde_json::from_slice(&bytes).map_err(|error| CommandError {
        code: "invalid_persisted_json".into(),
        message: format!("{}: {}", path.display(), error),
    })?;

    Ok(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct Sample {
        name: String,
        count: u32,
    }

    #[test]
    fn read_json_returns_none_for_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing.json");

        let result: Option<Sample> = read_json(&path).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn write_then_read_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("sample.json");
        let value = Sample { name: "alpha".into(), count: 3 };

        write_json_atomic(&path, &value).unwrap();
        let loaded: Option<Sample> = read_json(&path).unwrap();

        assert_eq!(loaded, Some(value));
    }

    #[test]
    fn write_leaves_no_temp_file_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sample.json");

        write_json_atomic(&path, &Sample { name: "beta".into(), count: 1 }).unwrap();

        let entries: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(entries, vec![std::ffi::OsString::from("sample.json")]);
    }

    #[test]
    fn read_json_rejects_corrupt_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("corrupt.json");
        std::fs::write(&path, b"not json").unwrap();

        let result: Result<Option<Sample>, CommandError> = read_json(&path);
        assert!(result.is_err());
    }
}
