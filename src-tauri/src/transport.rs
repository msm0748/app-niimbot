use std::time::Duration;

use btleplug::api::{
  Central, CharPropFlags, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use serde::Serialize;
use tokio::time::sleep;
use uuid::Uuid;

const SCAN_SECONDS: u64 = 10;
const NIIMBOT_SERVICE: Uuid = Uuid::from_u128(0xe781_0a71_73ae_499d_8c15_faa9_aef0_c3f2);
const NIIMBOT_ADVERTISEMENT_SERVICE: Uuid =
  Uuid::from_u128(0x0000_fef3_0000_1000_8000_0080_5f9b_34fb);
const NIIMBOT_WRITE: Uuid = Uuid::from_u128(0xbef8_d6c9_9c21_4c9e_b632_bd58_c100_9f9f);
const NIIMBOT_NOTIFY: Uuid = Uuid::from_u128(0xbef8_d6c9_9c21_4c9e_b632_bd58_c100_9f9e);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPeripheral {
  pub name: String,
  pub services: Vec<String>,
  pub matched: bool,
}

pub struct CoreBluetoothTransport {
  peripheral: Peripheral,
  write_char: btleplug::api::Characteristic,
  notify_char: Option<btleplug::api::Characteristic>,
  device_name: String,
}

impl CoreBluetoothTransport {
  pub async fn scan_and_connect_d11h() -> Result<Self, String> {
    let adapter = default_adapter().await?;

    let peripherals = scan_peripherals(&adapter).await?;

    let mut fallback: Option<(Peripheral, String)> = None;
    let mut seen: Vec<DiscoveredPeripheral> = Vec::new();
    for peripheral in peripherals {
      let properties = peripheral
        .properties()
        .await
        .map_err(|error| format!("Unable to read peripheral properties: {error}"))?;
      let Some(properties) = properties else {
        continue;
      };
      let name = properties
        .local_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "(unnamed BLE device)".to_string());
      let has_niimbot_service = properties.services.iter().any(|uuid| *uuid == NIIMBOT_SERVICE);
      let has_advertisement_service = properties
        .services
        .iter()
        .any(|uuid| *uuid == NIIMBOT_ADVERTISEMENT_SERVICE);
      let looks_like_d11h = is_niimbot_name(&name);
      let matched = has_niimbot_service || has_advertisement_service || looks_like_d11h;

      seen.push(DiscoveredPeripheral {
        name: name.clone(),
        services: properties.services.iter().map(|uuid| uuid.to_string()).collect(),
        matched,
      });

      if matched {
        fallback = Some((peripheral, name));
        if has_niimbot_service || looks_like_d11h {
          break;
        }
      }
    }

    let (peripheral, device_name) = fallback.ok_or_else(|| not_found_message(&seen))?;

    peripheral
      .connect()
      .await
      .map_err(|error| format!("Could not connect to NIIMBOT D11_H: {error}"))?;
    peripheral
      .discover_services()
      .await
      .map_err(|error| format!("Could not discover NIIMBOT BLE characteristics: {error}"))?;

    let chars = peripheral.characteristics();
    let combined_char = chars
      .iter()
      .find(|ch| {
        ch.properties.contains(CharPropFlags::NOTIFY)
          && (ch.properties.contains(CharPropFlags::WRITE_WITHOUT_RESPONSE)
            || ch.properties.contains(CharPropFlags::WRITE))
      })
      .cloned();

    let write_char = combined_char
      .as_ref()
      .or_else(|| chars.iter().find(|ch| ch.uuid == NIIMBOT_WRITE))
      .cloned()
      .or_else(|| {
        chars
          .iter()
          .find(|ch| ch.properties.contains(CharPropFlags::WRITE_WITHOUT_RESPONSE))
          .cloned()
      })
      .or_else(|| {
        chars
          .iter()
          .find(|ch| ch.properties.contains(CharPropFlags::WRITE))
          .cloned()
      })
      .ok_or_else(|| {
        format!(
          "Connected to {device_name}, but no writable NIIMBOT BLE characteristic was found."
        )
      })?;

    let notify_char = combined_char.or_else(|| {
      chars
      .iter()
      .find(|ch| ch.uuid == NIIMBOT_NOTIFY)
      .or_else(|| chars.iter().find(|ch| ch.properties.contains(CharPropFlags::NOTIFY)))
      .cloned()
    });

    if let Some(ch) = &notify_char {
      let _ = peripheral.subscribe(ch).await;
    }

    Ok(Self {
      peripheral,
      write_char,
      notify_char,
      device_name,
    })
  }

  pub fn device_name(&self) -> &str {
    &self.device_name
  }

  pub async fn is_connected(&self) -> bool {
    self.peripheral.is_connected().await.unwrap_or(false)
  }

  pub async fn write_packet(&self, bytes: &[u8]) -> Result<(), String> {
    if !self.is_connected().await {
      return Err("Printer disconnected. Reconnect NIIMBOT D11_H and try again.".to_string());
    }

    self
      .peripheral
      .write(&self.write_char, bytes, WriteType::WithoutResponse)
      .await
      .map_err(|error| format!("Failed to send print packet: {error}"))?;
    sleep(Duration::from_millis(8)).await;
    Ok(())
  }

  #[allow(dead_code)]
  pub fn has_notify(&self) -> bool {
    self.notify_char.is_some()
  }
}

