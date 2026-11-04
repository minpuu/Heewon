// 블로그 인포그래픽 카드 생성기
//
// 사용법:
//   node generate.mjs cards/예시.json [cards/다른파일.json ...]
//   npm run build            # cards/ 폴더 전체
//
// JSON 파일 하나에 카드 1장(객체) 또는 여러 장(배열)을 넣을 수 있습니다.
// 결과는 out/<파일이름>.png (여러 장이면 out/<파일이름>-1.png, -2.png …)
// 출력 크기: 1080×1080 (네이버 블로그 모바일에 맞는 정사각형)

import { createRequire } from "node:module";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const brand = JSON.parse(readFileSync(join(here, "brand.json"), "utf8"));
const c = brand.colors;

// ---------- 폰트 (Pretendard, 로컬에서 base64로 내장) ----------
function fontFace(weight, file) {
  const p = join(here, "node_modules/pretendard/dist/web/static/woff2", file);
  if (!existsSync(p)) {
    console.error("Pretendard 폰트가 없습니다. 먼저 `npm install`을 실행하세요.");
    process.exit(1);
  }
  const b64 = readFileSync(p).toString("base64");
  return `@font-face{font-family:'Pretendard';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}
const FONTS = [
  fontFace(400, "Pretendard-Regular.woff2"),
  fontFace(600, "Pretendard-SemiBold.woff2"),
  fontFace(700, "Pretendard-Bold.woff2"),
  fontFace(800, "Pretendard-ExtraBold.woff2"),
].join("\n");

// ---------- 유틸 ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
// **굵게** 표기를 강조색으로
const rich = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>');

// ---------- 카드 본문 ----------
const renderers = {
  // 큰 숫자 하나
  stat(d) {
    return `
      <div class="stat">
        ${d.label ? `<div class="stat-label">${rich(d.label)}</div>` : ""}
        <div class="stat-value">${esc(d.value)}<span class="stat-unit">${esc(d.unit || "")}</span></div>
        ${d.sub ? `<div class="pill">${rich(d.sub)}</div>` : ""}
        ${d.note ? `<div class="stat-note">${rich(d.note)}</div>` : ""}
      </div>`;
  },

  // 막대 비교 (항목 2~6개)
  bars(d) {
    const items = d.items || [];
    const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
    const hi = d.highlight ?? items.reduce((m, it, i, a) => ((it.value ?? 0) > (a[m].value ?? 0) ? i : m), 0);
    return `
      <div class="bars">
        ${items
          .map((it, i) => {
            const h = Math.max(6, Math.round(((Number(it.value) || 0) / max) * 100));
            return `
            <div class="bar-col">
              <div class="bar-num ${i === hi ? "on" : ""}">${esc(it.display ?? it.value)}</div>
              <div class="bar-track"><div class="bar ${i === hi ? "on" : ""}" style="height:${h}%"></div></div>
              <div class="bar-label">${esc(it.label)}</div>
            </div>`;
          })
          .join("")}
      </div>`;
  },

  // 두 개 비교 (전/후, A/B)
  compare(d) {
    const box = (b, on) => `
      <div class="cmp ${on ? "on" : ""}">
        ${b.tag ? `<div class="cmp-tag">${esc(b.tag)}</div>` : ""}
        <div class="cmp-label">${esc(b.label || "")}</div>
        <div class="cmp-value">${esc(b.value)}<span>${esc(b.unit || "")}</span></div>
        ${b.sub ? `<div class="cmp-sub">${rich(b.sub)}</div>` : ""}
      </div>`;
    const winner = d.highlight === "left" ? 0 : 1;
    return `
      <div class="cmp-wrap">
        ${box(d.left || {}, winner === 0)}
        <div class="cmp-arrow">→</div>
        ${box(d.right || {}, winner === 1)}
      </div>
      ${d.note ? `<div class="cmp-note">${rich(d.note)}</div>` : ""}`;
  },

  // 한눈에 요약 (경험담 도입부용)
  summary(d) {
    return `
      <div class="sum">
        ${(d.rows || [])
          .map(
            ([k, v]) => `
          <div class="sum-row">
            <div class="sum-k">${esc(k)}</div>
            <div class="sum-v">${rich(v)}</div>
          </div>`
          )
          .join("")}
      </div>`;
  },

  // 단계 (신청 방법 등)
  steps(d) {
    return `
      <div class="steps">
        ${(d.steps || [])
          .map(
            (s, i) => `
          <div class="step">
            <div class="step-n">${i + 1}</div>
            <div class="step-t">${rich(s)}</div>
          </div>`
          )
          .join("")}
      </div>`;
  },
};

function cardHtml(d) {
  const body = renderers[d.type];
  if (!body) throw new Error(`알 수 없는 카드 type: "${d.type}" (stat, bars, compare, summary, steps 중 선택)`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:540px;height:540px}
body{font-family:'Pretendard',sans-serif;background:${c.bg};color:${c.ink};letter-spacing:-0.02em;word-break:keep-all}
.frame{position:absolute;inset:22px;background:${c.card};border-radius:26px;padding:34px 34px 0;display:flex;flex-direction:column;box-shadow:0 1px 0 ${c.line}}
.kicker{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;background:${c.primarySoft};color:${c.primary};font-weight:700;font-size:13px;padding:6px 12px;border-radius:999px}
.kicker:before{content:"";width:6px;height:6px;border-radius:50%;background:${c.primary}}
h1{font-size:27px;font-weight:800;line-height:1.3;margin-top:14px;white-space:pre-line}
h1 .hl,.hl{color:${c.primary};font-weight:800}
.content{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:10px 0}
.foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${c.line};padding:13px 0 16px;font-size:11.5px;color:${c.muted}}
.foot b{color:${c.ink};font-weight:700}

.stat{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.stat-label{font-size:17px;color:${c.muted};font-weight:600}
.stat-value{font-size:88px;font-weight:800;line-height:1;color:${c.ink};letter-spacing:-0.04em}
.stat-unit{font-size:36px;margin-left:4px;letter-spacing:-0.02em}
.pill{background:${c.accentSoft};color:#8a5a12;font-weight:700;font-size:17px;padding:10px 16px;border-radius:12px}
.pill .hl{color:#8a5a12}
.stat-note{font-size:15px;color:${c.muted};line-height:1.5}

.bars{display:flex;gap:14px;align-items:flex-end;height:250px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
.bar-num{font-size:17px;font-weight:700;color:${c.muted};margin-bottom:8px}
.bar-num.on{color:${c.primary};font-size:21px;font-weight:800}
.bar-track{flex:1;width:100%;display:flex;align-items:flex-end}
.bar{width:100%;background:${c.primarySoft};border-radius:10px 10px 4px 4px}
.bar.on{background:${c.primary}}
.bar-label{white-space:pre-line;height:36px;margin-top:10px;font-size:13.5px;font-weight:600;color:${c.ink};text-align:center;line-height:1.3}

.cmp-wrap{display:flex;align-items:stretch;gap:10px}
.cmp{flex:1;border:1.5px solid ${c.line};border-radius:18px;padding:20px 16px;display:flex;flex-direction:column;gap:8px}
.cmp.on{border-color:${c.primary};background:${c.primarySoft}}
.cmp-tag{align-self:flex-start;font-size:12px;font-weight:700;padding:4px 9px;border-radius:999px;background:${c.bg};color:${c.muted}}
.cmp.on .cmp-tag{background:${c.primary};color:#fff}
.cmp-label{font-size:16px;font-weight:700}
.cmp-value{font-size:38px;font-weight:800;letter-spacing:-0.03em;line-height:1.1}
.cmp-value span{font-size:18px;margin-left:2px}
.cmp.on .cmp-value{color:${c.primary}}
.cmp-sub{font-size:13px;color:${c.muted};line-height:1.45}
.cmp-arrow{align-self:center;font-size:22px;color:${c.muted};font-weight:700}
.cmp-note{margin-top:16px;font-size:15px;font-weight:600;text-align:center;background:${c.accentSoft};color:#8a5a12;padding:11px;border-radius:12px}
.cmp-note .hl{color:#8a5a12}

.sum{display:flex;flex-direction:column}
.sum-row{display:flex;gap:14px;padding:13px 0;border-bottom:1px dashed ${c.line};align-items:baseline}
.sum-row:last-child{border-bottom:0}
.sum-k{width:86px;flex-shrink:0;font-size:14px;font-weight:700;color:${c.primary}}
.sum-v{font-size:17px;font-weight:600;line-height:1.4}

.steps{display:flex;flex-direction:column;gap:12px}
.step{display:flex;gap:14px;align-items:center;background:${c.bg};border-radius:14px;padding:13px 16px}
.step-n{width:30px;height:30px;flex-shrink:0;border-radius:50%;background:${c.primary};color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center}
.step-t{font-size:16.5px;font-weight:600;line-height:1.4}
</style></head><body>
<div class="frame">
  ${d.kicker ? `<div class="kicker">${esc(d.kicker)}</div>` : ""}
  ${d.title ? `<h1>${rich(d.title)}</h1>` : ""}
  <div class="content">${body(d)}</div>
  <div class="foot"><span>${d.source ? `출처: ${esc(d.source)}` : "&nbsp;"}</span><b>${esc(brand.blogName)}</b></div>
</div>
</body></html>`;
}

// ---------- 실행 ----------
const files = process.argv.slice(2);
if (!files.length) {
  console.log("사용법: node generate.mjs cards/파일.json [...]");
  process.exit(1);
}
const outDir = join(here, "out");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 540 }, deviceScaleFactor: 2 });
let count = 0;
for (const f of files) {
  const data = JSON.parse(readFileSync(resolve(f), "utf8"));
  const cards = Array.isArray(data) ? data : [data];
  const name = basename(f, ".json");
  for (const [i, card] of cards.entries()) {
    await page.setContent(cardHtml(card), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const out = join(outDir, cards.length > 1 ? `${name}-${i + 1}.png` : `${name}.png`);
    await page.screenshot({ path: out });
    console.log("✔", out);
    count++;
  }
}
await browser.close();
console.log(`완료: ${count}장`);
