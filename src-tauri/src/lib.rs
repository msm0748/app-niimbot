#[cfg(not(target_os = "macos"))]
compile_error!("This application is intentionally macOS-only because it uses CoreBluetooth.");

mod niimbot;
mod transport;

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;

use crate::niimbot::{LabelBitmap, LabelSize};
use crate::transport::{scan_d11h_candidates, CoreBluetoothTransport, DiscoveredPeripheral};

#[derive(Default)]
struct PrinterState {
  transport: Arc<Mutex<Option<CoreBluetoothTransport>>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrinterStatus {
  connected: bool,
  device_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintPayload {
  width: usize,
  height: usize,
  pixels: Vec<u8>,
}

#[tauri::command]
async fn printer_status(state: State<'_, PrinterState>) -> Result<PrinterStatus, String> {
  let guard = state.transport.lock().await;
  Ok(match guard.as_ref() {
    Some(transport) => PrinterStatus {
      connected: transport.is_connected().await,
      device_name: Some(transport.device_name().to_string()),
    },
    None => PrinterStatus {
      connected: false,
      device_name: None,
    },
  })
}

#[tauri::command]
async fn scan_and_connect(state: State<'_, PrinterState>) -> Result<PrinterStatus, String> {
  let transport = CoreBluetoothTransport::scan_and_connect_d11h().await?;
  let status = PrinterStatus {
    connected: true,
    device_name: Some(transport.device_name().to_string()),
  };

  *state.transport.lock().await = Some(transport);
  Ok(status)
}

#[tauri::command]
async fn scan_printers() -> Result<Vec<DiscoveredPeripheral>, String> {
  scan_d11h_candidates().await
}

#[tauri::command]
async fn print_label(
  state: State<'_, PrinterState>,
  bitmap: PrintPayload,
  quantity: u8,
  label_size: LabelSize,
) -> Result<(), String> {
  let quantity = quantity.clamp(1, 20);
  let label = LabelBitmap::new(bitmap.width, bitmap.height, bitmap.pixels, label_size)?;
  let mut guard = state.transport.lock().await;
  let transport = guard
    .as_mut()
    .ok_or_else(|| "Printer is not connected. Connect NIIMBOT D11_H first.".to_string())?;

  niimbot::print_d11h(transport, &label, quantity).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(PrinterState::default())
    .invoke_handler(tauri::generate_handler![
      printer_status,
      scan_and_connect,
      scan_printers,
      print_label
    ])
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
    .expect("error while running tauri application");
}
