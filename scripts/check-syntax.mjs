/* 인라인(src 없는) <script> + 독립 .js 파일을 vm.Script 로 '파싱만' 검사(실행 안 함).
   DOM·전역 미정의여도 문법 오류만 잡힘. 외부 의존성 0.
   - HTML: <script type="module">(ESM)은 제외(vm.Script가 import/export를 막음).
   - .js : import/export(ESM)를 쓰는 파일은 자동 건너뜀. (현재 저장소는 전부 CJS/브라우저) */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SKIP = new Set(['node_modules', '.git']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html') || name.endsWith('.js')) out.push(p);
  }
  return out;
}

const ESM = /^\s*(import|export)[\s{(*]/m;            // ESM 감지
const RE = /<script(?![^>]*\bsrc=)(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;

const files = walk(process.cwd()).sort();
let scripts = 0, errors = 0;

function check(code, label) {
  if (!code.trim()) return;
  scripts++;
  try { new vm.Script(code, { filename: label }); }
  catch (e) { errors++; console.error(`✗ ${label}: ${e.message}`); }
}

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (f.endsWith('.js')) {
    if (ESM.test(src)) continue;                      // ESM 모듈은 vm.Script로 검사 불가 → 건너뜀
    check(src, f);
  } else {
    [...src.matchAll(RE)].forEach((m, i) => check(m[1], `${f}#script${i}`));
  }
}

console.log(`검사 대상: 파일 ${files.length}개 · 스크립트 ${scripts}개`);
if (errors) { console.error(`\n✗ 문법 오류 ${errors}건`); process.exit(1); }
console.log('✓ 전체 스크립트 문법 검사 통과');
