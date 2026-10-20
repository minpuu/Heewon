/**
 * 브라우저 저장소 래퍼. 시크릿 모드·권한 차단 등으로 접근이 실패해도 앱이 깨지지 않게 한다.
 * 저장소 값은 편의 설정에만 쓰며, 반드시 있어야 하는 상태는 저장하지 않는다.
 */
type StorageKind = "local" | "session";

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: StorageKind, key: string): T | null {
  try {
    const raw = getStorage(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    getStorage(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시한다. 기능은 저장 없이도 동작해야 한다.
  }
}
