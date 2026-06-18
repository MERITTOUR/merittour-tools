// MERITTOUR 확정서/견적서/일정표 — 알림톡 일괄 발송 (알리고 Aligo)
//
// 대시보드 ⑦ 확정서 생성의 [알림톡 일괄 발송] 버튼이 호출하는 Supabase Edge Function.
// 요청 본문(JSON):
//   { kind: "confirm" | "quote" | "itinerary",
//     recipients: [{ phone, name, eventNo, dep, prod, link }] }   // phone: 숫자만, 최대 500건
//
// 알리고 알림톡 API: https://kakaoapi.aligo.in/akv10/alimtalk/send/
//   - 카카오에서 사전 승인된 템플릿(tpl_code)과 발신프로필키(senderkey)가 반드시 필요합니다.
//   - message_N 은 승인된 템플릿 본문과 글자 단위로 일치해야 합니다(변수만 치환).
//   - 승인 템플릿이 없으면 failover(SMS/LMS) 대체발송으로 동작시킬 수 있습니다.
//
// 환경변수(Supabase secrets):
//   ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY, ALIGO_SENDER(발신번호)
//   ALIGO_TPL_CONFIRM / ALIGO_TPL_QUOTE / ALIGO_TPL_ITINERARY (문서종류별 템플릿코드)
//   ALIGO_TEST_MODE = "Y" | "N" (기본 N)
//   ALLOW_ORIGIN (CORS, 기본 *)

const ALIGO_ENDPOINT = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";

const KIND_LABEL: Record<string, string> = {
  confirm: "확정서",
  quote: "견적서",
  itinerary: "일정표",
};

function env(k: string, d = ""): string {
  return Deno.env.get(k) ?? d;
}

function tplCodeFor(kind: string): string {
  if (kind === "quote") return env("ALIGO_TPL_QUOTE");
  if (kind === "itinerary") return env("ALIGO_TPL_ITINERARY");
  return env("ALIGO_TPL_CONFIRM");
}

// 승인된 템플릿 본문과 일치해야 함 — 템플릿 변경 시 이 문구도 함께 수정할 것.
// 링크(URL)는 본문이 아니라 웹링크 버튼으로 넣는다(카카오 알림톡 규칙).
function buildMessage(kind: string, r: Recipient): string {
  const label = KIND_LABEL[kind] ?? "안내문";
  return [
    `[메리트투어] ${r.name}님 ${label} 안내`,
    ``,
    `· 행사번호 : ${r.eventNo}`,
    `· 출발일 : ${r.dep}`,
    `· 상품 : ${r.prod}`,
    ``,
    `아래 버튼에서 ${label}를 확인해 주세요.`,
  ].join("\n");
}

interface Recipient {
  phone: string;
  name: string;
  eventNo: string;
  dep: string;
  prod: string;
  link: string;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let payload: { kind?: string; recipients?: Recipient[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const kind = payload.kind ?? "confirm";
  const recipients = (payload.recipients ?? []).filter((r) => r && r.phone);
  if (!recipients.length) return json({ error: "no recipients with phone" }, 400);
  if (recipients.length > 500) return json({ error: "max 500 recipients per call" }, 400);

  const apikey = env("ALIGO_API_KEY");
  const userid = env("ALIGO_USER_ID");
  const senderkey = env("ALIGO_SENDER_KEY");
  const sender = env("ALIGO_SENDER");
  const tplCode = tplCodeFor(kind);
  if (!apikey || !userid || !senderkey || !sender || !tplCode) {
    return json({ error: "Aligo 환경변수(ALIGO_*) 또는 템플릿코드가 설정되지 않았습니다" }, 500);
  }

  // 알리고는 인덱스(_1, _2 …) 파라미터로 다건을 한 번에 전송한다.
  const form = new FormData();
  form.append("apikey", apikey);
  form.append("userid", userid);
  form.append("senderkey", senderkey);
  form.append("tpl_code", tplCode);
  form.append("sender", sender);
  form.append("testMode", env("ALIGO_TEST_MODE", "N"));

  recipients.forEach((r, i) => {
    const n = i + 1;
    const msg = buildMessage(kind, r);
    form.append(`receiver_${n}`, r.phone);
    form.append(`recvname_${n}`, r.name || "");
    form.append(`subject_${n}`, `${KIND_LABEL[kind] ?? "안내문"} 안내`);
    form.append(`message_${n}`, msg);
    // 링크 버튼(웹링크). 템플릿에 등록된 버튼명과 일치시켜야 함.
    if (r.link) {
      form.append(
        `button_${n}`,
        JSON.stringify({ button: [{ name: "문서 확인", linkType: "WL", linkTypePc: r.link, linkTypeMo: r.link }] }),
      );
    }
    // 알림톡 실패 시 SMS/LMS 대체발송(failover)
    form.append(`failover_${n}`, "Y");
    form.append(`fsubject_${n}`, "메리트투어 안내");
    form.append(`fmessage_${n}`, msg);
  });

  try {
    const res = await fetch(ALIGO_ENDPOINT, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    // 알리고 정상 응답: { code: 0, message: "success", info: {...} }
    if (data?.code !== 0 && data?.code !== "0") {
      return json({ error: data?.message ?? "Aligo 발송 실패", aligo: data }, 502);
    }
    return json({ ok: true, sent: recipients.length, aligo: data });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});