pub async fn scan_d11h_candidates() -> Result<Vec<DiscoveredPeripheral>, String> {
  let adapter = default_adapter().await?;
  let peripherals = scan_peripherals(&adapter).await?;
  let mut seen = Vec::new();

  for peripheral in peripherals {
    let Some(properties) = peripheral
      .properties()
      .await
      .map_err(|error| format!("Unable to read peripheral properties: {error}"))?
    else {
      continue;
    };
    let name = properties
      .local_name
      .filter(|value| !value.trim().is_empty())
      .unwrap_or_else(|| "(unnamed BLE device)".to_string());
    let has_niimbot_service = properties.services.iter().any(|uuid| *uuid == NIIMBOT_SERVICE);
    let has_advertisement_service = properties
      .services
      .iter()
      .any(|uuid| *uuid == NIIMBOT_ADVERTISEMENT_SERVICE);
    let matched = has_niimbot_service || has_advertisement_service || is_niimbot_name(&name);

    seen.push(DiscoveredPeripheral {
      name,
      services: properties.services.iter().map(|uuid| uuid.to_string()).collect(),
      matched,
    });
  }

  Ok(seen)
}

async fn default_adapter() -> Result<Adapter, String> {
  let manager = Manager::new()
    .await
    .map_err(|error| format!("Could not open CoreBluetooth manager: {error}"))?;
  let adapters = manager
    .adapters()
    .await
    .map_err(|error| format!("Could not list Bluetooth adapters: {error}"))?;

  adapters
    .into_iter()
    .next()
    .ok_or_else(|| "No Bluetooth adapter is available on this Mac.".to_string())
}

async fn scan_peripherals(adapter: &Adapter) -> Result<Vec<Peripheral>, String> {
  adapter
    .start_scan(ScanFilter::default())
    .await
    .map_err(|error| format!("Bluetooth scan failed. Check macOS Bluetooth permission: {error}"))?;

  sleep(Duration::from_secs(SCAN_SECONDS)).await;

  let peripherals = adapter
    .peripherals()
    .await
    .map_err(|error| format!("Unable to read Bluetooth peripherals: {error}"))?;

  let _ = adapter.stop_scan().await;
  Ok(peripherals)
}

fn is_niimbot_name(name: &str) -> bool {
  let normalized = name
    .chars()
    .filter(|ch| ch.is_ascii_alphanumeric())
    .collect::<String>()
    .to_uppercase();

  normalized.contains("NIIMBOT")
    || normalized.contains("D11")
    || normalized.contains("D110")
    || normalized.contains("D11H")
}

fn not_found_message(seen: &[DiscoveredPeripheral]) -> String {
  if seen.is_empty() {
    return "NIIMBOT D11_H was not found. No BLE peripherals were visible during scan. Check macOS Bluetooth permission, turn the printer on, and keep it close to the Mac.".to_string();
  }

  let names = seen
    .iter()
    .take(12)
    .map(|item| {
      if item.services.is_empty() {
        item.name.clone()
      } else {
        format!("{} [{}]", item.name, item.services.join(", "))
      }
    })
    .collect::<Vec<_>>()
    .join("; ");

  format!(
    "NIIMBOT D11_H was not found. Scanned {} BLE device(s): {}",
    seen.len(),
    names
  )
}
