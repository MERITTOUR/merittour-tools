// ════════════════════════════════════════════════════════════════
// upload-confirm-doc — 확정서 안전 업로드 (인증 → 검증 → service_role Private 업로드 → 서명 URL)
//
// 흐름: 인증 사용자(JWT) → 역할/active 검증 → 파일명·경로·MIME·용량 검증
//       → service_role 로 Private Storage(confirm-docs) 업로드 → 서명 URL 반환
//
// 요청(JSON, Authorization: Bearer <user JWT> 필수):
//   { kind: "confirm"|"quote"|"itinerary", event_seq: string,
//     contentType: string, dataBase64: string, expiresIn?: number }
//
// 환경변수(Supabase secrets · 값은 서버에만):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ALLOW_ORIGIN
//   (service_role/anon 키는 절대 프론트/저장소에 두지 않는다)
//
// 보안 원칙: 파일 경로는 서버가 생성(클라이언트 경로 미사용) → 경로 조작 방지.
//            로그에 개인정보·파일 내용·JWT 출력 금지.
// ════════════════════════════════════════════════════════════════

const SB_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SB_ANON  = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const BUCKET   = "confirm-docs";

const ALLOWED_KIND = new Set(["confirm", "quote", "itinerary"]);
const ALLOWED_ROLES = new Set(["admin", "sales", "manage"]);
const MIME_EXT: Record<string, string> = {
  "text/html": "html",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const EVENT_SEQ_RE = /^[A-Za-z0-9_-]{1,64}$/;

function allowOrigin(): string {
  // 기본값을 '*' 로 두지 않는다. 미설정 시 동일 출처만(빈 값) → 운영에서 반드시 설정.
  return Deno.env.get("ALLOW_ORIGIN") ?? "";
}
function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowOrigin(),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  };
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors() } });
}

async function getUser(jwt: string): Promise<{ id: string; email?: string } | null> {
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SB_ANON || SB_SVC },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? { id: u.id, email: u.email } : null;
}

async function getAccess(userId: string): Promise<{ role: string; active: boolean } | null> {
  const r = await fetch(
    `${SB_URL}/rest/v1/user_access?select=role,active&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}` } },
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return rows[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SB_URL || !SB_SVC) return json({ error: "server not configured" }, 500);

  // 1) 인증(JWT)
  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const user = await getUser(jwt);
  if (!user) return json({ error: "unauthorized" }, 401);

  // 2) 권한/active
  const acc = await getAccess(user.id);
  if (!acc || !acc.active) return json({ error: "forbidden (inactive)" }, 403);
  if (!ALLOWED_ROLES.has(acc.role)) return json({ error: "forbidden (role)" }, 403);

  // 3) 입력 검증
  let p: { kind?: string; event_seq?: string; contentType?: string; dataBase64?: string; expiresIn?: number };
  try { p = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const kind = String(p.kind ?? "confirm");
  if (!ALLOWED_KIND.has(kind)) return json({ error: "invalid kind" }, 400);
  const eventSeq = String(p.event_seq ?? "");
  if (!EVENT_SEQ_RE.test(eventSeq)) return json({ error: "invalid event_seq" }, 400);
  const ct = String(p.contentType ?? "");
  const ext = MIME_EXT[ct];
  if (!ext) return json({ error: "unsupported contentType" }, 415);
  const b64 = String(p.dataBase64 ?? "");
  if (!b64) return json({ error: "empty file" }, 400);

  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
  catch { return json({ error: "invalid base64" }, 400); }
  if (bytes.byteLength === 0) return json({ error: "empty file" }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: "file too large" }, 413);

  // 4) 경로는 서버가 생성(클라이언트 경로 미사용) → 조작 방지
  const path = `${kind}/${eventSeq}.${ext}`;

  // 5) service_role 로 업로드(덮어쓰기 허용: 재발급 시나리오)
  const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, "content-type": ct, "x-upsert": "true" },
    body: bytes,
  });
  if (!up.ok) return json({ error: "upload failed", status: up.status }, 502);

  // 6) 서명 URL(최소 만료) 발급
  const ttl = Math.min(Math.max(Number(p.expiresIn) || 90 * 24 * 3600, 3600), 90 * 24 * 3600);
  const sg = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: ttl }),
  });
  if (!sg.ok) return json({ error: "sign failed", status: sg.status }, 502);
  const sj = await sg.json().catch(() => ({}));
  const signed = sj.signedURL ?? sj.signedUrl;
  const link = signed ? `${SB_URL}/storage/v1${signed}` : null;

  // 로그: 개인정보·파일내용·JWT 금지. 경로/역할 정도만(운영 판단).
  return json({ ok: true, path, link });
});
