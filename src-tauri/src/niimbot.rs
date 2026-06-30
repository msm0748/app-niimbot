use serde::Deserialize;
use tokio::time::{sleep, Duration};

use crate::transport::CoreBluetoothTransport;

#[derive(Debug, Clone, Copy, Deserialize)]
pub enum LabelSize {
  #[serde(rename = "12x22")]
  Mm12x22,
  #[serde(rename = "12x30")]
  Mm12x30,
}

impl LabelSize {
  fn dimensions(self) -> (usize, usize) {
    match self {
      LabelSize::Mm12x22 => (264, 144),
      LabelSize::Mm12x30 => (360, 144),
    }
  }
}

#[derive(Debug)]
pub struct LabelBitmap {
  width: usize,
  height: usize,
  pixels: Vec<u8>,
  label_size: LabelSize,
}

impl LabelBitmap {
  pub fn new(
    width: usize,
    height: usize,
    pixels: Vec<u8>,
    label_size: LabelSize,
  ) -> Result<Self, String> {
    let expected = label_size.dimensions();
    if (width, height) != expected {
      return Err(format!(
        "Invalid bitmap dimensions for D11_H. Expected {}x{}, got {}x{}.",
        expected.0, expected.1, width, height
      ));
    }
    if pixels.len() != width * height {
      return Err(format!(
        "Invalid bitmap payload. Expected {} pixels, got {}.",
        width * height,
        pixels.len()
      ));
    }

    Ok(Self {
      width,
      height,
      pixels,
      label_size,
    })
  }

  fn encoded_rows(&self) -> Vec<EncodedRow> {
    let mut rows: Vec<EncodedRow> = Vec::new();

    for row_number in 0..self.width {
      let row_data = self.pack_printhead_row(row_number);
      let black_pixels_count = count_black_pixels(&row_data);
      let next = if black_pixels_count == 0 {
        EncodedRow::Void {
          row_number,
          repeat: 1,
        }
      } else {
        EncodedRow::Pixels {
          row_number,
          repeat: 1,
          row_data,
          black_pixels_count,
        }
      };

      if let Some(last) = rows.last_mut() {
        if last.try_merge(&next) {
          continue;
        }
      }
      rows.push(next);
    }

    rows
  }

  fn pack_printhead_row(&self, row_number: usize) -> Vec<u8> {
    let printhead_pixels = self.label_size.printhead_pixels_padded();
    let printable_pixels = self.label_size.printhead_pixels();
    let mut row = vec![0u8; printhead_pixels / 8];

    for col in 0..printable_pixels {
      if self.pixel_for_left_direction(row_number, col) {
        row[col / 8] |= 0x80 >> (col % 8);
      }
    }

    row
  }

  fn pixel_for_left_direction(&self, row: usize, col: usize) -> bool {
    let x = row;
    let y = self.height - 1 - col;
    self.pixels[y * self.width + x] != 0
  }
}

impl LabelSize {
  fn printhead_pixels(self) -> usize {
    match self {
      LabelSize::Mm12x22 | LabelSize::Mm12x30 => 142,
    }
  }

  fn printhead_pixels_padded(self) -> usize {
    144
  }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum EncodedRow {
  Void {
    row_number: usize,
    repeat: u8,
  },
  Pixels {
    row_number: usize,
    repeat: u8,
    row_data: Vec<u8>,
    black_pixels_count: usize,
  },
}

impl EncodedRow {
  fn try_merge(&mut self, next: &EncodedRow) -> bool {
    match (self, next) {
      (
        EncodedRow::Void { repeat, .. },
        EncodedRow::Void { .. },
      ) if *repeat < u8::MAX => {
        *repeat += 1;
        true
      }
      (
        EncodedRow::Pixels {
          repeat,
          row_data,
          ..
        },
        EncodedRow::Pixels {
          row_data: next_data,
          ..
        },
      ) if row_data == next_data && *repeat < u8::MAX => {
        *repeat += 1;
        true
      }
      _ => false,
    }
  }
}

fn count_black_pixels(data: &[u8]) -> usize {
  data.iter().map(|byte| byte.count_ones() as usize).sum()
}

fn count_parts_for_bitmap_packet(data: &[u8], printhead_pixels: usize) -> [u8; 3] {
  let total = count_black_pixels(data);
  let chunk_size = printhead_pixels / 8 / 3;
  let split = data.len() <= chunk_size * 3;

  if !split {
    let [hi, lo] = u16be(total as u16);
    return [0, hi, lo];
  }

  let mut parts = [0u8; 3];
  for (byte_number, value) in data.iter().enumerate() {
    let chunk_index = byte_number / chunk_size;
    if chunk_index > 2 {
      continue;
    }
    for bit_number in 0..8 {
      if value & (1 << bit_number) != 0 {
        parts[chunk_index] = parts[chunk_index].saturating_add(1);
      }
    }
  }

  parts
}

fn index_pixels(data: &[u8]) -> Vec<u8> {
  let mut indexes = Vec::new();
  for (byte_pos, byte) in data.iter().enumerate() {
    for bit_pos in 0..8 {
      if byte & (1 << (7 - bit_pos)) != 0 {
        indexes.extend(u16be((byte_pos * 8 + bit_pos) as u16));
      }
    }
  }
  indexes
}

#[allow(dead_code)]
fn legacy_protocol_rows(bitmap: &LabelBitmap) -> impl Iterator<Item = Vec<u8>> + '_ {
    (0..bitmap.width).map(|x| {
      let mut row = vec![0u8; bitmap.height / 8];
      for y in 0..bitmap.height {
        let pixel = bitmap.pixels[y * bitmap.width + x] != 0;
        if pixel {
          row[y / 8] |= 0x80 >> (y % 8);
        }
      }
      row
    })
}

