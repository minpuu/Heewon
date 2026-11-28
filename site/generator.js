/* 동적 랜덤 퀴즈 생성 엔진 v2
   - kind 'calc'   : 기초 산수. 라운드당 최대 1문제. 한 줄 암산 수준(나눗셈·곱셈 한두 번)만 남긴다.
   - kind 'judge'  : 실무 해석·판단. 보고서 수치를 읽고 원인을 진단하거나 다음 액션을 고른다.
                     한 라운드 6문제 중 5문제를 이 유형으로 채운다.
   - kind 'concept': 개념 조합(설명↔개념명). 자리가 모자랄 때 보충용으로만 쓴다.
   window.QuizGen.build(domain, data, count) → 문제 객체 배열
   문제 객체: { id, topic, situation, question, options[4], answer, explanation, kind, conceptId } */

(function (global) {
  'use strict';

  var counters = { marketing: 0, finance: 0 };

  /* ---------- 기본 도구 ---------- */

  function ri(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function num(n) {
    var v = Math.round(n);
    var s = String(Math.abs(v));
    var out = '';
    for (var i = 0; i < s.length; i++) {
      out += s.charAt(i);
      var left = s.length - 1 - i;
      if (left > 0 && left % 3 === 0) out += ',';
    }
    return (v < 0 ? '-' : '') + out;
  }

  function f1(n) {
    var v = Math.round(n * 10) / 10;
    if (v === 0) v = 0;
    return v.toFixed(1);
  }

  function f2(n) {
    var v = Math.round(n * 100) / 100;
    if (v === 0) v = 0;
    return v.toFixed(2);
  }

  /* 만원 단위 금액: 정수면 정수로, 아니면 소수 첫째 자리까지 */
  function mn(n) {
    return Math.abs(n - Math.round(n)) < 1e-9 ? num(n) : f1(n);
  }

  /* 이율을 소수로: 4.5% → 0.045 (자릿수를 깎지 않는다) */
  function rate(n) {
    return String(Math.round(n * 1000) / 1000 / 100);
  }

  /* 음수 부호를 −로 통일해 수치 표기를 맞춘다 */
  function sgn(n) {
    return String(n).replace('-', '−');
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function nameParts(term) {
    var raw = String(term || '');
    var parts = raw.split(/\s+vs\s+|\||&|·|\s*,\s*/i);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/\(.*?\)/g, '').trim();
      if (p.length >= 2 && out.indexOf(p) < 0) out.push(p);
    }
    if (out.indexOf(raw) < 0) out.push(raw);
    return out;
  }

  function containsAny(text, parts) {
    var low = String(text || '').toLowerCase();
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && low.indexOf(String(parts[i]).toLowerCase()) >= 0) return true;
    }
    return false;
  }

  function maskText(text, parts, mask) {
    var out = String(text || '');
    var sorted = parts.slice().sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < sorted.length; i++) {
      if (!sorted[i]) continue;
      out = out.replace(new RegExp(escapeRe(sorted[i]), 'gi'), mask);
    }
    return out;
  }

  function newId(domain) {
    var letter = domain === 'finance' ? 'f' : 'm';
    counters[domain] = (counters[domain] || 0) + 1;
    var salt = Math.random().toString(36).slice(2, 7);
    return 'g' + letter + '-' + counters[domain] + '-' + salt;
  }

  /* 보기 4개 조립: 정답 + 오답 후보 중 중복·빈값을 걸러 3개를 채운다.
     후보가 3개 미만이면 null 을 돌려주고 호출부가 다시 뽑는다. */

  function assemble(kind, topic, situation, question, correct, others, explanation, conceptId) {
    if (!correct || String(correct).trim() === '' || String(correct).indexOf('NaN') >= 0) return null;
    var wrong = [];
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (typeof o !== 'string') continue;
      o = o.trim();
      if (!o || o === correct) continue;
      if (o.indexOf('NaN') >= 0 || o.indexOf('undefined') >= 0) continue;
      if (wrong.indexOf(o) >= 0) continue;
      wrong.push(o);
    }
    if (wrong.length < 3) return null;

    var options = shuffle([correct].concat(wrong.slice(0, 3)));
    var answer = options.indexOf(correct);
    if (answer < 0) return null;

    if (!situation || !question || !explanation) return null;
    if (String(explanation).indexOf('NaN') >= 0) return null;
    if (String(situation).indexOf('NaN') >= 0) return null;

    return {
      topic: topic,
      situation: situation,
      question: question,
      options: options,
      answer: answer,
      explanation: explanation,
      kind: kind,
      conceptId: conceptId || ''
    };
  }

  function attempt(fn, domain, data) {
    for (var i = 0; i < 40; i++) {
      var q = fn(domain, data);
      if (q) return q;
    }
    return null;
  }

  /* ============================================================
     기초 산수 템플릿 (마케팅) — 한 줄 암산
     ============================================================ */

  function tplCtr() {
    var N = pick([1000, 2000, 4000, 5000]);
    var want = pick([2, 2.5, 3, 3.5, 4, 5]);
    var C = Math.round(N * want / 100);
    var ctr = C / N * 100;

    return assemble(
      'calc', '기초 산수 · CTR',
      '릴스 광고 노출 ' + num(N) + '회, 클릭 ' + num(C) + '회.',
      '클릭률(CTR)은?',
      f1(ctr) + '%',
      [f1(ctr * 10) + '%', f1(N / C) + '%', f1(ctr / 10) + '%'],
      'CTR = 클릭 ÷ 노출 × 100 = ' + num(C) + ' ÷ ' + num(N) + ' × 100 = ' + f1(ctr) + '%.'
    );
  }

  function tplCvr() {
    var V = pick([1000, 2000, 4000, 5000]);
    var want = pick([1, 1.5, 2, 2.5, 3, 4, 5]);
    var P = Math.round(V * want / 100);
    var cvr = P / V * 100;

    return assemble(
      'calc', '기초 산수 · CVR',
      '상세페이지에 ' + num(V) + '명이 들어왔고 그중 ' + num(P) + '명이 구매했다.',
      '전환율(CVR)은?',
      f1(cvr) + '%',
      [f1(cvr * 10) + '%', f1(cvr / 10) + '%', f1(V / P) + '%'],
      'CVR = 구매 ÷ 방문 × 100 = ' + num(P) + ' ÷ ' + num(V) + ' × 100 = ' + f1(cvr) + '%.'
    );
  }

  function tplRoas() {
    var A = pick([50, 80, 100, 150, 200]);
    var mult = pick([2, 3, 4, 5, 6]);
    var R = A * mult;

    return assemble(
      'calc', '기초 산수 · ROAS',
      '인스타 광고에 ' + mn(A) + '만 원을 썼고 주문 매출은 ' + mn(R) + '만 원이었다.',
      '이 캠페인의 ROAS는?',
      num(mult * 100) + '%',
      [num((mult - 1) * 100) + '%', f1(mult * 10) + '%', num(mult) + '배'],
      'ROAS = 매출 ÷ 광고비 × 100 = ' + mn(R) + ' ÷ ' + mn(A) + ' × 100 = ' + num(mult * 100) + '%.'
    );
  }

  function tplCac() {
    var A = pick([100, 200, 300, 500]);
    var N = pick([50, 100, 200, 250]);
    var cac = A * 10000 / N;

    return assemble(
      'calc', '기초 산수 · CAC',
      '신규 고객 ' + num(N) + '명을 데려오는 데 광고비 ' + num(A * 10000) + '원을 썼다.',
      '고객 1명을 얻는 데 든 비용(CAC)은?',
      num(cac) + '원',
      [num(cac * 2) + '원', num(A * 10000 / N / 10) + '원', num(A * 10000) + '원'],
      'CAC = 광고비 ÷ 신규 고객 = ' + num(A * 10000) + ' ÷ ' + num(N) + ' = ' + num(cac) + '원.'
    );
  }

  function tplContribution() {
    var P = pick([15000, 18000, 20000, 25000, 30000]);
    var V = Math.round(P * pick([0.4, 0.45, 0.55, 0.6]) / 1000) * 1000;
    if (P - V < 1000 || P - V === V) return null;

    return assemble(
      'calc', '기초 산수 · 공헌이익',
      '제품 판매가 ' + num(P) + '원, 개당 변동비 ' + num(V) + '원.',
      '1개를 팔 때 남는 공헌이익은?',
      num(P - V) + '원',
      [num(P + V) + '원', num(V) + '원', num(P) + '원'],
      '공헌이익 = 판매가 − 변동비 = ' + num(P) + ' − ' + num(V) + ' = ' + num(P - V) + '원.'
    );
  }

  function tplSku() {
    var colors = ri(3, 6);
    var sizes = ri(3, 5);

    return assemble(
      'calc', '기초 산수 · SKU',
      '신상품 라인이 색상 ' + colors + '가지, 사이즈 ' + sizes + '가지로 나온다.',
      '관리해야 하는 SKU 수는?',
      num(colors * sizes) + '개',
      [num(colors + sizes) + '개', num(colors * sizes * 2) + '개', num(colors * sizes + sizes) + '개'],
      'SKU = 색상 × 사이즈 = ' + colors + ' × ' + sizes + ' = ' + num(colors * sizes) + '개.'
    );
  }

  /* ============================================================
     기초 산수 템플릿 (투자·재테크) — 한 줄 암산
     ============================================================ */

  function tplNetInterest() {
    var base = pick([100000, 200000, 300000, 500000, 1000000]);
    var tax = Math.round(base * 0.154);
    var net = base - tax;

    return assemble(
      'calc', '기초 산수 · 세후 이자',
      '예금 이자 ' + num(base) + '원이 발생했다. 이자소득은 15.4%를 미리 떼고 입금된다.',
      '세후 실제로 입금되는 금액은?',
      num(net) + '원',
      [num(base - Math.round(base * 0.14)) + '원', num(base - Math.round(base * 0.22)) + '원', num(tax) + '원'],
      '세금 = ' + num(base) + ' × 15.4% = ' + num(tax) + '원, 세후 = ' + num(base) + ' − ' + num(tax) + ' = ' + num(net) + '원.'
    );
  }

  function tplRealReturn() {
    var nom = pick([3, 3.5, 4, 4.5, 5, 6]);
    var cpi = pick([1, 1.5, 2, 2.5, 3]);
    var diff = nom - cpi;
    if (Math.abs(diff) < 0.5) return null;

    return assemble(
      'calc', '기초 산수 · 실질수익률',
      '예금 금리 연 ' + f1(nom) + '%, 같은 기간 물가상승률 연 ' + f1(cpi) + '%.',
      '구매력 기준 실질수익률은?',
      f1(diff) + '%',
      [f1(nom + cpi) + '%', sgn(f1(-diff)) + '%', f1(nom) + '%'],
      '실질수익률 ≈ 명목 − 물가 = ' + f1(nom) + ' − ' + f1(cpi) + ' = ' + f1(diff) + '%.'
    );
  }

  function tplRule72() {
    var r = pick([3, 4, 6, 8, 9, 12]);
    var years = 72 / r;

    return assemble(
      'calc', '기초 산수 · 72법칙',
      '연 ' + f1(r) + '% 복리로 운용한다고 가정한다.',
      '원금이 2배가 되는 기간은? (72법칙)',
      '약 ' + f1(years) + '년',
      ['약 ' + f1(100 / r) + '년', '약 ' + f1(years * 2) + '년', '약 ' + f1(years / 2) + '년'],
      '72 ÷ ' + f1(r) + ' = ' + f1(years) + '년.'
    );
  }

  function tplPer() {
    var eps = pick([1000, 2000, 2500, 4000, 5000]);
    var per = pick([8, 10, 12, 15, 20]);
    var price = eps * per;

    return assemble(
      'calc', '기초 산수 · PER',
      '주가 ' + num(price) + '원, 주당순이익(EPS) ' + num(eps) + '원.',
      'PER은?',
      f1(per) + '배',
      [f1(per * 10) + '배', f1(per / 2) + '배', f1(per / 10) + '배'],
      'PER = 주가 ÷ EPS = ' + num(price) + ' ÷ ' + num(eps) + ' = ' + f1(per) + '배.'
    );
  }

  function tplDividendYield() {
    var price = pick([8000, 10000, 12000, 15000, 20000]);
    var y = pick([2, 2.5, 3, 3.5, 4, 4.5, 5]);
    var div = Math.round(price * y / 100);

    return assemble(
      'calc', '기초 산수 · 배당수익률',
      '주가 ' + num(price) + '원, 주당 배당금 ' + num(div) + '원.',
      '배당수익률은?',
      f1(div / price * 100) + '%',
      [f1(div / price * 1000) + '%', f1(price / div) + '%', f1(y / 10) + '%'],
      '배당수익률 = 배당금 ÷ 주가 × 100 = ' + num(div) + ' ÷ ' + num(price) + ' × 100 = ' + f1(div / price * 100) + '%.'
    );
  }

  function tplMdd() {
    var peak = pick([10000, 12000, 15000, 20000, 25000]);
    var drop = pick([0.12, 0.15, 0.18, 0.2, 0.25]);
    var trough = Math.round(peak * (1 - drop));

    return assemble(
      'calc', '기초 산수 · MDD',
      '한 종목이 고점 ' + num(peak) + '원에서 저점 ' + num(trough) + '원까지 내려왔다.',
      '이 구간의 MDD는?',
      '−' + f1(drop * 100) + '%',
      ['+' + f1(drop * 100) + '%', '−' + f1((1 - drop) * 100) + '%', '−' + f1(drop * 200) + '%'],
      'MDD = (저점 − 고점) ÷ 고점 × 100 = (' + num(trough) + ' − ' + num(peak) + ') ÷ ' + num(peak) + ' × 100 = −' + f1(drop * 100) + '%.'
    );
  }

  /* ============================================================
     실무 해석·판단 템플릿 (마케팅)
     ============================================================ */

  /* 1. CTR은 높은데 CVR이 낮을 때 / 반대일 때 */
  function jFunnelLeak() {
    if (pick([0, 1])) {
      var N = pick([80000, 120000, 150000, 200000]);
      var ctrWant = pick([3.8, 4.2, 4.6, 5.2]);
      var C = Math.round(N * ctrWant / 100);
      var cvrWant = pick([0.4, 0.5, 0.6, 0.7]);
      var P = Math.max(1, Math.round(C * cvrWant / 100));
      var prev = pick([1.8, 2.1, 2.3, 2.7]);
      var ctr = C / N * 100;
      var cvr = P / C * 100;

      return assemble(
        'judge', 'CTR·CVR 진단',
        '릴스 광고 주간 보고: 노출 ' + num(N) + '회, 클릭 ' + num(C) + '회(CTR ' + f1(ctr) + '%), 구매 ' + num(P) +
          '건(CVR ' + f1(cvr) + '%). 같은 소재의 지난달 CVR은 ' + f1(prev) + '%였다.',
        '이 보고에서 가장 먼저 점검할 곳은?',
        '클릭을 만든 메시지와 상세페이지 첫 화면이 같은 약속을 하는지',
        [
          '노출이 부족하니 예산을 늘려 도달을 키우는 일',
          'CTR이 ' + f1(ctr) + '%로 높으니 소재를 교체하는 일',
          '구매 건수 대비 광고비만 다시 계산해 CPA를 낮추는 일'
        ],
        'CTR ' + f1(ctr) + '%는 클릭이 잘 나온다는 뜻이고 문제는 클릭 이후다. CVR이 ' + f1(cvr) + '%로 지난달 ' +
          f1(prev) + '%에서 떨어졌으니 유입과 상세페이지의 메시지·가격·재고가 어긋났는지부터 본다. 예산을 늘리면 같은 누수가 커진다.'
      );
    }

    var N2 = pick([120000, 150000, 180000, 240000]);
    var ctr2 = pick([1.2, 1.4, 1.6, 1.8]);
    var C2 = Math.round(N2 * ctr2 / 100);
    var cvr2 = pick([4.6, 5.2, 5.5, 6.1]);
    var P2 = Math.max(1, Math.round(C2 * cvr2 / 100));

    return assemble(
      'judge', 'CTR·CVR 진단',
      '메타 광고: 노출 ' + num(N2) + '회, 클릭 ' + num(C2) + '회(CTR ' + f1(ctr2) + '%), 구매 ' + num(P2) +
        '건(CVR ' + f1(cvr2) + '%). 같은 카테고리 평균은 CTR 2.8%, CVR 1.9%다.',
      '다음 액션으로 가장 알맞은 것은?',
      '들어온 사람의 전환은 좋으니 소재 훅과 타깃을 넓혀 클릭을 늘리는 실험을 한다',
      [
        'CVR이 ' + f1(cvr2) + '%로 높으니 상세페이지를 다시 만든다',
        'CTR이 평균보다 낮으니 캠페인을 끄고 채널을 바꾼다',
        'CVR이 높은 것은 우연이므로 이번 수치는 보지 않는다'
      ],
      'CTR ' + f1(ctr2) + '%는 카테고리 평균 2.8%보다 낮지만, 들어온 사람의 CVR ' + f1(cvr2) +
        '%는 평균 1.9%의 두 배가 넘는다. 병목이 유입 쪽이므로 소재 훅과 오디언스를 넓히는 실험이 먼저다.'
    );
  }

  /* 2. CPA는 내려갔는데 LTV도 같이 떨어졌을 때 */
  function jCpaLtv() {
    var cpaBefore = pick([28000, 32000, 36000, 42000]);
    var cpaDrop = pick([0.32, 0.38, 0.41, 0.46]);
    var cpaAfter = Math.round(cpaBefore * (1 - cpaDrop) / 100) * 100;
    var ltvBefore = pick([68000, 72000, 78000, 82000]);
    var ltvDrop = pick([0.36, 0.42, 0.47, 0.52]);
    var ltvAfter = Math.round(ltvBefore * (1 - ltvDrop) / 100) * 100;
    var share = pick([58, 64, 68, 72]);
    var cpaPct = Math.round((1 - cpaAfter / cpaBefore) * 100);
    var ltvPct = Math.round((1 - ltvAfter / ltvBefore) * 100);

    return assemble(
      'judge', 'CPA·LTV 진단',
      '퍼포먼스 주간 보고: CPA ' + num(cpaBefore) + '원 → ' + num(cpaAfter) + '원(−' + cpaPct +
        '%). 같은 기간 신규 고객 90일 LTV는 ' + num(ltvBefore) + '원 → ' + num(ltvAfter) + '원(−' + ltvPct +
        '%). 신규 구매의 ' + share + '%가 1+1 할인 세트에서 나왔다.',
      '이 변화를 어떻게 읽어야 하나?',
      '싼 유입이 늘었지만 재구매 가치가 낮은 고객이 섞였을 수 있으니 채널·오퍼별로 LTV를 나눠 확인한다',
      [
        'CPA가 내려갔으니 예산을 바로 두 배로 늘린다',
        'LTV는 원래 흔들리는 값이라 이번 판단에서는 뺀다',
        '할인 세트 비중이 높을수록 재구매 단가도 올라간다'
      ],
      'CPA −' + cpaPct + '%는 유입 단가가 좋아졌다는 뜻이고, LTV −' + ltvPct +
        '%는 데려온 고객의 가치가 그만큼 작아졌다는 뜻이다. 둘을 같이 보면 CAC 대비 LTV는 오히려 나빠졌을 수 있어, 할인 세트 비중 ' +
        share + '%가 어떤 고객을 불러왔는지 채널별로 쪼개 본다.'
    );
  }

  /* 3. CAC가 LTV보다 큰 상황 */
  function jCacLtv() {
    var cac = pick([38000, 42000, 45000, 52000]);
    var ratio = pick([0.72, 0.82, 0.9, 0.96]);
    var ltv = Math.round(cac * ratio / 100) * 100;
    var churn = pick([6, 7, 8, 9]);

    return assemble(
      'judge', 'CAC > LTV 판단',
      '구독 서비스: 신규 1명당 CAC ' + num(cac) + '원, 12개월 누적 LTV ' + num(ltv) + '원, 월 해지율 ' + churn +
        '%. 광고는 3개 채널에 같은 예산으로 돌고 있다.',
      '지금 판단으로 가장 먼저 할 일은?',
      '확장 예산을 늘리기 전에 CAC를 낮추거나 초기 이탈을 줄여 LTV를 끌어올리는 쪽을 손본다',
      [
        'LTV가 따라 올라올 것이므로 예산을 지금 두 배로 늘린다',
        'CAC는 광고비만 넣어 계산하니 LTV와 비교할 필요가 없다',
        '해지율 ' + churn + '%는 낮은 편이라 그대로 둔다'
      ],
      'LTV/CAC = ' + num(ltv) + ' ÷ ' + num(cac) + ' ≈ ' + f2(ltv / cac) +
        '배로 1배에 못 미친다. 이 상태에서 지출을 늘리면 손실이 같이 커지므로, 해지율 ' + churn +
        '%를 낮춰 12개월 LTV를 올리거나 채널별 CAC를 비교해 비싼 채널을 줄이는 순서가 맞다.'
    );
  }

  /* 4. 랜딩페이지 이탈률 급증 */
  function jLandingBounce() {
    var before = pick([38, 41, 44]);
    var after = pick([62, 66, 68, 72]);
    var mobileBefore = pick([58, 62, 65]);
    var mobileAfter = pick([76, 81, 84]);
    var size = pick([3.1, 3.8, 4.2, 5.4]);
    var fields = pick([7, 8, 9, 11]);

    return assemble(
      'judge', '랜딩 이탈률 진단',
      '랜딩페이지 주간 지표: 이탈률 ' + before + '% → ' + after + '%, 모바일 유입 비중 ' + mobileBefore + '% → ' +
        mobileAfter + '%, 첫 화면 이미지 ' + f1(size) + 'MB, 신청 폼 항목 ' + fields + '개.',
      '원인 진단으로 가장 앞서는 것은?',
      '모바일에서 첫 화면이 늦게 뜨고 폼이 길어진 쪽 — 로딩 속도와 입력 항목을 먼저 본다',
      [
        '광고 예산을 늘려 유입을 더 만든다',
        '이탈률은 원래 계절을 타므로 다음 달까지 기다린다',
        'PC 화면 레이아웃을 새로 디자인한다'
      ],
      '이탈률이 ' + before + '%에서 ' + after + '%로 오르는 동안 모바일 비중이 ' + mobileAfter +
        '%로 커졌고 첫 화면 이미지가 ' + f1(size) + 'MB, 폼 항목이 ' + fields +
        '개다. 모바일 로딩과 입력 부담이 같이 커진 구간이라 속도와 폼 길이를 먼저 재본다.'
    );
  }

  /* 5. 리텐션 곡선 진단 */
  function jRetention() {
    var d1 = pick([42, 46, 51]);
    var d7 = pick([9, 12, 14]);
    var d30 = pick([3, 4, 6]);
    var pushD7 = pick([24, 27, 31]);

    return assemble(
      'judge', '리텐션 곡선 진단',
      '앱 리텐션: D1 ' + d1 + '%, D7 ' + d7 + '%, D30 ' + d30 + '%. 첫 주에 알림을 켠 사용자의 D7은 ' + pushD7 + '%.',
      '다음 액션으로 가장 알맞은 것은?',
      '첫 주 안에 핵심 기능을 한 번 더 쓰게 만드는 온보딩과 알림 흐름을 손본다',
      [
        'D1이 ' + d1 + '%로 높으니 리텐션은 문제가 없다',
        'D30을 올리려면 신규 설치 광고를 늘린다',
        'D7이 낮으니 앱을 새로 만든다'
      ],
      'D1 ' + d1 + '%에서 D7 ' + d7 + '%로 빠지는 구간이 가장 크다. 알림을 켠 사용자의 D7이 ' + pushD7 +
        '%로 벌어지는 것은 첫 주 경험이 남느냐가 갈림길이라는 신호라, 온보딩과 알림 설계를 먼저 손본다.'
    );
  }

  /* 6. 바이럴 루프 진단 */
  function jViralLoop() {
    var clicks = pick([3200, 4800, 6200]);
    var visits = Math.round(clicks * pick([0.55, 0.64, 0.7]));
    var joins = pick([28, 41, 55]);
    var rate = joins / visits * 100;

    return assemble(
      'judge', '바이럴 루프 진단',
      '공유 버튼 클릭 ' + num(clicks) + '회, 공유 링크로 들어온 방문 ' + num(visits) + '명, 그중 가입 ' + joins + '명.',
      '바이럴 루프 진단으로 맞는 것은?',
      '공유는 일어나지만 초대받은 사람이 남을 이유(혜택·콘텐츠)가 약한 단계다',
      [
        '공유 클릭이 ' + num(clicks) + '회나 되니 루프는 완성됐다',
        '초대 보상을 두 배로 올리면 모든 문제가 풀린다',
        '공유 버튼 위치만 바꾸면 충분하다'
      ],
      '공유 클릭 ' + num(clicks) + '회 → 방문 ' + num(visits) + '명 → 가입 ' + joins + '명. 방문 대비 가입이 ' +
        f1(rate) + '%라 초대를 받은 사람이 움직이지 않는다. 받는 쪽의 이유를 설계하는 것이 다음 단계다.'
    );
  }

  /* 7. 대행사 월간 보고 해석 */
  function jAgencyReport() {
    var imp = pick([28, 38, 46]);
    var ctrB = pick([3.4, 3.8, 4.1]);
    var ctrA = ctrB - pick([0.8, 0.9, 1.1]);
    var cvrB = pick([1.2, 1.4, 1.6]);
    var cvrA = cvrB + pick([0.4, 0.5, 0.6]);
    var cpaB = pick([36000, 38000, 42000]);
    var cpaA = cpaB - pick([500, 1000, 1200]);

    return assemble(
      'judge', '대행사 리포트 해석',
      '대행사 월간 보고: 노출 +' + imp + '%, CTR ' + f1(ctrB) + '% → ' + f1(ctrA) + '%, CVR ' + f1(cvrB) + '% → ' +
        f1(cvrA) + '%, CPA ' + num(cpaB) + '원 → ' + num(cpaA) + '원.',
      '이 보고를 읽는 방식으로 가장 맞는 것은?',
      '노출을 넓혀 CTR은 희석됐지만 전환 효율이 올라 CPA는 지켰다 — 확장이 유효했는지는 신규 고객 비중으로 확인한다',
      [
        'CTR이 떨어졌으니 캠페인은 실패다',
        'CPA가 거의 그대로이므로 아무것도 달라지지 않았다',
        'CVR이 올랐으니 예산을 상위 소재 하나에 몰아야 한다'
      ],
      '노출이 ' + imp + '% 늘면 CTR은 자연히 희석된다. CTR이 ' + f1(ctrB) + '%에서 ' + f1(ctrA) + '%로 내려도 CVR이 ' +
        f1(cvrB) + '%에서 ' + f1(cvrA) + '%로 올라 CPA가 ' + num(cpaB) + '원에서 ' + num(cpaA) +
        '원으로 유지됐다면 도달 확장이 손해는 아니었다는 뜻이다. 판단은 신규 고객 비중과 LTV로 마무리한다.'
    );
  }

  /* 8. A/B 테스트 결과 판단 */
  function jAbTest() {
    var aRate = pick([3.0, 3.1, 3.4]);
    var aN = pick([3800, 4200, 4600]);
    var bRate = 2.4;
    var bN = pick([900, 1100, 1300]);
    var gap = aRate - bRate;

    return assemble(
      'judge', 'A/B 테스트 판단',
      'A/B 테스트: A안 전환율 ' + f1(aRate) + '%(노출 ' + num(aN) + '명), B안 ' + f1(bRate) + '%(노출 ' + num(bN) +
        '명). B안은 연휴 기간에만, A안은 평일 전체에 노출됐다.',
      '이 결과로 내릴 판단은?',
      '기간과 표본 조건이 달라 아직 결론을 내리기 이르니 같은 조건에서 다시 나눠 돌린다',
      [
        'A안이 ' + f1(gap) + '%p 높으니 전체에 바로 적용한다',
        'B안 노출이 적어도 비율이 낮으니 폐기한다',
        '두 안의 차이는 우연이므로 테스트를 그만둔다'
      ],
      'A안 ' + f1(aRate) + '%와 B안 ' + f1(bRate) + '%의 차이는 ' + f1(gap) +
        '%p지만, B안은 연휴에만 A안은 평일 전체에 돌아 조건이 다르다. 노출 ' + num(bN) +
        '명도 결론을 내리기에 적어 같은 기간·같은 타깃으로 다시 나눠야 한다.'
    );
  }

  /* 9. 성과 좋은 소재 vs 브랜드 톤 */
  function jBrandTone() {
    var loudCtr = pick([6.1, 6.4, 7.2]);
    var toneCtr = pick([1.9, 2.1, 2.4]);
    var loudCvr = pick([3.5, 3.8, 4.2]);

    return assemble(
      'judge', '브랜드 톤 vs 성과',
      '브랜드 가이드는 파스텔·차분한 톤. 이번 주 최고 성과 소재는 원색 배경에 큰 할인 문구를 넣은 B안(CTR ' +
        f1(loudCtr) + '%, CVR ' + f1(loudCvr) + '%), 가이드를 지킨 A안은 CTR ' + f1(toneCtr) + '%였다.',
      '기획자로서 판단으로 가장 맞는 것은?',
      'B안에서 성과를 만든 요소를 브랜드 톤 안에서 다시 만드는 실험을 설계하고, 반복 사용은 브랜드 인지 지표와 함께 본다',
      [
        '성과가 좋으니 톤 가이드를 폐기한다',
        '가이드가 우선이므로 B안은 더 보지 않는다',
        'A안과 B안을 번갈아 쓰면 둘 다 해결된다'
      ],
      'B안 CTR ' + f1(loudCtr) + '%와 A안 ' + f1(toneCtr) +
        '%의 차이는 색·문구 크기·할인 강조 같은 소재 요소에서 왔을 수 있다. 어떤 요소가 성과를 냈는지 분리해 브랜드 톤 안에서 다시 만들고, 톤 이탈이 브랜드 인지와 선호에 남기는 비용은 따로 본다.'
    );
  }

  /* 10. 화장품 광고 심의 */
  function jCosmeticReview() {
    var pct = pick([87, 92, 96]);
    var days = pick([3, 7, 14]);

    return assemble(
      'judge', '화장품 광고 심의',
      '올영세일 기획세트 상세페이지 문구 초안: "모공 ' + days + '일 만에 ' + pct + '% 축소", "피부 재생 효과", "임상 검증 완료". 세트는 기능성 화장품이 아닌 일반 화장품으로 분류된다.',
      '심의 관점에서 먼저 손볼 것은?',
      '효과를 단정하는 수치와 기능성 표현을 빼고, 근거 자료 범위 안의 표현으로 다시 쓴다',
      [
        '수치를 ' + pct + '%에서 조금 낮추면 통과된다',
        '"임상 검증 완료"가 있으면 나머지 표현은 괜찮다',
        '심의는 대행사 책임이므로 기획 단계에서는 보지 않는다'
      ],
      '일반 화장품에 모공 축소·재생 같은 기능성 표현과 수치 단정을 쓰면 심의에서 걸린다. 수치를 낮추는 것으로 풀리지 않고, 표현 자체를 허용 범위로 바꾸고 근거 자료가 있는 문장만 남기는 순서다.'
    );
  }

  /* 11. 오가닉·페이드 해석 */
  function jOrganicPaid() {
    var orgB = pick([15000, 18000, 21000]);
    var orgA = Math.round(orgB * pick([1.3, 1.45, 1.6]) / 100) * 100;
    var paidB = pick([20000, 22000, 24000]);
    var paidA = paidB - pick([800, 1000, 1500]);
    var cvB = pick([1700, 1900, 2100]);
    var cvA = cvB + pick([250, 350, 420]);

    return assemble(
      'judge', '오가닉·페이드 해석',
      '월 유입: 오가닉 ' + num(orgB) + ' → ' + num(orgA) + ', 페이드 ' + num(paidB) + ' → ' + num(paidA) +
        '. 총 전환은 ' + num(cvB) + ' → ' + num(cvA) + ', 광고비는 그대로.',
      '이 변화의 해석으로 가장 맞는 것은?',
      '오가닉이 늘어 총 전환이 올랐으니 채널별 전환을 나눠 콘텐츠·검색 자산이 일하고 있는지 확인한다',
      [
        '페이드가 줄었으니 광고를 더 집행해야 한다',
        '총 전환이 늘었으니 채널 구성은 그대로 둔다',
        '오가닉 증가는 광고의 부수 효과라 따로 볼 필요가 없다'
      ],
      '오가닉이 ' + num(orgB) + '에서 ' + num(orgA) + '으로 늘고 페이드가 ' + num(paidB) + '에서 ' + num(paidA) +
        '으로 줄었는데 전환은 ' + num(cvB) + '에서 ' + num(cvA) +
        '으로 올랐다. 광고비가 그대로라면 늘어난 전환의 출처를 채널별로 나눠 봐야 한다.'
    );
  }

  /* 12. SKU·품절 판단 */
  function jSkuStock() {
    var hit = pick([62, 68, 71]);
    var weeks = pick([2, 3]);
    var sku = pick([28, 32, 36]);

    return assemble(
      'judge', 'SKU·품절 판단',
      '시즌 결산: 상위 3개 SKU가 매출 ' + hit + '%, 이 중 1개는 4주 중 ' + weeks + '주 품절. 나머지 ' + sku +
        '개 SKU가 매출의 ' + (100 - hit) + '%를 나눠 가졌다.',
      '다음 시즌 기획 판단으로 가장 맞는 것은?',
      '품절난 히트 SKU의 공급과 옵션을 먼저 안정시키고, SKU 확장은 회전율과 재고 비용을 보고 정한다',
      [
        'SKU 수를 두 배로 늘려 매출을 만든다',
        '히트 SKU 하나에 집중하면 위험이 없으므로 나머지는 모두 단종한다',
        '품절은 물류팀 일이라 기획과 무관하다'
      ],
      '매출 ' + hit + '%가 3개 SKU에서 나오고 그중 1개가 4주 중 ' + weeks + '주 품절이면 지금 새는 매출은 공급에서 생긴다. 나머지 ' +
        sku + '개가 ' + (100 - hit) + '%를 나눠 갖는 구조에서 확장은 회전과 재고 비용을 먼저 계산해야 한다.'
    );
  }

  /* 13. 인지 캠페인 KPI */
  function jKpi() {
    var budget = pick([3000, 4000, 5000]);

    return assemble(
      'judge', '인지 캠페인 KPI',
      '신규 브랜드 인지 캠페인: 목표는 20~30대 여성의 브랜드 인지. 대행사가 제안한 KPI는 ROAS 300%와 구매 전환율 1.5%. 예산은 첫 캠페인 ' +
        num(budget) + '만 원.',
      'KPI 설계 판단으로 가장 맞는 것은?',
      '인지 단계 캠페인에는 도달·빈도·브랜드 검색량 같은 인지 지표를 주 KPI로 두고 전환 지표는 보조로 함께 본다',
      [
        '브랜드 캠페인도 결국 매출이므로 ROAS만 KPI로 둔다',
        'KPI는 캠페인이 끝난 뒤에 정한다',
        '인지도는 측정할 수 없으니 KPI를 두지 않는다'
      ],
      '목표가 브랜드 인지라면 성과를 재는 지표는 도달·빈도·브랜드 검색량·보조 인지 조사다. ROAS 300%는 판매 캠페인의 기준이라 이번 목표와 어긋나고, 구매 전환은 보조 지표로 두는 편이 맞다.'
    );
  }

  /* 14. 결제 퍼널 진단 */
  function jCheckout() {
    var views = pick([38000, 42000, 50000]);
    var cart = Math.round(views * pick([0.15, 0.18, 0.22]));
    var payStart = Math.round(cart * pick([0.38, 0.4, 0.45]));
    var done = Math.round(payStart * pick([0.85, 0.88, 0.9]));

    return assemble(
      'judge', '결제 퍼널 진단',
      '퍼널: 상품 조회 ' + num(views) + ' → 장바구니 ' + num(cart) + '(' + f1(cart / views * 100) + '%) → 결제 시작 ' +
        num(payStart) + '(' + f1(payStart / cart * 100) + '%) → 결제 완료 ' + num(done) + '(' + f1(done / payStart * 100) +
        '%). 업계 평균은 조회→장바구니 20%, 장바구니→결제 시작 65%, 결제 시작→완료 80%다.',
      '가장 먼저 손볼 구간은?',
      '장바구니에서 결제 시작으로 넘어가는 구간 — 배송비·회원가입·결제수단 노출을 확인한다',
      [
        '결제 완료율 ' + f1(done / payStart * 100) + '%가 낮으니 결제 대행사를 바꾼다',
        '조회 대비 장바구니가 ' + f1(cart / views * 100) + '%로 가장 낮으니 상품 목록을 새로 짠다',
        '전체 전환 ' + f2(done / views * 100) + '%는 흔한 수준이라 손댈 곳이 없다'
      ],
      '조회→장바구니 ' + f1(cart / views * 100) + '%는 업계 20%와 비슷하고 결제 완료율 ' + f1(done / payStart * 100) +
        '%도 80% 안팎이다. 반면 장바구니→결제 시작 ' + f1(payStart / cart * 100) +
        '%는 기준 65%보다 크게 낮아 이 구간에서 절반 가까이 빠진다. 배송비·회원가입·결제수단 노출을 먼저 본다.'
    );
  }

  /* 15. 시딩 성과 해석 */
  function jSeeding() {
    var people = pick([18, 20, 24]);
    var posted = people - pick([4, 6]);
    var saves = pick([9000, 12000, 15000]);
    var search = pick([28, 37, 45]);
    var conv = pick([12, 18, 24]);
    var missing = pick([2, 3, 5]);

    return assemble(
      'judge', '시딩 성과 해석',
      '시딩 캠페인: 참여 ' + people + '명 중 ' + posted + '명 게시, 저장 ' + num(saves) + '회, 같은 기간 브랜드 검색량 +' +
        search + '%, 전환 +' + conv + '%. 게시물 중 #광고 표기 누락 ' + missing + '건.',
      '판단으로 가장 맞는 것은?',
      '검색·전환이 함께 올라 기여한 것으로 보이지만 표기 누락은 먼저 정리하고, 기여도는 대조군 없이 단정하지 않는다',
      [
        '검색량이 늘었으니 매출 증가분 전부가 시딩 성과다',
        '표기 누락은 나중에 고지하면 문제없다',
        '게시물이 ' + posted + '건뿐이라 시딩은 효과가 없다'
      ],
      '검색 +' + search + '%, 전환 +' + conv +
        '%는 같은 기간 다른 요인도 섞인 값이라 대조군 없이 시딩 몫으로 단정하기 어렵다. 반면 #광고 표기 누락 ' + missing +
        '건은 바로 고쳐야 할 부분이라 먼저 정리한다.'
    );
  }

  /* 16. 협업 계약·표기 */
  function jCollab() {
    var fee = pick([300, 500, 700]);

    return assemble(
      'judge', '협업 계약·표기',
      '유튜버 영상에 제품을 3분 노출하고 제작비 ' + fee +
        '만 원을 지급하기로 했다. 브랜드 채널에도 재편집본을 올리고, 2차 광고 소재로도 쓰려 한다.',
      '계약·표기에서 먼저 정할 것은?',
      '대가성 광고 표기 방식과 2차 사용 범위·기간·매체를 계약서에 명시한다',
      [
        '제작비를 지급하면 자동으로 PPL이 된다',
        '브랜드 채널 재게시는 별도 합의가 필요 없다',
        '영상 길이의 절반이 넘으면 브랜디드 콘텐츠로 본다'
      ],
      '대가를 받고 제품을 노출하면 대가성 표기가 필요하고, 재편집본을 광고에 쓰는 것은 원래 계약 범위 밖일 수 있다. 표기 방식과 2차 사용 범위·기간·매체를 계약서에 적어 두는 것이 먼저다.'
    );
  }

  /* 17. 앰배서더 vs 모델 비교 */
  function jAmbassador() {
    var people = pick([10, 12, 15]);
    var nowSearch = pick([10, 12, 14]);
    var pastSearch = pick([18, 19, 22]);

    return assemble(
      'judge', '앰배서더 vs 모델',
      '앰배서더 ' + people + '명·3개월 총 비용 3,600만 원, 콘텐츠 48건. 지난해 모델 1명·6개월 4,000만 원, 콘텐츠 4건. 브랜드 검색량은 이번 +' +
        nowSearch + '%, 지난 캠페인 +' + pastSearch + '%.',
      '두 캠페인을 비교해 내릴 판단은?',
      '콘텐츠 양은 앰배서더가 많지만 검색량 상승은 지난 캠페인이 커서, 지표를 저장·검색·전환으로 나눠 다시 비교한다',
      [
        '콘텐츠가 48건이니 앰배서더 캠페인이 더 효과적이다',
        '검색량이 더 오른 쪽이 더 좋은 캠페인이다',
        '비용이 비슷하니 두 캠페인은 같은 성과다'
      ],
      '비용은 3,600만 원과 4,000만 원으로 비슷한데 콘텐츠는 48건과 4건, 검색량 상승은 +' + nowSearch + '%와 +' +
        pastSearch + '%로 엇갈린다. 무엇을 목표로 했는지에 따라 판단이 달라지므로 저장·검색·전환을 나눠 비교한다.'
    );
  }

  /* ============================================================
     실무 해석·판단 템플릿 (투자·재테크)
     ============================================================ */

  /* 1. 적금 금리 함정: 겉보기 이자 vs 실제 수령 */
  function jDepositTrap() {
    var monthly = pick([300000, 400000, 500000, 600000]);
    var r = pick([3, 3.5, 4, 4.5]);
    var ad = Math.round(monthly * 12 * r / 100);
    var real = Math.round(monthly * r / 100 * 6.5);

    return assemble(
      'judge', '적금 금리 함정',
      '적금 광고: 월 ' + num(monthly) + '원씩 12개월, 연 ' + f1(r) + '% 단리(세전). 광고 문구는 "1년 이자 ' + num(ad) + '원".',
      '이 광고를 어떻게 읽어야 하나?',
      '광고 이자는 원금 합계 ' + num(monthly * 12) + '원에 1년치 금리를 붙인 값이고, 실제로는 잔액이 쌓이는 구조라 이자가 그 절반 남짓(약 ' +
        num(real) + '원)이다',
      [
        '표시 금리가 연 ' + f1(r) + '%이므로 광고 이자가 맞다',
        '단리라서 복리보다 이자가 더 많다',
        '세전 이자가 ' + num(ad) + '원이므로 세후도 같다'
      ],
      '월 ' + num(monthly) + '원씩 12개월이면 원금 합계는 ' + num(monthly * 12) +
        '원이다. 1회차만 12개월, 12회차는 1개월만 맡기므로 평균 잔액은 원금의 절반 남짓이다. 단리 이자 ≈ ' + num(monthly) + ' × ' +
        f1(r) + '% × 6.5 = ' + num(real) + '원. 여기서 15.4%를 떼면 세후는 더 줄어든다.'
    );
  }

  /* 2. 환헤지 vs 환노출 */
  function jHedge() {
    var feeH = pick([0.25, 0.29, 0.35]);
    var feeU = pick([0.07, 0.09, 0.12]);
    var fx1 = pick([1280, 1300, 1320]);
    var fx2 = pick([1360, 1380, 1390]);
    var fxPct = (fx2 / fx1 - 1) * 100;

    return assemble(
      'judge', '환헤지 vs 환노출',
      '미국 지수 ETF 두 종류: 환헤지형(H) 총보수 연 ' + f2(feeH) + '%, 환노출형(U) 연 ' + f2(feeU) +
        '%. 최근 1년 원/달러 ' + num(fx1) + ' → ' + num(fx2) + '(+' + f1(fxPct) + '%). 환율 방향은 맞히지 않기로 했다.',
      '상품 선택 판단으로 가장 맞는 것은?',
      '환율 방향을 모르는 상태라면 총보수 차이와 환노출이 주는 분산 효과를 함께 보고, 한쪽으로 몰지 않는 선택을 검토한다',
      [
        '지난 1년 원화가 약했으므로 환노출형만 담는다',
        '환헤지는 환차손을 없애므로 보수가 더 비싸도 유리하다',
        '총보수가 낮은 상품이 더 높은 수익을 낸다'
      ],
      'H와 U의 총보수 차이는 연 ' + f2(feeH - feeU) + '%p다. 환노출형은 원화 약세에 유리하고 강세에 불리하며 환헤지형은 반대다. 방향을 모른다면 최근 1년 ' +
        f1(fxPct) + '% 상승을 근거로 한쪽에 몰기보다 보수 차이와 분산 효과를 함께 본다.'
    );
  }

  /* 3. 영업이익 흑자 · 당기순이익 적자 */
  function jOpNet() {
    var op = pick([60, 80, 120]);
    var interest = Math.round(op * 0.7);
    var fx = Math.round(op * 0.55);
    var net = op - interest - fx;
    var sales = pick([900, 1200, 1500]);

    return assemble(
      'judge', '영업이익 vs 순이익',
      'A사 손익: 매출 ' + num(sales) + '억 원, 영업이익 ' + num(op) + '억 원 흑자, 당기순이익 ' + sgn(num(net)) +
        '억 원. 같은 기간 이자비용 ' + num(interest) + '억 원, 영업외 환차손 ' + num(fx) + '억 원.',
      '이 회사의 상태를 읽는 방식으로 가장 맞는 것은?',
      '본업은 이익을 내고 있지만 이자·환차손 같은 영업외 비용이 이를 넘어 순손실이 난 구조 — 이자보상배율과 차입금 만기를 함께 본다',
      [
        '영업이익이 흑자이므로 순손실은 회계상 착시다',
        '매출이 ' + num(sales) + '억 원이므로 현금흐름도 문제없다',
        '순손실이므로 본업에서도 손실이 나고 있다'
      ],
      '영업이익 ' + num(op) + '억 원에서 이자 ' + num(interest) + '억 원과 환차손 ' + num(fx) + '억 원을 빼면 ' + sgn(num(net)) +
        '억 원이 된다. 본업의 수익성과 재무비용을 나눠 봐야 하고, 이자비용이 영업이익의 ' + Math.round(interest / op * 100) +
        '%를 먹는 구조라 차입금 만기와 금리 조건을 확인한다.'
    );
  }

  /* 4. 샤프지수 비교 */
  function jSharpe() {
    var rf = pick([1, 1.5, 2]);
    var rA = pick([14, 16, 18]);
    var rB = pick([7, 8, 9]);
    var vB = pick([8, 9, 10]);
    /* 수익률은 A가 높지만 위험 대비 효율은 B가 높도록 A의 변동성을 잡는다 */
    var vA = Math.ceil(vB * (rA - rf) / (rB - rf) * pick([1.2, 1.3, 1.4]) * 10) / 10;
    if (vA > 45) return null;
    var shA = (rA - rf) / vA;
    var shB = (rB - rf) / vB;
    if (shA >= shB) return null;

    return assemble(
      'judge', '샤프지수 비교',
      '펀드 A: 연 수익률 ' + rA + '%, 변동성 ' + f1(vA) + '%. 펀드 B: 수익률 ' + rB + '%, 변동성 ' + vB + '%. 무위험금리는 연 ' + f1(rf) + '%.',
      '효율 판단으로 가장 맞는 것은?',
      '수익률은 A가 높지만 같은 위험을 감수한 대가(샤프지수)는 B가 높다 — 목표 수익과 감내 가능한 변동성을 함께 정해 고른다',
      [
        '수익률이 높은 A가 효율도 높다',
        '샤프지수가 높으면 수익률도 더 높다',
        '변동성이 낮으면 수익률은 따질 필요가 없다'
      ],
      '샤프지수 = (수익률 − 무위험금리) ÷ 변동성. A는 (' + rA + ' − ' + f1(rf) + ') ÷ ' + f1(vA) + ' ≈ ' + f2(shA) + ', B는 (' + rB +
        ' − ' + f1(rf) + ') ÷ ' + vB + ' ≈ ' + f2(shB) + '. A의 수익률이 높아도 감수한 위험 대비 효율은 B가 앞선다.'
    );
  }

  /* 5. 계좌 배분 판단 */
  function jAccountChoice() {
    var salary = pick([2800, 3200, 3600]);
    var fin = pick([200, 300, 400]);
    var deposit = pick([1500, 2000]);

    return assemble(
      'judge', '계좌 배분 판단',
      '올해 근로소득 ' + num(salary) + '만 원, 금융소득 ' + num(fin) + '만 원. 5년 뒤 전세 보증금 ' + num(deposit) +
        '만 원이 필요하고 노후 자금도 같이 모으고 싶다. 여윳돈은 월 40만 원.',
      '계좌 배분 판단으로 가장 맞는 것은?',
      '전세 자금은 중도 인출이 쉬운 곳에 두고, 노후 자금은 연금저축·IRP 세액공제 한도까지 나눠 담는 쪽을 검토한다',
      [
        '5년 뒤 쓸 돈이므로 연금저축에 전부 넣는다',
        '세액공제를 받으려면 ISA를 먼저 채워야 한다',
        '금융소득이 ' + num(fin) + '만 원이면 계좌를 새로 만들 수 없다'
      ],
      '연금저축·IRP는 중도 인출 때 세액공제 받은 금액을 다시 내야 해서 5년 뒤 쓸 돈에는 맞지 않는다. 전세 자금은 ISA·파킹통장처럼 꺼내기 쉬운 곳에 두고, 여윳돈 40만 원 중 노후 몫은 연금저축·IRP 한도(합 900만 원)까지 채우는 배분이 검토 대상이다.'
    );
  }

  /* 6. 비상금 우선순위 */
  function jEmergency() {
    var cash = pick([100, 120, 150]);
    var living = 150;
    var target = living * 3;
    var deposit = pick([200, 250]);

    return assemble(
      'judge', '비상금 우선순위',
      '현금 ' + num(cash) + '만 원, 카드 할부 잔액 300만 원(연 15%), 주식 1,800만 원(전액 성장주). 월 저축 40만 원, 생활비 ' +
        num(living) + '만 원. 다음 달 보증금 증액 ' + num(deposit) + '만 원 예정.',
      '이 상태에서 먼저 할 일로 가장 맞는 것은?',
      '보증금 증액분과 3개월 생활비를 안전한 곳에 확보하고, 연 15% 할부는 상환 계획을 앞당긴다',
      [
        '주식이 1,800만 원이라 비상금은 따로 두지 않는다',
        '할부 금리보다 주식 기대수익이 높으니 투자를 늘린다',
        '현금을 전부 성장주에 넣어 수익률을 맞춘다'
      ],
      '비상금은 3개월 생활비 기준 ' + num(target) + '만 원이고, 여기에 보증금 증액 ' + num(deposit) +
        '만 원이 겹친다. 현금 ' + num(cash) + '만 원으로는 모자라니 주식 일부를 안전자산으로 옮기고, 연 15% 할부는 같은 금액을 투자로 메우기 어려운 확정 비용이라 먼저 줄인다.'
    );
  }

  /* 7. 금리와 채권 가격 */
  function jRateBond() {
    var y1 = pick([3.1, 3.2, 3.4]);
    var d = pick([0.6, 0.7, 0.8]);
    var y2 = Math.round((y1 + d) * 10) / 10;
    var dur = pick([10, 12, 14]);
    var chg = Math.round((y2 - y1) * 10) / 10;

    return assemble(
      'judge', '금리와 채권 가격',
      '국고채 10년물 금리가 ' + f1(y1) + '% → ' + f1(y2) + '%로 올랐다. 보유 ETF는 장기 국채(듀레이션 ' + dur +
        '), 단기 채권형(듀레이션 1.5), 배당주 ETF다.',
      '이 국면의 해석으로 가장 맞는 것은?',
      '금리가 오르면 기존 채권 가격은 내려가고 듀레이션이 긴 상품이 더 크게 흔들린다 — 보유 목적이 만기 보유인지 매매인지 확인한다',
      [
        '금리가 오르면 보유 채권 가격도 함께 오른다',
        '듀레이션이 길수록 금리 변화에 덜 민감하다',
        '배당주는 금리와 무관하므로 손댈 필요가 없다'
      ],
      '금리가 ' + f1(y1) + '%에서 ' + f1(y2) + '%로 ' + f1(chg) + '%p 오르면 가격은 대략 −' + f1(chg) + '% × 듀레이션만큼 움직인다. 장기 국채 듀레이션 ' +
        dur + '이면 −' + f1(chg * dur) + '% 수준의 평가손실이 날 수 있고 단기 채권형은 훨씬 작다.'
    );
  }

  /* 8. 환율과 원화 손익 */
  function jFxEffect() {
    var usd = 10000;
    var fxBuy = pick([1280, 1300, 1320]);
    var dropPct = pick([4, 6, 8]);
    /* 환율 상승폭은 주가 하락폭보다 작게 잡아 원화 기준으로도 손실이 나는 상황을 만든다 */
    var rise = Math.round(dropPct * pick([0.3, 0.4, 0.5]));
    var fxNow = Math.round(fxBuy * (1 + rise / 100) / 10) * 10;
    if (fxNow <= fxBuy) return null;
    var usdNow = usd * (1 - dropPct / 100);
    var krwNow = usdNow * fxNow;
    var krwBuy = usd * fxBuy;
    var pct = (krwNow / krwBuy - 1) * 100;
    if (pct >= -0.5) return null;

    return assemble(
      'judge', '환율과 원화 손익',
      '미국 주식 ' + num(usd) + '달러어치를 원/달러 ' + num(fxBuy) + '원에 매수했다. 지금 주가는 ' + dropPct + '% 하락, 환율은 ' + num(fxNow) +
        '원. 수수료·세금은 제외.',
      '원화 기준 평가손익 해석으로 가장 맞는 것은?',
      '주가 하락분을 환율 상승이 일부 상쇄해 원화로는 약 ' + sgn(f1(pct)) + '% 수준이다',
      [
        '주가가 ' + dropPct + '% 빠졌으니 원화 손실도 ' + dropPct + '%다',
        '환율이 올랐으므로 원화 평가액은 그대로다',
        '환차익이 났으므로 원화로는 수익 구간이다'
      ],
      '달러 평가액 = ' + num(usd) + ' × (1 − ' + dropPct + '%) = ' + num(usdNow) + '달러. 원화로는 ' + num(usdNow) + ' × ' + num(fxNow) + ' = ' +
        num(krwNow) + '원이고 매수 금액은 ' + num(usd) + ' × ' + num(fxBuy) + ' = ' + num(krwBuy) + '원이라 ' + sgn(f1(pct)) + '%다.'
    );
  }

  /* 9. 배당수익률·배당락 */
  function jDividend() {
    var price = pick([8000, 10000, 12000, 15000]);
    var y = pick([3.5, 4, 4.8, 5.2]);
    var div = Math.round(price * y / 100 / 10) * 10;
    if (div <= 0) return null;

    return assemble(
      'judge', '배당수익률·배당락',
      '배당주 A: 주가 ' + num(price) + '원, 주당 배당금 ' + num(div) + '원, 배당락일은 3일 뒤. 보유 계획 기간은 3일이다.',
      '이 판단으로 가장 맞는 것은?',
      '배당락일에 주가는 배당금만큼 조정될 수 있어, 3일 보유로 배당만 챙기는 전략은 세금과 거래비용까지 따져야 한다',
      [
        '배당락일 전에 사면 배당과 주가 상승을 함께 얻는다',
        '배당수익률 ' + f1(div / price * 100) + '%는 세후 수익률이다',
        '배당락일 이후에 사도 그 배당은 지급된다'
      ],
      '배당수익률은 ' + num(div) + ' ÷ ' + num(price) + ' × 100 = ' + f1(div / price * 100) +
        '%다. 배당락일에는 주가가 배당금만큼 내려간 상태로 거래가 시작되고, 배당소득에는 15.4%가 원천징수된다. 3일 보유로 얻는 배당 ' +
        num(div) + '원에서 세금과 거래비용을 빼면 남는 폭은 작다.'
    );
  }

  /* 10. MDD와 리밸런싱 */
  function jMddRebalance() {
    var mdd = pick([15, 18, 22]);
    var cur = pick([62, 64, 66]);

    return assemble(
      'judge', 'MDD와 리밸런싱',
      '내 포트폴리오 계획은 주식 70% · 채권 30%. 3개월 MDD −' + mdd + '%를 지나 주식 비중이 ' + cur +
        '%로 내려왔다. 현금 여력은 월 30만 원.',
      '다음 액션 판단으로 가장 맞는 것은?',
      '계획 비중과 벌어진 만큼 채권을 팔아 주식을 사는 리밸런싱을 검토하되, 거래비용·세금과 현금 여력을 함께 본다',
      [
        'MDD가 컸으므로 손실을 확정하고 전부 현금으로 바꾼다',
        '주식 비중이 이미 줄었으니 계획을 현재 비중으로 고친다',
        '리밸런싱은 1년에 한 번만 하는 것이므로 지금은 아무것도 하지 않는다'
      ],
      '계획 70%에서 ' + cur + '%로 내려왔다는 것은 주식이 그만큼 더 빠졌다는 뜻이다. 계획을 지키는 방식이라면 채권을 팔아 주식을 채우는 계산이 나오고, 규모는 현금 여력 30만 원과 거래비용·세금을 보고 정한다.'
    );
  }

  /* 11. PER 비교의 함정 */
  function jPerCompare() {
    var perA = pick([7, 8, 9]);
    var growA = pick([3, 5, 7]);
    var debtA = pick([180, 210, 240]);
    var perB = pick([30, 35, 40]);
    var growB = pick([28, 32, 36]);
    var debtB = pick([35, 40, 45]);

    return assemble(
      'judge', 'PER 비교의 함정',
      'A사 PER ' + perA + '배, 이익 성장률 −' + growA + '%, 부채비율 ' + debtA + '%. B사 PER ' + perB + '배, 성장률 +' + growB +
        '%, 부채비율 ' + debtB + '%.',
      '이 비교를 읽는 방식으로 가장 맞는 것은?',
      'PER만으로 싸다·비싸다를 정할 수 없어 성장률·이익의 질·재무구조를 함께 붙여 본다',
      [
        'PER이 낮은 A사가 B사보다 저평가다',
        'PER이 높은 B사는 거품이므로 피한다',
        '부채비율은 PER과 함께 보지 않는다'
      ],
      'A는 PER ' + perA + '배로 낮지만 이익이 줄고 부채비율 ' + debtA + '%이며, B는 PER ' + perB + '배로 높지만 성장률 +' + growB +
        '%, 부채비율 ' + debtB + '%다. 낮은 PER은 이익 감소를 반영한 값일 수 있어 성장률·이익의 질·재무구조를 같이 봐야 한다.'
    );
  }

  /* 12. 공모주 청약 판단 */
  function jIpo() {
    var price = pick([18000, 24000, 32000]);
    var ratio = pick([820, 1120, 1450]);
    var oblig = pick([8, 12, 18]);
    var floatPct = pick([26, 32, 38]);

    return assemble(
      'judge', '공모주 청약 판단',
      '공모주 청약: 희망밴드 상단 ' + num(price) + '원, 기관 경쟁률 ' + num(ratio) + ':1, 의무보유확약 ' + oblig +
        '%, 상장일 유통가능 물량 ' + floatPct + '%.',
      '청약 판단으로 가장 맞는 것은?',
      '경쟁률은 높지만 의무보유확약이 낮고 유통물량이 많으면 상장 직후 변동성이 커질 수 있어, 배정 수량과 감당 가능한 금액을 먼저 정한다',
      [
        '경쟁률이 1,000:1을 넘으면 첫날 매도가 유리하다',
        '의무보유확약이 낮을수록 주가가 안정된다',
        '유통물량 ' + floatPct + '%는 청약 판단과 관계없다'
      ],
      '경쟁률 ' + num(ratio) + ':1은 수요가 몰렸다는 신호지만, 의무보유확약 ' + oblig +
        '%는 기관이 얼마나 오래 들고 있겠다고 약속했는지를 보여준다. 확약이 낮고 유통물량이 ' + floatPct +
        '%면 상장 직후 매물이 나올 수 있어 청약 전에 감당할 금액을 정해 두는 편이 낫다.'
    );
  }

  /* 13. 연금저축·IRP 세액공제 */
  function jPension() {
    var salary = pick([4800, 5200, 5500]);
    var pension = pick([300, 400]);
    var irp = pick([200, 300]);
    var paid = pension + irp;
    var cap = 900;
    var add = cap - paid;
    var rateV = salary <= 5500 ? 16.5 : 13.2;
    var now = paid * rateV / 100;
    var gain = add * rateV / 100;

    return assemble(
      'judge', '연금저축 세액공제',
      '총급여 ' + num(salary) + '만 원. 올해 연금저축 ' + pension + '만 원 + IRP ' + irp + '만 원을 납입했다. 중도 인출 계획은 없고 한도는 연금저축 600만 + IRP 300만(합 900만).',
      '판단으로 가장 맞는 것은?',
      '한도까지 ' + add + '만 원을 더 넣으면 공제율 ' + f1(rateV) + '% 기준 약 ' + f1(gain) + '만 원을 더 돌려받는 구조다',
      [
        '한도를 넘겨 납입해도 전액 공제된다',
        'IRP는 중도 인출이 자유로우므로 비상금을 넣어도 된다',
        '총급여 ' + num(salary) + '만 원은 공제율 12% 구간이라 지금 납입으로 한도가 끝난다'
      ],
      '납입 ' + paid + '만 원에 공제율 ' + f1(rateV) + '%면 ' + f1(now) + '만 원을 돌려받는다. 연금저축·IRP 한도 900만 원까지 ' + add +
        '만 원을 더 넣으면 ' + f1(gain) + '만 원이 늘어난다. 다만 중도 인출 때 공제받은 금액을 다시 내야 하므로 묶어 둘 돈인지 먼저 확인한다.'
    );
  }

  /* 14. 금융소득종합과세 */
  function jFinIncomeTax() {
    var income = pick([1700, 1800, 1900]);
    var div = pick([400, 500, 600]);
    var extra = pick([400, 500, 600]);
    var salary = pick([3800, 4200, 4600]);
    var over = income + extra - 2000;

    return assemble(
      'judge', '금융소득종합과세',
      '올해 이자·배당 합계 ' + num(income) + '만 원(이 중 배당 ' + num(div) + '만 원), 근로소득 ' + num(salary) +
        '만 원. 배당 ' + num(extra) + '만 원을 더 받을 수 있는 상품이 있다.',
      '판단으로 가장 맞는 것은?',
      '2,000만 원을 넘는 초과분이 종합소득에 합산돼 더 높은 세율과 건강보험료 피부양자 요건에 영향을 줄 수 있어, 초과분의 세율을 계산해 본다',
      [
        '2,000만 원을 넘어도 초과분은 15.4%로 끝난다',
        '근로소득이 있으면 금융소득은 합산되지 않는다',
        '배당을 더 받으면 세금은 늘지 않는다'
      ],
      '금융소득이 ' + num(income) + '만 원에서 ' + num(income + extra) + '만 원으로 늘면 2,000만 원 초과분 ' + num(over) +
        '만 원이 종합소득에 합산된다. 초과분에는 종합세율이 적용되고 건강보험료 요건도 함께 흔들릴 수 있어, ISA 같은 분리과세 상품과 같이 계산해 본다.'
    );
  }

  /* 15. 목돈 집행 방식 */
  function jLumpSum() {
    var amount = pick([2000, 3000, 4000]);
    var years = pick([3, 5, 7]);

    return assemble(
      'judge', '목돈 집행 방식',
      num(amount) + '만 원 목돈, ' + years +
        '년 뒤 사용 예정. 시장 전망은 "고점 부근"과 "조정 국면"으로 갈리고, 같은 기간 변동성 큰 구간이 반복됐다.',
      '집행 방식 판단으로 가장 맞는 것은?',
      '방향을 맞히려 하기보다 기간을 나눠 넣는 방식을 검토하고, 중간에 쓸 돈은 따로 두어 손실 구간에 팔지 않게 설계한다',
      [
        '고점이라는 의견이 있으니 전액 대기하다 바닥에서 산다',
        years + '년 뒤 쓸 돈이므로 전액을 주식에 한 번에 넣는다',
        '적립식은 수익률이 낮으므로 목돈에는 쓰지 않는다'
      ],
      '전망이 갈리고 변동성이 큰 구간이 반복됐다면 진입 시점 하나에 결과가 걸리지 않게 나눠 넣는 방식을 검토한다. ' + years +
        '년 뒤 쓸 돈은 만기 구조를 맞추고, 중간에 필요한 금액은 따로 두어 하락 구간에 팔지 않도록 설계한다.'
    );
  }

  /* 16. 예금자보호 한도와 배분 */
  function jProtection() {
    var total = pick([12000, 15000]);
    var short = pick([2000, 3000]);
    var over = total - 5000;

    return assemble(
      'judge', '예금자보호 배분',
      '예금 ' + num(total) + '만 원을 한 은행에 두려 한다. 예금자보호 한도는 5,000만 원. 6개월 뒤 쓸 돈 ' + num(short) +
        '만 원, 나머지는 3년 묵힐 돈이다.',
      '배분 판단으로 가장 맞는 것은?',
      '보호 한도를 넘는 금액은 은행을 나누거나 만기 구조를 달리 하고, 6개월 뒤 쓸 돈은 수시입출 가능한 곳에 둔다',
      [
        '예금자보호는 은행당 1억 원까지이므로 그대로 둔다',
        '보호 한도를 넘어도 은행이 망하지 않으니 상관없다',
        '3년 묵힐 돈은 CMA에 두면 예금자보호가 된다'
      ],
      '한도 5,000만 원을 넘는 ' + num(over) + '만 원은 보호되지 않는다. 은행과 상품을 나눠 한도 안으로 맞추고, 6개월 뒤 쓸 ' + num(short) +
        '만 원은 파킹통장처럼 수시입출되는 곳에 두어 만기 제약을 피한다.'
    );
  }

  /* 17. ETF 총보수 비용 */
  function jFundFee() {
    var feeA = pick([0.05, 0.07, 0.09]);
    var feeB = pick([0.35, 0.45, 0.58]);
    var gap = Math.round((feeB - feeA) * 100) / 100;
    var diff = Math.round(10000000 * gap / 100 * 10);

    return assemble(
      'judge', 'ETF 총보수 비용',
      '같은 지수를 따르는 ETF A 총보수 연 ' + f2(feeA) + '%, B 연 ' + f2(feeB) +
        '%. 1,000만 원을 10년 보유한다고 가정한다(수익률은 같다고 본다).',
      '이 차이를 읽는 방식으로 가장 맞는 것은?',
      '보수 차이 ' + f2(gap) + '%p는 10년에 약 ' + num(diff) + '원의 비용 차이로, 장기 보유일수록 상품 선택에서 비중이 커진다',
      [
        '총보수는 매수할 때 한 번만 내는 수수료다',
        '보수 차이는 수익률에 영향을 주지 않는다',
        '보수가 낮은 상품은 환매가 어렵다'
      ],
      '1,000만 원 × ' + f2(gap) + '% × 10년 ≈ ' + num(diff) +
        '원. 총보수는 매년 조금씩 빠져나가는 비용이라 기간이 길수록 누적 차이가 커진다. 다만 추적오차와 거래량은 따로 확인해야 한다.'
    );
  }

  /* 18. 손실 회복의 비대칭 */
  function jLossRecovery() {
    var loss = pick([20, 30, 40, 50]);
    var weight = pick([35, 45, 55]);
    var need = (1 / (1 - loss / 100) - 1) * 100;

    return assemble(
      'judge', '손실 회복 비대칭',
      '보유 종목이 −' + loss + '% 빠졌다. 원금 회복까지 필요한 수익률을 계산해 보려 한다. 같은 업종 비중이 포트폴리오의 ' + weight + '%.',
      '이 상황의 해석으로 가장 맞는 것은?',
      '−' + loss + '% 손실을 되돌리려면 약 +' + f1(need) + '%가 필요해 손실 회복은 비대칭이고, 업종 비중 ' + weight + '%가 적절한지 먼저 본다',
      [
        '−' + loss + '% 빠졌으니 +' + loss + '% 오르면 원금이다',
        '손실을 만회하려면 같은 종목 비중을 늘리는 것이 낫다',
        '업종 비중은 손실 회복과 관계없다'
      ],
      '−' + loss + '% 뒤 원금이 되려면 1 ÷ (1 − ' + loss + '%) − 1 = +' + f1(need) +
        '%가 필요하다. 손실이 클수록 회복에 필요한 상승폭이 커지므로, 특정 업종 비중 ' + weight + '%가 몰려 있는지와 손실 제한 규칙을 함께 점검한다.'
    );
  }

  /* ============================================================
     개념 동적 조합 템플릿 (보충용)
     ============================================================ */

  function conceptPool(domain, data, used) {
    if (!data || !data.terms || !data.terms.length) return [];
    var pool = [];
    for (var i = 0; i < data.terms.length; i++) {
      var t = data.terms[i];
      if (!t || !t.term || !t.def) continue;
      if (used && used[t.id]) continue;
      pool.push(t);
    }
    return pool;
  }

  function conceptForward(domain, data, used) {
    var pool = conceptPool(domain, data, used);
    if (pool.length < 4) pool = conceptPool(domain, data, null);
    var t = pick(pool);
    var rest = shuffle(conceptPool(domain, data, null).filter(function (x) { return x.id !== t.id; }));
    if (rest.length < 3) return null;
    var distract = rest.slice(0, 3);

    var names = [];
    var parts = [];
    [t].concat(distract).forEach(function (x) {
      names.push(x.term);
      parts = parts.concat(nameParts(x.term));
    });
    var def = maskText(t.def, parts, '○○');
    if (def.replace(/○○/g, '').trim().length < 8) return null;

    return assemble(
      'concept', t.term,
      def,
      '다음 설명에 해당하는 개념은?',
      t.term,
      distract.map(function (x) { return x.term; }),
      t.term + ' — ' + t.def + (t.tip ? ' ' + t.tip : ''),
      t.id
    );
  }

  function conceptReverse(domain, data, used) {
    var pool = conceptPool(domain, data, used);
    if (pool.length < 4) pool = conceptPool(domain, data, null);
    var t = pick(pool);
    var asked = nameParts(t.term);
    var rest = conceptPool(domain, data, null).filter(function (x) {
      return x.id !== t.id && !containsAny(x.def, asked);
    });
    if (rest.length < 3) {
      rest = conceptPool(domain, data, null).filter(function (x) { return x.id !== t.id; });
    }
    if (rest.length < 3) return null;
    var distract = shuffle(rest).slice(0, 3);

    var correctDef = maskText(t.def, asked, '이 개념');
    if (correctDef.replace(/이 개념/g, '').trim().length < 8) return null;

    return assemble(
      'concept', t.term,
      t.tip || '실무에서 이 개념이 쓰이는 상황을 떠올려 보자.',
      '“' + t.term + '”에 대한 설명으로 가장 알맞은 것은?',
      correctDef,
      distract.map(function (x) { return x.def; }),
      t.term + ' — ' + t.def + (t.tip ? ' ' + t.tip : ''),
      t.id
    );
  }

  /* ============================================================
     라운드 조립
     6문제 = 기초 산수 1 + 실무 해석·판단 5 (자리가 모자라면 개념 조합으로 보충)
     ============================================================ */

  var CALC = {
    marketing: [tplCtr, tplCvr, tplRoas, tplCac, tplContribution, tplSku],
    finance: [tplNetInterest, tplRealReturn, tplRule72, tplPer, tplDividendYield, tplMdd]
  };

  var JUDGE = {
    marketing: [
      jFunnelLeak, jCpaLtv, jCacLtv, jLandingBounce, jRetention, jViralLoop,
      jAgencyReport, jAbTest, jBrandTone, jCosmeticReview, jOrganicPaid, jSkuStock,
      jKpi, jCheckout, jSeeding, jCollab, jAmbassador
    ],
    finance: [
      jDepositTrap, jHedge, jOpNet, jSharpe, jAccountChoice, jEmergency,
      jRateBond, jFxEffect, jDividend, jMddRebalance, jPerCompare, jIpo,
      jPension, jFinIncomeTax, jLumpSum, jProtection, jFundFee, jLossRecovery
    ]
  };

  function build(domain, data, count) {
    var want = count || 6;
    if (!CALC[domain] || !data) return [];
    var out = [];
    var usedConcept = {};
    var i;

    /* 1) 기초 산수는 라운드당 한 문제만 */
    var calcCount = want >= 2 ? 1 : 0;
    var calcs = shuffle(CALC[domain].slice());
    for (i = 0; i < calcs.length && out.length < calcCount; i++) {
      var cq = attempt(calcs[i], domain, data);
      if (cq) out.push(cq);
    }

    /* 2) 실무 해석·판단으로 나머지를 채운다 (같은 템플릿을 한 라운드에 두 번 쓰지 않는다) */
    var judges = shuffle(JUDGE[domain].slice());
    for (i = 0; i < judges.length && out.length < want; i++) {
      var jq = attempt(judges[i], domain, data);
      if (jq) out.push(jq);
    }

    /* 3) 그래도 모자라면 판단 템플릿을 다시 돌리고, 마지막에 개념 조합으로 채운다 */
    for (i = 0; i < 30 && out.length < want; i++) {
      var extra = attempt(pick(JUDGE[domain]), domain, data);
      if (extra) out.push(extra);
    }
    for (i = 0; i < 20 && out.length < want; i++) {
      var fq = i % 2 === 0
        ? conceptForward(domain, data, usedConcept)
        : conceptReverse(domain, data, usedConcept);
      if (fq && !usedConcept[fq.conceptId]) {
        usedConcept[fq.conceptId] = true;
        out.push(fq);
      }
    }

    /* id 부여 + 라운드 안 같은 문제 중복 제거 */
    var seen = {};
    var unique = [];
    for (i = 0; i < out.length; i++) {
      var q = out[i];
      if (!q) continue;
      var key = q.kind + '|' + q.topic + '|' + q.question;
      if (seen[key]) continue;
      seen[key] = true;
      q.id = newId(domain);
      unique.push(q);
    }
    return unique;
  }

  global.QuizGen = {
    build: build,
    version: '2.0',
    /* 테스트에서 개별 템플릿을 직접 돌려보기 위한 노출 */
    _templates: {
      marketing: {
        ctr: tplCtr, cvr: tplCvr, roas: tplRoas, cac: tplCac,
        contribution: tplContribution, sku: tplSku
      },
      finance: {
        netInterest: tplNetInterest, realReturn: tplRealReturn, rule72: tplRule72,
        per: tplPer, dividendYield: tplDividendYield, mdd: tplMdd
      }
    },
    _judge: {
      marketing: {
        funnelLeak: jFunnelLeak, cpaLtv: jCpaLtv, cacLtv: jCacLtv, landingBounce: jLandingBounce,
        retention: jRetention, viralLoop: jViralLoop, agencyReport: jAgencyReport, abTest: jAbTest,
        brandTone: jBrandTone, cosmeticReview: jCosmeticReview, organicPaid: jOrganicPaid,
        skuStock: jSkuStock, kpi: jKpi, checkout: jCheckout, seeding: jSeeding,
        collab: jCollab, ambassador: jAmbassador
      },
      finance: {
        depositTrap: jDepositTrap, hedge: jHedge, opNet: jOpNet, sharpe: jSharpe,
        accountChoice: jAccountChoice, emergency: jEmergency, rateBond: jRateBond,
        fxEffect: jFxEffect, dividend: jDividend, mddRebalance: jMddRebalance,
        perCompare: jPerCompare, ipo: jIpo, pension: jPension, finIncomeTax: jFinIncomeTax,
        lumpSum: jLumpSum, protection: jProtection, fundFee: jFundFee, lossRecovery: jLossRecovery
      }
    },
    _concept: { forward: conceptForward, reverse: conceptReverse }
  };
})(typeof window !== 'undefined' ? window : this);
