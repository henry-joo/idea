// dist-artifact/index.html(단일 파일 빌드)을 claude.ai Artifact 페이지 조각으로 변환한다.
// - <!doctype>/<html>/<head>/<body> 제거 (Artifact가 골격을 씌운다)
// - React/ReactDOM은 cdnjs UMD 18.3.1로 로드
// - 앱 스크립트는 #root 뒤에 일반 스크립트로 둔다
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re, label) => {
  const m = html.match(re);
  if (!m) throw new Error(`빌드 결과에서 ${label}를 찾지 못했습니다`);
  return m[1];
};
const title = pick(/<title>([\s\S]*?)<\/title>/, 'title');
const fontHref = pick(/<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"/, 'font link');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const script = pick(/<script[^>]*>([\s\S]*?)<\/script>/, 'app script');

const out = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontHref}">
<style>${styles}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync('dist-artifact/sungi-artifact.html', out);
console.log(`dist-artifact/sungi-artifact.html (${(out.length / 1024).toFixed(1)} KB)`);
