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
  let mut result = Vec::new();
  let bytes = s.as_bytes();
  let mut i = 0;
  while i < bytes.len() {
    if bytes[i] == b'%' && i + 2 < bytes.len() {
      if let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..=i + 2]).unwrap_or(""), 16) {
        result.push(b);
        i += 3;
        continue;
      }
    } else if bytes[i] == b'+' {
      result.push(b' ');
      i += 1;
      continue;
    }
    result.push(bytes[i]);
    i += 1;
  }
  String::from_utf8_lossy(&result).into_owned()
}

#[tauri::command]
fn start_oauth_listener() -> Result<OAuthPrepared, String> {
  // Bind strictly to 127.0.0.1 on port 0 to allow the OS kernel to allocate an ephemeral free port
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
      let mut is_oauth_callback = false;

      if let Some(first_line) = req_str.lines().next() {
        if let Some(path_start) = first_line.find("GET /") {
          let path_part = &first_line[path_start + 4..];
          let uri = path_part.split_whitespace().next().unwrap_or("");
          
          // Ignore favicon and asset requests, keep listener alive
          if uri.starts_with("/favicon.ico") || uri == "/favicon.ico" {
            let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(not_found.as_bytes());
            let _ = stream.flush();
            continue;
          }

          if let Some(q_idx) = uri.find('?') {
            let query = &uri[q_idx + 1..];
            for pair in query.split('&') {
              let mut kv = pair.split('=');
              if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                let decoded = url_decode(v);
                if k == "code" {
                  code = Some(decoded);
                  is_oauth_callback = true;
                } else if k == "state" {
                  state = Some(decoded);
                  is_oauth_callback = true;
                } else if k == "error" {
                  error = Some(decoded);
                  is_oauth_callback = true;
                }
              }
            }
          }
        }
      }

      // If a non-OAuth request hit the port, ignore and keep waiting
      if !is_oauth_callback {
        let empty_res = "HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(empty_res.as_bytes());
        let _ = stream.flush();
        continue;
      }

      let (html_body, is_success) = if let Some(ref err_msg) = error {
        (
          format!("<!DOCTYPE html><html><head><meta charset='utf-8'><title>Sign-In Cancelled</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#ef4444;'>Google Sign-In Cancelled</h2><p>{}</p><p style='color:#9ca3af;font-size:14px;'>You can close this tab and return to CONVET PULSE Desktop.</p></body></html>", err_msg),
          false
        )
      } else if let Some(ref received_state) = state {
        if received_state != &expected_state {
          (
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Security Error</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#ef4444;'>Security Verification Failed</h2><p>OAuth state mismatch. Possible cross-site request forgery attempt.</p><p style='color:#9ca3af;font-size:14px;'>You can close this tab and return to CONVET PULSE Desktop.</p></body></html>".to_string(),
            false
          )
        } else {
          (
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Sign-In Successful</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#10b981;'>✓ Sign-In Successful!</h2><p>Authentication complete. You can close this tab and return to CONVET PULSE Desktop.</p><script>setTimeout(function(){ window.close(); }, 1500);</script></body></html>".to_string(),
            true
          )
        }
      } else {
        (
          "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Invalid Request</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#0f1117;color:#fff;text-align:center;padding:50px;'><h2 style='color:#ef4444;'>Invalid OAuth Callback</h2><p>Missing state parameter.</p></body></html>".to_string(),
          false
        )
      };

      let status_code = if is_success { "200 OK" } else { "400 Bad Request" };
      let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status_code,
        html_body.len(),
        html_body
      );

      let _ = stream.write_all(response.as_bytes());
      let _ = stream.flush();

      // Ensure listener is cleaned up immediately after handling callback
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

    std::thread::sleep(Duration::from_millis(100));
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
