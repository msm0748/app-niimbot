# NIIMBOT D11

macOS 전용 NIIMBOT D11_H 라벨 프린터 앱입니다.  
Tauri + Svelte로 만든 데스크톱 앱이며, Bluetooth 연결은 Web Bluetooth가 아니라 Rust 백엔드에서 macOS CoreBluetooth 계열 BLE 전송으로 처리합니다.

## 주요 기능

- NIIMBOT D11_H Bluetooth 검색 및 연결
- 연결 상태 표시
- 텍스트 라벨 출력
- 지원 라벨 크기
  - `12 x 22 mm`
  - `12 x 30 mm`
- 출력 수량 지정
  - 기본값 `1`
  - 최소 `1`, 최대 `20`
- 출력 성공 후 입력창 초기화 및 포커스 복귀
- Enter 키로 바로 출력
  - 한글 IME 조합 중 Enter는 출력으로 처리하지 않음
- 출력 기록 저장
  - `text`
  - `labelSize`
  - `printedAt`
- 같은 이름 중복 출력 방지
- 출력 기록 개별 삭제 / 전체 삭제
- 삭제 확인 모달
  - Escape 또는 배경 클릭으로 닫기
  - Enter로 확인 버튼 실행

## 기술 구조

- Frontend: Svelte 5 + TypeScript + Vite
- UI: Tailwind CSS + daisyUI + Lucide icons
- Desktop: Tauri v2
- Backend: Rust
- Bluetooth: `btleplug` macOS CoreBluetooth backend
- 대상 프린터: NIIMBOT D11_H

핵심 파일:

- Svelte 앱: `src/App.svelte`
- 라벨 렌더링/비트맵 생성: `src/lib/label.ts`
- 출력 기록 관리: `src/lib/history.ts`
- Tauri 프린터 어댑터: `src/lib/printer.ts`
- Tauri command: `src-tauri/src/lib.rs`
- Bluetooth transport: `src-tauri/src/transport.rs`
- NIIMBOT D11_H 출력 프로토콜: `src-tauri/src/niimbot.rs`

## 개발 환경 준비

이 앱은 macOS 전용입니다.

필요한 것:

- macOS 12 이상
- Node.js
- npm
- Rust toolchain
- Xcode Command Line Tools

### 1. Xcode Command Line Tools 설치

```sh
xcode-select --install
```

이미 설치되어 있으면 안내 메시지만 나오고 넘어갑니다.

### 2. Rust 설치

표준 설치 방식은 `rustup`입니다.

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

현재 터미널에 Rust 경로를 반영합니다.

```sh
. "$HOME/.cargo/env"
```

설치 확인:

```sh
rustc --version
cargo --version
```

### 3. 의존성 설치

```sh
npm install
```

## 개발 모드로 실행

Tauri 개발 모드로 실행합니다.

```sh
. "$HOME/.cargo/env"
npm run tauri dev
```

이 명령은 Vite 개발 서버와 Tauri 앱을 함께 실행합니다.

## 테스트

Frontend 타입 검사:

```sh
npm run check
```

Frontend 테스트:

```sh
npm test
```

Rust 테스트:

```sh
. "$HOME/.cargo/env"
cargo test --manifest-path src-tauri/Cargo.toml
```

전체 확인 예시:

```sh
. "$HOME/.cargo/env"
npm run check
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## 앱 빌드

개발용 macOS `.app` 번들을 만들려면:

```sh
. "$HOME/.cargo/env"
npx tauri build --debug --bundles app
```

빌드된 앱 위치:

```sh
src-tauri/target/debug/bundle/macos/NIIMBOT D11.app
```

Finder에서 폴더 열기:

```sh
open "src-tauri/target/debug/bundle/macos"
```

앱 바로 실행:

```sh
open "src-tauri/target/debug/bundle/macos/NIIMBOT D11.app"
```

## 배포용 빌드

release 빌드는 아래 명령을 사용합니다.

```sh
. "$HOME/.cargo/env"
npx tauri build --bundles app
```

release 앱 위치:

```sh
src-tauri/target/release/bundle/macos/NIIMBOT D11.app
```

DMG까지 만들고 싶으면:

```sh
. "$HOME/.cargo/env"
npx tauri build
```

설정상 `app`과 `dmg` 타깃이 활성화되어 있습니다. 다만 로컬 macOS 환경에 따라 Tauri의 DMG 생성 스크립트가 실패할 수 있습니다. 이 경우 `.app` 번들은 정상 생성될 수 있으므로 먼저 `--bundles app`으로 앱 번들을 확인하세요.

## macOS Bluetooth 권한

앱이 프린터를 찾거나 연결하려면 macOS Bluetooth 권한이 필요합니다.

확인 위치:

```text
시스템 설정 > 개인정보 보호 및 보안 > Bluetooth
```

여기에서 `NIIMBOT D11` 앱을 허용해야 합니다.

권한이 꼬였을 때는 앱을 완전히 종료한 뒤 다시 실행하고, macOS Bluetooth 권한 팝업을 다시 확인하세요.

## 사용 방법

1. NIIMBOT D11_H 전원을 켭니다.
2. 앱을 실행합니다.
3. `Scan` 버튼으로 프린터가 보이는지 확인합니다.
4. `Connect` 버튼으로 연결합니다.
5. 라벨 텍스트를 입력합니다.
6. 라벨 크기와 수량을 선택합니다.
7. `Print Label` 버튼을 누르거나 Enter 키를 눌러 출력합니다.

출력이 성공하면:

- 입력창이 비워집니다.
- 수량이 `1`로 돌아갑니다.
- 입력창에 다시 포커스됩니다.
- 출력 기록에 저장됩니다.

## 출력 기록과 중복 방지

출력 성공한 라벨은 브라우저 localStorage에 저장됩니다.

같은 `text + labelSize` 조합은 중복 저장하지 않고 최근 출력 시간만 갱신합니다.

출력 전에는 같은 `text`가 기록에 있는지 확인합니다. 라벨 크기가 달라도 같은 이름이면 중복으로 간주하고 출력하지 않습니다.

기록 항목을 클릭하면 입력창과 라벨 크기로 다시 불러옵니다.

## 문제 해결

### 프린터가 검색되지 않을 때

- D11_H 전원이 켜져 있는지 확인
- 프린터가 Mac 가까이에 있는지 확인
- macOS Bluetooth가 켜져 있는지 확인
- 시스템 설정에서 앱의 Bluetooth 권한 확인
- 앱에서 `Scan` 버튼을 눌러 주변 BLE 기기 목록 확인

### 연결은 되는데 출력이 이상할 때

- 라벨이 제대로 장착되어 있는지 확인
- 배터리가 충분한지 확인
- 프린터 덮개가 닫혀 있는지 확인
- 앱에 표시되는 프린터 에러 메시지 확인

### Rust 명령을 찾을 수 없을 때

현재 터미널에 Rust 경로를 다시 반영합니다.

```sh
. "$HOME/.cargo/env"
```

## GitHub

원격 저장소:

```text
https://github.com/msm0748/app-niimbot.git
```
