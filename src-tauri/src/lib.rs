use std::net::TcpListener;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OAuthPrepared {
  pub port: u16,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OAuthCallback {
  pub code: String,
  pub state: String,
}

static OAUTH_LISTENER: Mutex<Option<TcpListener>> = Mutex::new(None);

fn url_decode(s: &str) -> String {
  let mut result = String::new();
  let mut chars = s.chars();
  while let Some(c) = chars.next() {
    if c == '%' {
      let h1 = chars.next().unwrap_or('0');
      let h2 = chars.next().unwrap_or('0');
      let hex_str = format!("{}{}", h1, h2);
      if let Ok(byte) = u8::from_str_radix(&hex_str, 16) {
        result.push(byte as char);
      }
    } else if c == '+' {
      result.push(' ');
    } else {
      result.push(c);
    }
  }
  result
}

#[tauri::command]
fn start_oauth_listener() -> Result<OAuthPrepared, String> {
  // Bind to 127.0.0.1 on port 0 to allow OS to allocate an ephemeral free port
  let listener = TcpListener::bind("127.0.0.1:0")
    .map_err(|e| format!("Failed to bind to loopback address: {}", e))?;

  let port = listener.local_addr()
    .map_err(|e| format!("Failed to get local port: {}", e))?
    .port();

  listener.set_nonblocking(true)
    .map_err(|e| format!("Failed to set nonblocking mode: {}", e))?;

  let mut guard = OAUTH_LISTENER.lock().map_err(|e| e.to_string())?;
  *guard = Some(listener);

  Ok(OAuthPrepared { port })
}

#[tauri::command]
async fn wait_for_oauth_callback(expected_state: String, timeout_seconds: u64) -> Result<OAuthCallback, String> {
  let start = Instant::now();
  let timeout = Duration::from_secs(if timeout_seconds == 0 { 120 } else { timeout_seconds });

  loop {
    if start.elapsed() > timeout {
      let _ = cancel_oauth_listener();
      return Err("OAuth sign-in timed out. Please try again.".into());
    }

    let accept_result = {
      let guard = OAUTH_LISTENER.lock().map_err(|e| e.to_string())?;
      if let Some(ref listener) = *guard {
        match listener.accept() {
          Ok((stream, _)) => Some(Ok(stream)),
          Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => None,
          Err(e) => Some(Err(format!("Error accepting loopback connection: {}", e))),
        }
      } else {
        return Err("OAuth listener was cancelled.".into());
      }
    };

    if let Some(res) = accept_result {
      let mut stream = res?;
      let mut buffer = [0u8; 4096];
      let n = stream.read(&mut buffer).unwrap_or(0);
      let req_str = String::from_utf8_lossy(&buffer[..n]);

      let mut code: Option<String> = None;
      let mut state: Option<String> = None;
      let mut error: Option<String> = None;

      if let Some(first_line) = req_str.lines().next() {
        if let Some(path_start) = first_line.find("GET /") {
          let path_part = &first_line[path_start + 4..];
          let uri = path_part.split_whitespace().next().unwrap_or("");
          if let Some(q_idx) = uri.find('?') {
            let query = &uri[q_idx + 1..];
            for pair in query.split('&') {
              let mut kv = pair.split('=');
              if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                let decoded = url_decode(v);
                if k == "code" {
                  code = Some(decoded);
                } else if k == "state" {
                  state = Some(decoded);
                } else if k == "error" {
                  error = Some(decoded);
                }
              }
            }
          }
        }
      }

      let html_body = if error.is_some() {
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Sign-In Cancelled</title></head><body style='font-family:sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#ef4444;'>Google Sign-In Cancelled</h2><p>You can close this tab and return to CONVET PULSE Desktop.</p></body></html>"
      } else {
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Sign-In Successful</title></head><body style='font-family:sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#10b981;'>✓ Sign-In Successful!</h2><p>Authentication complete. You can close this tab and return to CONVET PULSE Desktop.</p><script>setTimeout(function(){ window.close(); }, 1500);</script></body></html>"
      };

      let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_body.len(),
        html_body
      );

      let _ = stream.write_all(response.as_bytes());
      let _ = stream.flush();

      let _ = cancel_oauth_listener();

      if let Some(err_msg) = error {
        return Err(format!("Google sign-in was cancelled or failed: {}", err_msg));
      }

      let received_code = code.ok_or_else(|| "Authorization code was not returned by Google".to_string())?;
      let received_state = state.ok_or_else(|| "State parameter was not returned by Google".to_string())?;

      if received_state != expected_state {
        return Err("OAuth state mismatch: possible CSRF detected.".into());
      }

      return Ok(OAuthCallback { code: received_code, state: received_state });
    }

    std::thread::sleep(Duration::from_millis(150));
  }
}

#[tauri::command]
fn cancel_oauth_listener() -> Result<(), String> {
  let mut guard = OAUTH_LISTENER.lock().map_err(|e| e.to_string())?;
  *guard = None;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
      start_oauth_listener,
      wait_for_oauth_callback,
      cancel_oauth_listener
    ]);

  #[cfg(desktop)]
  {
    builder = builder
      .plugin(tauri_plugin_updater::Builder::new().build())
      .plugin(tauri_plugin_process::init());
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
