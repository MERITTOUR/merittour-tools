/* ════════════════════════════════════════════════════════════════
   MERITTOUR 사내 도구함 — 엠클릭 통합 업로드 데이터 접근  (shared/store.js)

   네트워크·인증·충돌 처리를 여기 한 곳에 모은다. 대시보드·등록 페이지는
   순수 함수만 부르고, REST 세부는 몰라도 되게 한다.

   전제: shared/supabase-config.js → shared/access.js → shared/store.js 순서로 로드.
        모든 요청은 MT_AUTH 의 사용자 토큰으로 나간다(anon 은 서버에서 막혀 있다).

   서버 스키마: supabase/migrations/05_data_registry.sql, 07_data_registry_block.sql
   ════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./access.js'));
  else root.MT_STORE = factory(root.MT_AUTH);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (AUTH) {
  'use strict';

  var dep = {
    fetch: (typeof fetch === 'function') ? fetch.bind(null) : null,
    auth:  AUTH,
    config: (typeof MT_SB !== 'undefined') ? MT_SB
            : (typeof globalThis !== 'undefined' && globalThis.MT_SB) ? globalThis.MT_SB
            : { URL: '', ANON_KEY: '' }
  };

  function base() { return String(dep.config.URL || '').replace(/\/+$/, ''); }

  /* PostgREST 호출. 항상 사용자 토큰으로 나간다. */
  function rest(path, opts) {
    opts = opts || {};
    if (!dep.config.URL || !dep.config.ANON_KEY) {
      return Promise.reject(new Error('Supabase 접속 설정이 비어 있습니다. shared/supabase-config.js 를 채워 주세요.'));
    }
    return dep.auth.token().then(function (t) {
      if (!t) throw new Error('로그인이 필요합니다.');
      var h = {
        'apikey': dep.config.ANON_KEY,
        'Authorization': 'Bearer ' + t,
        'Content-Type': 'application/json'
      };
      if (opts.prefer) h['Prefer'] = opts.prefer;
      return dep.fetch(base() + '/rest/v1' + path, {
        method: opts.method || 'GET',
        headers: h,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    }).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
        if (!r.ok) throw restError(r.status, j);
        return j;
      });
    }, function (e) {
      if (e instanceof Error && e.message) throw e;
      throw new Error('네트워크에 연결할 수 없습니다. Supabase 프로젝트가 정지 상태일 수 있습니다.');
    });
  }

  function restError(status, body) {
    var msg = (body && (body.message || body.hint || body.details)) || '';
    var e;
    if (status === 401) e = new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    else if (status === 403 || /permission denied/i.test(msg) || /row-level security/i.test(msg))
      e = new Error('권한이 없습니다. 관리자에게 역할 승인을 요청해 주세요.');
    else if (status >= 500) e = new Error('서버에 연결할 수 없습니다. Supabase 프로젝트가 정지 상태일 수 있습니다.');
    else e = new Error(msg || ('요청에 실패했습니다. (HTTP ' + status + ')'));
    e.status = status; e.body = body;
    return e;
  }

  /* ── 엠클릭 통합 업로드 ──────────────────────────────────────────────────── */

  var LIST_COLS = 'period,team_count,pax_count,res_files,ilhaeng_files,uploader_name,updated_at,block_month,block_at,block_by';

  /* 월 목록. 무거운 원본(res_json 등)은 빼고 요약만 가져온다 —
     목록을 열 때마다 수 MB 를 내려받으면 안 된다. */
  function listPeriods() {
    return rest('/data_registry?select=' + LIST_COLS + '&order=period.desc')
      .then(function (rows) {
        return (rows || []).map(function (r) {
          return {
            period: r.period,
            teamCount: r.team_count, paxCount: r.pax_count,
            resFiles: r.res_files, ilhaengFiles: r.ilhaeng_files,
            uploaderName: r.uploader_name || '',
            updatedAt: r.updated_at,
            hasBlock: r.block_at != null,     // block_rows 는 안 받으므로 시각으로 판정
            blockMonth: r.block_month || '',
            blockBy: r.block_by || '',
            blockAt: r.block_at || null
          };
        });
      });
  }

  function shape(r) {
    return {
      period: r.period,
      resRows: r.res_json || [],
      ilhaengRows: r.ilhaeng_json || [],
      // null(아직 안 올림)과 []( 올렸는데 사용 0)를 구분해서 그대로 넘긴다.
      // 여기서 [] 로 뭉개면 다음 달 미등록을 사용 0 으로 오해해 월 경계 연박이 틀린다.
      blockRows: (r.block_rows === undefined ? null : r.block_rows),
      blockRaw: r.block_raw || '',
      blockMonth: r.block_month || '',
      meta: {
        teamCount: r.team_count, paxCount: r.pax_count,
        resFiles: r.res_files, ilhaengFiles: r.ilhaeng_files,
        uploaderName: r.uploader_name || '',
        updatedAt: r.updated_at,
        blockBy: r.block_by || '', blockAt: r.block_at || null
      }
    };
  }

  /* 한 달치 전체. 없으면 null. */
  function load(period) {
    var p = encodeURIComponent(String(period || ''));
    return rest('/data_registry?period=eq.' + p + '&select=*&limit=1')
      .then(function (rows) {
        var r = (rows && rows[0]) || null;
        return r ? shape(r) : null;
      });
  }

  /* 여러 달을 한 번에. 달마다 따로 부르면 왕복이 그만큼 늘어난다 —
     12달을 12번 부르면 느린 회선에서 눈에 띄게 밀린다.
     아직 안 올라온 달은 그냥 빠진 채로 온다(오류가 아니다). */
  function loadMany(periods) {
    var list = (periods || []).map(function (p) { return String(p || ''); })
      .filter(function (p) { return /^\d{4}-\d{2}$/.test(p); });
    if (!list.length) return Promise.resolve([]);
    var q = '/data_registry?period=in.(' + list.map(encodeURIComponent).join(',') + ')&select=*';
    return rest(q).then(function (rows) { return (rows || []).map(shape); });
  }

  /* 저장 = 그 달을 통째 교체(업서트).
     opts.expect 에 불러올 때의 updated_at 을 주면, 그 사이 누가 올렸을 때 막는다.
     막지 않으면 두 사람이 같은 달을 올릴 때 나중 것이 조용히 이긴다. */
  function save(period, payload, opts) {
    opts = opts || {};
    period = String(period || '');
    if (!/^\d{4}-\d{2}$/.test(period)) return Promise.reject(new Error('출발월 형식이 올바르지 않습니다. (YYYY-MM)'));

    var body = { period: period };
    if (payload.resRows)     { body.res_json = payload.resRows;         body.res_files = payload.resFiles || 0; }
    if (payload.ilhaengRows) { body.ilhaeng_json = payload.ilhaengRows; body.ilhaeng_files = payload.ilhaengFiles || 0; }
    if (payload.teamCount != null) body.team_count = payload.teamCount;
    if (payload.paxCount  != null) body.pax_count  = payload.paxCount;
    if (payload.uploaderName) body.uploader_name = payload.uploaderName;
    if (payload.blockRows !== undefined) {
      body.block_rows  = payload.blockRows;
      body.block_raw   = payload.blockRaw || '';
      body.block_month = payload.blockMonth || period;
      body.block_by    = payload.uploaderName || '';
      body.block_at    = new Date().toISOString();
    }

    if (!opts.expect) {
      return rest('/data_registry?on_conflict=period', {
        method: 'POST', body: [body],
        prefer: 'resolution=merge-duplicates,return=representation'
      }).then(function (rows) { return { ok: true, row: (rows && rows[0]) || null }; });
    }

    // 조건부 갱신 — 그 사이 바뀌었으면 0행이 돌아온다
    var q = '/data_registry?period=eq.' + encodeURIComponent(period)
          + '&updated_at=eq.' + encodeURIComponent(opts.expect);
    return rest(q, { method: 'PATCH', body: body, prefer: 'return=representation' })
      .then(function (rows) {
        if (rows && rows.length) return { ok: true, row: rows[0] };
        var e = new Error('그 사이 다른 분이 같은 달을 등록했습니다. 다시 불러온 뒤 확인해 주세요.');
        e.conflict = true;
        throw e;
      });
  }

  /* 블록표만. 월 경계 연박을 보려면 옆 달 표도 있어야 하는데,
     그것 때문에 옆 달 예약 원본(수 MB)까지 받으면 안 된다. */
  function loadBlock(period) {
    var p = encodeURIComponent(String(period || ''));
    return rest('/data_registry?period=eq.' + p
              + '&select=period,block_raw,block_month,block_by,block_at&limit=1')
      .then(function (rows) {
        var r = (rows && rows[0]) || null;
        if (!r || !r.block_raw) return null;      // 그 달은 있는데 표는 안 올린 경우도 null
        return {
          period: r.period,
          blockRaw: r.block_raw,
          blockMonth: r.block_month || r.period,
          blockBy: r.block_by || '',
          blockAt: r.block_at || null
        };
      });
  }

  function remove(period) {
    return rest('/data_registry?period=eq.' + encodeURIComponent(String(period || '')), { method: 'DELETE' })
      .then(function () { return { ok: true }; });
  }

  /* ── 리조트 마스터 ───────────────────────────────────────────── */

  function loadMaster() {
    return rest('/resort_master?id=eq.1&select=data,version,updated_at,updated_by&limit=1')
      .then(function (rows) {
        var r = (rows && rows[0]) || null;
        if (!r) return null;
        return { data: r.data || {}, version: r.version, updatedAt: r.updated_at, updatedBy: r.updated_by || '' };
      });
  }

  /* 낙관적 잠금 — 읽은 version 이 그대로일 때만 저장한다.
     마스터는 여러 명이 동시에 만지므로, 조건 없이 덮으면 남의 수정이 조용히 사라진다. */
  function saveMaster(data, version, byName) {
    var body = { data: data, version: (Number(version) || 0) + 1, updated_by: byName || '' };
    var q = '/resort_master?id=eq.1&version=eq.' + encodeURIComponent(String(version));
    return rest(q, { method: 'PATCH', body: body, prefer: 'return=representation' })
      .then(function (rows) {
        if (rows && rows.length) return { ok: true, version: rows[0].version };
        var e = new Error('그 사이 다른 분이 마스터를 저장했습니다. 새로고침 후 다시 저장해 주세요.');
        e.conflict = true;
        throw e;
      });
  }

  /* ── 등록 전 차이 확인 ───────────────────────────────────────── */
  /* 줄어드는 방향만 경고한다. 늘어나는 건 추가 예약이라 정상이고,
     줄어드는 건 분할 파일을 빠뜨렸을 때가 대부분이다. */
  function diff(before, after) {
    function n(v) { return Number(v) || 0; }
    var d = {
      exists: !!before,
      team: { from: before ? n(before.teamCount) : 0, to: n(after.teamCount) },
      pax:  { from: before ? n(before.paxCount)  : 0, to: n(after.paxCount)  },
      warnings: []
    };
    d.team.delta = d.team.to - d.team.from;
    d.pax.delta  = d.pax.to  - d.pax.from;
    if (before) {
      if (d.team.delta < 0) d.warnings.push('팀이 ' + Math.abs(d.team.delta) + '건 줄어듭니다. 분할 파일을 빠뜨리지 않았는지 확인해 주세요.');
      if (d.pax.delta  < 0) d.warnings.push('인원이 ' + Math.abs(d.pax.delta) + '명 줄어듭니다.');
      if (before.hasBlock && after.blockRows === undefined)
        d.warnings.push('이미 등록된 블록표가 있습니다. 이번에 올리지 않으면 기존 블록표가 그대로 유지됩니다.');
    }
    return d;
  }

  /* 표가 가리키는 달과 등록하려는 달이 다르면 막는다.
     7월 표를 8월에 올리면 잔여가 통째로 틀린다. */
  function checkBlockMonth(period, blockMonth) {
    if (!blockMonth) return { ok: true };
    if (String(blockMonth) === String(period)) return { ok: true };
    return { ok: false, message: '붙여넣은 표는 ' + blockMonth + ' 인데 ' + period + ' 로 등록하려 합니다. 달을 확인해 주세요.' };
  }

  return {
    listPeriods: listPeriods,
    load: load,
    loadMany: loadMany,
    loadBlock: loadBlock,
    save: save,
    remove: remove,
    loadMaster: loadMaster,
    saveMaster: saveMaster,
    diff: diff,
    checkBlockMonth: checkBlockMonth,
    _dep: dep,
    _restError: restError
  };
});
