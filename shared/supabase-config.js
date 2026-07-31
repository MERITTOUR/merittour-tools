/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — Supabase 접속 설정  (shared/supabase-config.js)

   ⚠ 여기에 두 값을 채워야 로그인·등록소가 동작합니다.
     Supabase 콘솔 → 프로젝트 Merittour-hub → Project Settings → API 에서 복사.

       Project URL   →  URL
       anon public   →  ANON_KEY

   anon key 를 코드에 두는 것은 Supabase 의 정상 사용법입니다. 이 키는
   「로그인 창구」일 뿐이고, 실제 데이터 접근은 서버의 RLS 정책이 막습니다.
   (04_user_access.sql 에서 data_registry 는 anon 을 revoke 해 뒀습니다.)
   service_role key 는 절대 여기에 넣지 마세요 — 그건 RLS 를 통째로 무시합니다.

   사용: <head> 에서 access.js 보다 먼저 부릅니다.
     <script src="../shared/supabase-config.js"></script>
     <script src="../shared/access.js"></script>
   ════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CFG = {
    URL: 'https://mbfmiynwycvhsoepdnxe.supabase.co',
    // anon public (legacy JWT). Supabase 가 쓰는 새 형식은 sb_publishable_... 이고
    // 둘 다 같은 자리에 들어가지만, 지금은 호환 범위가 넓은 legacy 를 쓴다.
    // 교체할 때는 이 한 줄만 바꾸면 된다.
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZm1peW53eWN2aHNvZXBkbnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjY0NTYsImV4cCI6MjA5NTgwMjQ1Nn0.Y4z9Vwy1Unoghe_k3u4hkh4sGrnJslOGP8rCqYG-KgA'
  };
  CFG.ready = function () { return !!(CFG.URL && CFG.ANON_KEY); };

  if (typeof module === 'object' && module.exports) module.exports = CFG;
  else root.MT_SB = CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
