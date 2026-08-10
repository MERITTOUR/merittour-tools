/* supabase/ 안에 anon 을 다시 여는 SQL·문서가 되살아나지 않게 막는다.
 *
 * 왜 테스트로 두나 — anon 키는 public 저장소(shared/supabase-config.js)에 원문으로
 * 있다. 정책이 `to anon using(true)` 로 하나라도 살아 있으면, 그 키만으로 브라우저
 * 없이도 손님 예약을 읽고 쓰고 확정서를 내려받을 수 있다. 13_lock_anon.sql 로 닫아
 * 놨지만, 레거시 셋업 파일이 남아 있으면 누군가 다시 돌려 조용히 되돌린다.
 * 실제로 resort_master_setup.sql 에는 「재실행해도 안전합니다」라고 적혀 있었다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* SQL 주석(-- …)을 걷어낸다. 설명문이 옛 코드를 인용하면 오탐이 난다. */
function stripSqlComments(s) {
  return s.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
}

const sqlFiles = walk(SB).filter(f => f.endsWith('.sql'));
const LOCK = path.join(SB, 'migrations', '13_lock_anon.sql');

test('anon 을 여는 정책이 남아 있지 않다', () => {
  for (const f of sqlFiles) {
    if (f === LOCK) continue;                       // 닫는 파일은 anon 을 언급해도 된다
    const sql = stripSqlComments(fs.readFileSync(f, 'utf8'));
    const bad = [...sql.matchAll(/create\s+policy[\s\S]{0,400}?to\s+anon\b/gi)];
    assert.strictEqual(bad.length, 0,
      `${path.relative(SB, f)} 가 anon 정책을 만든다 — 13_lock_anon.sql 이 닫은 것을 되돌린다`);
  }
});

test('anon 에 테이블 권한을 주는 grant 가 남아 있지 않다', () => {
  for (const f of sqlFiles) {
    if (f === LOCK) continue;
    const sql = stripSqlComments(fs.readFileSync(f, 'utf8'));
    const bad = [...sql.matchAll(/grant[\s\S]{0,200}?\bto\s+[^;]*\banon\b/gi)];
    assert.strictEqual(bad.length, 0,
      `${path.relative(SB, f)} 가 anon 에 grant 한다`);
  }
});

test('표를 만드는 곳은 RLS 를 켠다', () => {
  /* Supabase 는 public 스키마 신규 표에 anon·authenticated grant 를 기본으로 준다.
     RLS 가 꺼져 있으면 정책이 하나도 없어도 통째로 열린다. */
  for (const f of sqlFiles) {
    const sql = stripSqlComments(fs.readFileSync(f, 'utf8'));
    const created = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)]
      .map(m => m[1]);
    /* 10_shared_overlays.sql 은 다섯 표를 array[...] 로 돌며 %I 로 켠다.
       리터럴이 없다고 안 켠 것이 아니므로 그 형태도 인정한다. */
    const dynamicOn = /alter\s+table\s+public\.%I\s+enable\s+row\s+level\s+security/i.test(sql);
    for (const t of created) {
      const literalOn = new RegExp(
        `alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql);
      const inLoop = dynamicOn && new RegExp(`'${t}'`).test(sql);
      assert.ok(literalOn || inLoop,
        `${path.relative(SB, f)} 가 public.${t} 를 만들면서 RLS 를 켜지 않는다`);
    }
  }
});

test('셋업 문서가 anon 허용·public 버킷을 안내하지 않는다', () => {
  const docs = walk(SB).filter(f => f.endsWith('.md'));
  assert.ok(docs.length > 0, '셋업 문서를 하나도 못 찾았다 — 경로가 바뀌었는지 확인할 것');
  for (const f of docs) {
    const md = fs.readFileSync(f, 'utf8');
    /* 인용부호(⚠ …「」)로 감싼 「예전에 이랬다」 설명은 허용하고, 지시문만 잡는다. */
    const lines = md.split('\n').filter(l => !/^\s*>/.test(l) && !l.includes('⚠') && !/「.*」/.test(l));
    const body = lines.join('\n');
    assert.ok(!/anon\s*에\s*(게\s*)?.{0,20}허용/.test(body),
      `${path.relative(SB, f)} 가 anon 허용을 안내한다`);
    assert.ok(!/Public bucket.{0,20}체크(?!하지)/i.test(body),
      `${path.relative(SB, f)} 가 버킷을 public 으로 만들라고 안내한다`);
  }
});

test('send-alimtalk·translate 는 --no-verify-jwt 로 배포하라고 적혀 있지 않다', () => {
  /* cron-d7-alimtalk 만 예외다 — pg_cron 이 JWT 없이 부르고, CRON_SECRET 으로 막는다. */
  for (const f of walk(SB).filter(x => x.endsWith('.md'))) {
    const md = fs.readFileSync(f, 'utf8');
    for (const m of md.matchAll(/functions\s+deploy\s+([\w-]+)([^\n]*)/g)) {
      const [, name, rest] = m;
      if (name === 'cron-d7-alimtalk') continue;
      assert.ok(!/--no-verify-jwt/.test(rest),
        `${path.relative(SB, f)}: ${name} 을 --no-verify-jwt 로 배포하라고 적혀 있다`);
    }
  }
});
