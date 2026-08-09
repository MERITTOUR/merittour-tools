// MERITTOUR 문서 번역 (Claude Vision) — MVP
//
// tools/translate/ 도구가 호출하는 Supabase Edge Function.
// 이미지(JPG/PNG/WebP/GIF)·스캔 PDF를 받아 Claude Vision으로 OCR+번역한다.
// API 키는 클라이언트에 노출하지 않고 이 함수의 secret에만 둔다.
//
// 요청 본문(JSON):
//   { data: "<base64, 줄바꿈 없음>",
//     mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "application/pdf",
//     target?: "ko" | "en" | "ja",   // 기본 ko (한국어로 번역)
//     model?:  "sonnet" | "opus" }   // 기본 sonnet (가성비)
//
// 응답: { ok: true, text, model, usage } | { error }
//
// 환경변수(Supabase secrets):
//   ANTHROPIC_API_KEY            (필수)
//   TRANSLATE_MODEL              (선택, 기본 claude-sonnet-4-6)
//   ALLOW_ORIGIN                 (CORS, 기본 *)
//
// 배포(인증 생략 — 게이트 뒤에서 호출하므로 알림톡 함수와 동일 정책):
//   supabase functions deploy translate --no-verify-jwt

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

const MODELS: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
};

const TARGET_LABEL: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function env(k: string, d = ""): string {
  return Deno.env.get(k) ?? d;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env("ALLOW_ORIGIN", "*"),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

// 번역 지시문 — 참고용 번역임을 명확히 하고, 원문 구조를 유지하도록 유도.
function buildPrompt(target: string): string {
  const lang = TARGET_LABEL[target] ?? "한국어";
  return [
    `첨부된 문서(계약서·정산서 등 비즈니스 문서)를 ${lang}(으)로 번역하세요.`,
    ``,
    `규칙:`,
    `- 원문의 문단·항목 구조를 그대로 유지합니다.`,
    `- 표는 표 형태(마크다운 표)로 옮깁니다.`,
    `- 숫자·금액·날짜·고유명사(회사명/인명)는 임의로 바꾸지 말고 원문 그대로 두되, 필요하면 괄호로 ${lang} 병기합니다.`,
    `- 판독이 불가능한 부분은 [판독불가]로 표시합니다.`,
    `- 번역 결과만 출력하고, 설명·머리말·맺음말은 붙이지 않습니다.`,
  ].join("\n");
}

interface ReqBody {
  data?: string;
  mediaType?: string;
  target?: string;
  model?: string;
}

/* ── 호출자 확인 (fail-closed) ────────────────────────────────────
   예전에는 검사가 아예 없었다. 이 함수는 손님에게 카카오 알림톡을 쏘므로,
   주소만 알면 누구나 전 고객에게 문자를 보낼 수 있는 상태였다.
   Supabase 로그인 토큰을 받아 프로젝트에 직접 물어 확인한다.
   환경변수가 없으면 **막는다** — 설정을 빠뜨렸을 때 열리는 쪽으로 기울면 안 된다. */
async function requireUser(req: Request): Promise<Response | null> {
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return json({ error: "서버 설정이 비어 있어 요청을 막았습니다(SUPABASE_URL/ANON_KEY)." }, 500);
  }
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json({ error: "로그인이 필요합니다." }, 401);
  try {
    const r = await fetch(url.replace(/\/+$/, "") + "/auth/v1/user", {
      headers: { apikey: anon, authorization: auth },
    });
    if (!r.ok) return json({ error: "로그인이 만료되었거나 올바르지 않습니다." }, 401);
    const u = await r.json().catch(() => null);
    if (!u || !u.id) return json({ error: "로그인이 필요합니다." }, 401);
  } catch {
    return json({ error: "로그인을 확인하지 못했습니다." }, 401);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const denied = await requireUser(req);
  if (denied) return denied;

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다" }, 500);

  let payload: ReqBody;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const data = (payload.data ?? "").trim();
  const mediaType = (payload.mediaType ?? "").trim();
  const target = payload.target ?? "ko";
  if (!data) return json({ error: "data(base64) 가 비어 있습니다" }, 400);

  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.includes(mediaType)) {
    return json({ error: `지원하지 않는 형식입니다: ${mediaType || "(없음)"}` }, 400);
  }

  // 파일 블록 — 이미지/PDF 모두 base64 source 로 텍스트 앞에 배치.
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  const model =
    MODELS[payload.model ?? ""] ?? env("TRANSLATE_MODEL", "claude-sonnet-4-6");

  const body = {
    model,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [fileBlock, { type: "text", text: buildPrompt(target) }],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: "Anthropic 호출 실패: " + String(e instanceof Error ? e.message : e) }, 502);
  }

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ error: result?.error?.message ?? `Anthropic 오류 (${res.status})`, status: res.status }, 502);
  }

  // 거부(refusal)·기타 비정상 종료를 먼저 확인.
  if (result?.stop_reason === "refusal") {
    return json({ error: "모델이 이 문서 번역을 거부했습니다(안전 정책). 다른 문서로 시도해 주세요." }, 422);
  }

  const text = Array.isArray(result?.content)
    ? result.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim()
    : "";
  if (!text) return json({ error: "번역 결과가 비어 있습니다", stop_reason: result?.stop_reason }, 502);

  return json({ ok: true, text, model: result?.model ?? model, usage: result?.usage ?? null });
});
