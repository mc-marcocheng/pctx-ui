use std::{path::Path, process::Stdio, time::Duration};

use serde::Serialize;
use thiserror::Error;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::Command,
};
use tokio_util::sync::CancellationToken;

pub const PREVIEW_STDOUT_LIMIT: usize = 256 * 1024 * 1024;
pub const DISCOVERY_STDOUT_LIMIT: usize = 64 * 1024 * 1024;
pub const STDERR_LIMIT: usize = 4 * 1024 * 1024;
pub const PROBE_LIMIT: usize = 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct ProcessOutput {
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

#[derive(Debug, Error)]
pub enum RunnerError {
    #[error("failed to start pctx at {path}: {source}")]
    Spawn {
        path: std::path::PathBuf,
        source: std::io::Error,
    },

    #[error("pctx operation was cancelled")]
    Cancelled,

    #[error("pctx operation timed out")]
    Timeout,

    #[error("pctx stdout exceeded the configured limit")]
    StdoutLimit,

    #[error("pctx stderr exceeded the configured limit")]
    StderrLimit,

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

async fn read_capped<R>(
    mut reader: R,
    limit: usize,
    overflow: CancellationToken,
    is_stdout: bool,
) -> Result<Vec<u8>, RunnerError>
where
    R: AsyncRead + Unpin,
{
    let mut output = Vec::new();
    let mut chunk = [0u8; 32 * 1024];

    loop {
        let count = reader.read(&mut chunk).await?;
        if count == 0 {
            break;
        }

        if output.len().saturating_add(count) > limit {
            overflow.cancel();
            return Err(if is_stdout {
                RunnerError::StdoutLimit
            } else {
                RunnerError::StderrLimit
            });
        }

        output.extend_from_slice(&chunk[..count]);
    }

    Ok(output)
}

#[allow(clippy::too_many_arguments)]
pub async fn run_process(
    executable: &Path,
    args: &[std::ffi::OsString],
    cwd: Option<&Path>,
    stdin_bytes: &[u8],
    cancellation: CancellationToken,
    timeout: Duration,
    stdout_limit: usize,
    stderr_limit: usize,
) -> Result<ProcessOutput, RunnerError> {
    let mut command = Command::new(executable);
    command
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|source| RunnerError::Spawn {
        path: executable.to_path_buf(),
        source,
    })?;

    let mut stdin = child.stdin.take().expect("stdin configured as piped");
    let stdout = child.stdout.take().expect("stdout configured as piped");
    let stderr = child.stderr.take().expect("stderr configured as piped");

    let stdin_data = stdin_bytes.to_vec();
    let stdin_task = tokio::spawn(async move {
        stdin.write_all(&stdin_data).await?;
        stdin.shutdown().await
    });

    let stdout_overflow = CancellationToken::new();
    let stderr_overflow = CancellationToken::new();

    let stdout_task = tokio::spawn(read_capped(
        stdout,
        stdout_limit,
        stdout_overflow.clone(),
        true,
    ));

    let stderr_task = tokio::spawn(read_capped(
        stderr,
        stderr_limit,
        stderr_overflow.clone(),
        false,
    ));

    let wait_result = tokio::select! {
        result = child.wait() => result.map_err(RunnerError::Io),
        _ = cancellation.cancelled() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Err(RunnerError::Cancelled)
        }
        _ = stdout_overflow.cancelled() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Err(RunnerError::StdoutLimit)
        }
        _ = stderr_overflow.cancelled() => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Err(RunnerError::StderrLimit)
        }
        _ = tokio::time::sleep(timeout) => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            Err(RunnerError::Timeout)
        }
    };

    let status = wait_result?;

    stdin_task
        .await
        .map_err(|e| RunnerError::Io(std::io::Error::other(e)))??;

    let stdout = stdout_task
        .await
        .map_err(|e| RunnerError::Io(std::io::Error::other(e)))??;

    let stderr = stderr_task
        .await
        .map_err(|e| RunnerError::Io(std::io::Error::other(e)))??;

    Ok(ProcessOutput {
        exit_code: status.code().unwrap_or(1),
        stdout,
        stderr,
    })
}