pub async fn print_d11h(
  transport: &mut CoreBluetoothTransport,
  bitmap: &LabelBitmap,
  quantity: u8,
) -> Result<(), String> {
  send_print_init(transport, quantity).await?;
  send_print_page(transport, bitmap, quantity).await?;
  sleep(Duration::from_millis(300)).await;
  transport
    .write_packet_wait(&packet(0xf3, &[0x01]), 0xf4, "PrintEnd")
    .await?;
  Ok(())
}

async fn send_print_init(
  transport: &mut CoreBluetoothTransport,
  total_pages: u8,
) -> Result<(), String> {
  transport
    .write_packet_wait(&packet(0x21, &[0x03]), 0x31, "SetDensity")
    .await?;
  transport
    .write_packet_wait(&packet(0x23, &[0x01]), 0x33, "SetLabelType")
    .await?;

  let mut start = Vec::with_capacity(9);
  start.extend(u16be(total_pages as u16));
  start.extend([0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
  transport
    .write_packet_wait(&packet(0x01, &start), 0x02, "PrintStart")
    .await?;
  Ok(())
}

async fn send_print_page(
  transport: &mut CoreBluetoothTransport,
  bitmap: &LabelBitmap,
  quantity: u8,
) -> Result<(), String> {
  transport.write_packet(&packet(0xa3, &[0x01])).await?;

  let mut page_size = Vec::with_capacity(13);
  page_size.extend(u16be(bitmap.width as u16));
  page_size.extend(u16be(bitmap.height as u16));
  page_size.extend(u16be(quantity as u16));
  page_size.extend(u16be(0));
  page_size.extend([0x00, 0x00, 0x00]);
  page_size.extend(u16be(0));
  transport
    .write_packet_wait(&packet(0x13, &page_size), 0x14, "SetPageSize")
    .await?;

  for encoded in bitmap.encoded_rows() {
    match encoded {
      EncodedRow::Void { row_number, repeat } => {
        let mut payload = Vec::with_capacity(3);
        payload.extend(u16be(row_number as u16));
        payload.push(repeat);
        transport.write_packet(&packet(0x84, &payload)).await?;
      }
      EncodedRow::Pixels {
        row_number,
        repeat,
        row_data,
        black_pixels_count,
      } => {
        if black_pixels_count <= 6 {
          let indexes = index_pixels(&row_data);
          let counts = count_parts_for_bitmap_packet(
            &row_data,
            bitmap.label_size.printhead_pixels(),
          );
          let mut payload = Vec::with_capacity(2 + 3 + 1 + indexes.len());
          payload.extend(u16be(row_number as u16));
          payload.extend(counts);
          payload.push(repeat);
          payload.extend(indexes);
          transport.write_packet(&packet(0x83, &payload)).await?;
        } else {
          let counts = count_parts_for_bitmap_packet(
            &row_data,
            bitmap.label_size.printhead_pixels(),
          );
          let mut payload = Vec::with_capacity(2 + 3 + 1 + row_data.len());
          payload.extend(u16be(row_number as u16));
          payload.extend(counts);
          payload.push(repeat);
          payload.extend(row_data);
          transport.write_packet(&packet(0x85, &payload)).await?;
        }
      }
    }
  }

  transport
    .write_packet_wait(&packet(0xe3, &[0x01]), 0xe4, "PageEnd")
    .await?;
  Ok(())
}

fn packet(packet_type: u8, payload: &[u8]) -> Vec<u8> {
  let len = payload.len() as u8;
  let mut checksum = packet_type ^ len;
  for byte in payload {
    checksum ^= *byte;
  }

  let mut out = Vec::with_capacity(payload.len() + 7);
  out.extend([0x55, 0x55, packet_type, len]);
  out.extend(payload);
  out.extend([checksum, 0xaa, 0xaa]);
  out
}

fn u16be(value: u16) -> [u8; 2] {
  [((value >> 8) & 0x00ff) as u8, (value & 0x00ff) as u8]
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rejects_wrong_dimensions() {
    let err = LabelBitmap::new(144, 264, vec![0; 144 * 264], LabelSize::Mm12x22)
      .expect_err("wrong orientation must fail");
    assert!(err.contains("Expected 264x144"));
  }

  #[test]
  fn packs_bitmap_by_d11h_printhead_columns() {
    let mut pixels = vec![0; 264 * 144];
    pixels[143 * 264] = 1;
    pixels[135 * 264] = 1;
    let bitmap = LabelBitmap::new(264, 144, pixels, LabelSize::Mm12x22).unwrap();
    let first_row = bitmap.pack_printhead_row(0);

    assert_eq!(first_row[0], 0x80);
    assert_eq!(first_row[1], 0x80);
  }

  #[test]
  fn builds_d11h_v4_start_packet() {
    let packet = packet(0x01, &[0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);
    assert_eq!(
      packet,
      vec![0x55, 0x55, 0x01, 0x09, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x0b, 0xaa, 0xaa]
    );
  }
}
