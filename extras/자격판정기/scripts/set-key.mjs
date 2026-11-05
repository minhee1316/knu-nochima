// .env에 키를 안전하게 넣는 도우미 (입력한 값은 화면에 안 보이고, 파일에만 저장)
// 실행: node scripts/set-key.mjs NAVER_CLIENT_ID NAVER_CLIENT_SECRET
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
const names = process.argv.slice(2).filter(n => /^[A-Z][A-Z0-9_]*$/.test(n));
if (!names.length) { console.log('사용법: node scripts/set-key.mjs 이름1 이름2 ...'); process.exit(1); }

// 입력을 화면에 찍지 않고 한 줄 읽기
const ask = q => new Promise(res => {
  process.stdout.write(q);
  const stdin = process.stdin; let s = '';
  stdin.setRawMode?.(true); stdin.resume(); stdin.setEncoding('utf8');
  const on = ch => {
    for (const c of ch) {
      if (c === '\r' || c === '\n') { stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); return res(s.trim()); }
      if (c === '\u0003') { process.stdout.write('\n취소했어요.\n'); process.exit(1); }
      if (c === '\u007f' || c === '\b') { if (s) { s = s.slice(0, -1); process.stdout.write('\b \b'); } continue; }
      s += c; process.stdout.write('*');
    }
  };
  stdin.on('data', on);
});

let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
for (const name of names) {
  const v = await ask(`${name} 붙여넣기 후 Enter (화면엔 * 로만 보여요): `);
  if (!v || /\s|["']/.test(v)) { console.log(`  ✕ ${name}: 비어 있거나 공백·따옴표가 있어 건너뛰었어요.`); continue; }
  const line = `${name}=${v}`, re = new RegExp(`^${name}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : text.replace(/\n*$/, '\n') + line + '\n';
  console.log(`  ✓ ${name} 저장 (${v.length}자)`);
}
writeFileSync(file, text);
console.log('.env 저장 완료. 이 창은 닫아도 돼요.');
