// 출발 D-7 항공/PNR 알림톡 자동발송 (매일 cron 호출)
//
// 동작:
//   1) KST 기준 오늘 + 7일(D-7) 출발 예약을 reservations 에서 조회 (status 확정/정산, 연락처 있음)
//   2) notice_sent('d7_pnr') 에 이미 기록된 건 제외 (중복발송 방지)
//   3) 알리고 알림톡(PNR 템플릿)으로 일괄 발송
//   4) notice_sent 에 결과 기록
//
// 환경변수(secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Edge Function 기본 제공)
//   ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY, ALIGO_SENDER, ALIGO_TPL_PNR
//   CRON_SECRET (cron 호출 인증용), ALIGO_TEST_MODE("Y"/"N")
//
// 스케줄: supabase/cron_d7_schedule.sql (pg_cron) 참고. 배포: supabase functions deploy cron-d7-alimtalk --no-verify-jwt

const ALIGO_ENDPOINT = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";

function env(k: string, d = ""): string {
  return Deno.env.get(k) ?? d;
}

interface Reservation {
  event_seq: string;
  event_no: string;
  rep_name: string;
  rep_phone: string;
  status: string;
  dep: string;
  arr: string;
  prod_name: string;
  origin: string;
  dest: string;
  dep_flight: string;
  ret_flight: string;
  pnr: string;
}

// KST 기준 오늘+offset 일자(YYYY-MM-DD)
function kstDatePlus(days: number): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCDate(kst.getUTCDate() + days);
  return kst.toISOString().slice(0, 10);
}

// 승인된 PNR 템플릿 본문과 글자 단위로 일치해야 함.
function pnrMessage(r: Reservation): string {
  return [
    `[메리트투어] ${r.rep_name}님 항공 예약 안내`,
    ``,
    `· 상품 : ${r.prod_name}`,
    `· 출발/귀국 : ${r.dep} ~ ${r.arr}`,
    `· 여정 : ${r.origin} → ${r.dest}`,
    `· 출발편 : ${r.dep_flight}`,
    `· 귀국편 : ${r.ret_flight}`,
    `· 예약번호(PNR) : ${r.pnr}`,
    ``,
    `여권 정보가 정확한지 확인 부탁드립니다.`,
  ].join("\n");
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function sendAligo(targets: Reservation[]): Promise<unknown> {
  const form = new FormData();
  form.append("apikey", env("ALIGO_API_KEY"));
  form.append("userid", env("ALIGO_USER_ID"));
  form.append("senderkey", env("ALIGO_SENDER_KEY"));
  form.append("tpl_code", env("ALIGO_TPL_PNR"));
  form.append("sender", env("ALIGO_SENDER"));
  form.append("testMode", env("ALIGO_TEST_MODE", "N"));
  targets.forEach((r, i) => {
    const n = i + 1;
    const msg = pnrMessage(r);
    form.append(`receiver_${n}`, r.rep_phone);
    form.append(`recvname_${n}`, r.rep_name || "");
    form.append(`subject_${n}`, "항공 예약 안내");
    form.append(`message_${n}`, msg);
    form.append(`failover_${n}`, "Y");
    form.append(`fsubject_${n}`, "메리트투어 항공 안내");
    form.append(`fmessage_${n}`, msg);
  });
  const res = await fetch(ALIGO_ENDPOINT, { method: "POST", body: form });
  return await res.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  // cron 인증 (fail-closed): CRON_SECRET 미설정 시에도 실행 거부한다.
  const secret = env("CRON_SECRET");
  if (!secret) {
    // 시크릿 미설정이면 무단 트리거 방지를 위해 항상 거부(운영에서 반드시 시크릿 설정).
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const target = kstDatePlus(7);

  // 1) D-7 예약 조회
  const resvRes = await rest(
    `reservations?select=*&dep=eq.${target}&status=in.(확정,정산)`,
  );
  if (!resvRes.ok) {
    return new Response(JSON.stringify({ error: "조회 실패", detail: await resvRes.text() }), { status: 502 });
  }
  const all: Reservation[] = await resvRes.json();
  const candidates = all.filter((r) => (r.rep_phone || "").replace(/[^0-9]/g, "").length >= 9);

  if (!candidates.length) {
    return new Response(JSON.stringify({ ok: true, target, sent: 0, note: "대상 없음" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // 2) 이미 보낸 건 제외
  const seqs = candidates.map((r) => `"${r.event_seq}"`).join(",");
  const sentRes = await rest(
    `notice_sent?select=event_seq&notice_type=eq.d7_pnr&event_seq=in.(${seqs})`,
  );
  const sentRows: { event_seq: string }[] = sentRes.ok ? await sentRes.json() : [];
  const already = new Set(sentRows.map((x) => x.event_seq));
  const targets = candidates
    .filter((r) => !already.has(r.event_seq))
    .map((r) => ({ ...r, rep_phone: r.rep_phone.replace(/[^0-9]/g, "") }));

  if (!targets.length) {
    return new Response(JSON.stringify({ ok: true, target, sent: 0, note: "이미 발송됨" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // 3) 발송 (알리고는 1회 최대 500건)
  const aligo = await sendAligo(targets.slice(0, 500));

  // 4) 발송 기록
  await rest(`notice_sent`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(
      targets.map((r) => ({ event_seq: r.event_seq, notice_type: "d7_pnr", result: aligo })),
    ),
  });

  return new Response(JSON.stringify({ ok: true, target, sent: targets.length, aligo }), {
    headers: { "content-type": "application/json" },
  });
});
