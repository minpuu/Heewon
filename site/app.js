/* 학습 노트 · 마케팅 / 투자·재테크
   데이터는 data/marketing.json, data/finance.json에서 읽는다.
   새 개념·문제는 JSON 배열에 항목을 추가하면 화면에 그대로 반영된다. */
(function () {
  'use strict';

  var DOMAINS = {
    marketing: { label: '마케팅 실무', file: 'data/marketing.json' },
    finance: { label: '투자·재테크', file: 'data/finance.json' }
  };
  var STORE_KEY = 'heewon.quiz.v1';
  var SEEN_KEY = 'heewon.quiz.seen.v1';
  var GEN_KEY = 'heewon.quiz.gen.v1';
  var GEN_CAP = 200;
  var ROUND_SIZE = 10;
  var DYNAMIC_PER_ROUND = 6;

  var state = {
    domain: null,
    view: 'lessons',
    data: {},
    pool: {},
    query: '',
    keyOnly: false,
    open: {},
    sessions: {},
    loadError: {}
  };

  var pending = {};
  var viewEl = null;

  /* ---------- helpers ---------- */

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- 저장소 ---------- */

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeStore(value) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
    } catch (err) { /* 사생활 보호 모드 등 저장 불가 환경은 무시 */ }
  }

  function savedAnswers(domain) {
    var all = readStore();
    var one = all[domain];
    return one && typeof one === 'object' ? one : {};
  }

  function saveAnswer(domain, quizId, pick) {
    var all = readStore();
    if (!all[domain] || typeof all[domain] !== 'object') all[domain] = {};
    all[domain][quizId] = pick;
    writeStore(all);
  }

  function clearAnswers(domain) {
    var all = readStore();
    delete all[domain];
    writeStore(all);
    var gen = readGenAll();
    delete gen[domain];
    writeGenAll(gen);
    state.pool[domain] = {};
  }

  /* 최근에 어떤 문제가 나왔는지 — 은행을 한 바퀴 돌면 비워 다시 섞는다. */

  function readSeen(domain) {
    try {
      var all = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '{}');
      var one = all && all[domain];
      return Array.isArray(one) ? one : [];
    } catch (err) {
      return [];
    }
  }

  function writeSeen(domain, ids) {
    var all = {};
    try {
      all = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '{}') || {};
    } catch (err) {
      all = {};
    }
    all[domain] = ids;
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(all));
    } catch (err) { /* 저장 불가 환경은 무시 */ }
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

  /* ---------- 동적으로 생성한 문제 보관 ----------
     계산·개념 문제는 매번 숫자와 조합이 달라서 문제 객체 자체를 저장해야
     나중에 "틀린 문제만 다시 풀기"에서 같은 문제를 그대로 복습할 수 있다. */

  function readGenAll() {
    try {
      var raw = window.localStorage.getItem(GEN_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeGenAll(all) {
    try {
      window.localStorage.setItem(GEN_KEY, JSON.stringify(all));
    } catch (err) { /* 저장 불가 환경은 무시 */ }
  }

  function poolOf(domain) {
    if (!state.pool[domain]) {
      var all = readGenAll();
      var one = all[domain];
      state.pool[domain] = one && typeof one === 'object' ? one : {};
    }
    return state.pool[domain];
  }

  function persistPool(domain) {
    var all = readGenAll();
    all[domain] = poolOf(domain);
    writeGenAll(all);
  }

  /* 너무 많이 쌓이면 — 맞힌 문제부터, 그다음 안 푼 문제 순으로 오래된 것부터 정리한다.
     틀린 문제는 복습용이라 최대한 남긴다. */

  function trimPool(domain) {
    var pool = poolOf(domain);
    var ids = Object.keys(pool);
    if (ids.length <= GEN_CAP) return;
    var answers = savedAnswers(domain);
    var settled = [];
    var open = [];
    var wrong = [];
    ids.forEach(function (id) {
      var q = pool[id];
      var a = answers[id];
      if (!q || a === undefined || a === null) open.push(id);
      else if (a === q.answer) settled.push(id);
      else wrong.push(id);
    });
    var order = settled.concat(open, wrong);
    var drop = ids.length - GEN_CAP;
    var removed = order.slice(0, drop);
    removed.forEach(function (id) { delete pool[id]; });
    if (removed.length) {
      var all = readStore();
      if (all[domain]) {
        removed.forEach(function (id) { delete all[domain][id]; });
        writeStore(all);
      }
    }
  }

  function rememberGenerated(domain, list) {
    if (!list || !list.length) return;
    var pool = poolOf(domain);
    list.forEach(function (q) {
      var id = q.id;
      while (pool[id]) id = id + 'x';
      q.id = id;
      pool[id] = q;
    });
    trimPool(domain);
    persistPool(domain);
  }

  /* ---------- 데이터 ---------- */

  function loadDomain(domain) {
    if (state.data[domain]) return Promise.resolve(state.data[domain]);
    if (pending[domain]) return pending[domain];
    pending[domain] = fetch(DOMAINS[domain].file, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        state.data[domain] = json;
        pending[domain] = null;
        return json;
      })
      .catch(function (err) {
        pending[domain] = null;
        throw err;
      });
    return pending[domain];
  }

  function quizById(d, id) {
    if (!d) return null;
    for (var i = 0; i < d.quizzes.length; i++) {
      if (d.quizzes[i].id === id) return d.quizzes[i];
    }
    var domain = d.meta && d.meta.domain ? d.meta.domain : null;
    if (domain) {
      var pool = poolOf(domain);
      if (pool[id]) return pool[id];
    }
    for (var key in state.pool) {
      if (state.pool[key] && state.pool[key][id]) return state.pool[key][id];
    }
    return null;
  }

  /* ---------- 라우팅 ---------- */

  function parseHash() {
    var raw = (window.location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    var domain = DOMAINS[parts[0]] ? parts[0] : null;
    var view = parts[1] === 'quiz' ? 'quiz' : 'lessons';
    return { domain: domain, view: domain ? view : 'lessons' };
  }

  function applyRoute() {
    var route = parseHash();
    if (route.domain !== state.domain) {
      state.query = '';
      state.keyOnly = false;
      state.open = {};
    }
    state.domain = route.domain;
    state.view = route.view;
    render();
  }

  function go(domain, view) {
    var target = '#/' + domain + '/' + (view || 'lessons');
    if (window.location.hash === target) {
      applyRoute();
    } else {
      window.location.hash = target;
    }
  }

  function goHome() {
    if (window.location.hash && window.location.hash !== '#') {
      window.location.hash = '';
    } else {
      applyRoute();
    }
  }

  /* ---------- 첫 화면 ---------- */

  function domainRowHTML(key) {
    var d = state.data[key] || null;
    var meta = d ? '개념 ' + d.terms.length + ' · 퀴즈 ' + d.quizzes.length + '문제' : '불러오는 중…';
    var count = d ? d.terms.length : '··';
    return '<li><button type="button" class="domain-row" data-act="go" data-domain="' + key + '">' +
      '<span class="dr-top"><span class="dr-name">' + esc(DOMAINS[key].label) + '</span>' +
      '<span class="dr-count">' + esc(count) + '</span></span>' +
      '<span class="dr-meta">' + esc(meta) + '</span>' +
      '</button></li>';
  }

  function homeHTML() {
    var m = state.data.marketing || null;
    var f = state.data.finance || null;
    var terms = (m ? m.terms.length : 0) + (f ? f.terms.length : 0);
    var quizzes = (m ? m.quizzes.length : 0) + (f ? f.quizzes.length : 0);
    var foot = m && f
      ? '총 ' + terms + '개 개념 · ' + quizzes + '문제 은행 + 매 라운드 상황 판단 중심으로 실시간 생성 · 틀린 문제는 이 기기에 저장됩니다'
      : '총 80개 개념 · 160문제 은행 + 매 라운드 상황 판단 중심으로 실시간 생성 · 틀린 문제는 이 기기에 저장됩니다';

    return '<section class="home">' +
      '<p class="eyebrow">2026-11-17 ~ 11-26 · 마케팅 7회차 · 투자·재테크 7회차</p>' +
      '<h1 class="home-title">학습 노트 &amp; 실전 퀴즈</h1>' +
      '<p class="home-lead">마케팅 실무와 투자·재테크는 섞이지 않게 나눠 두었어요. 볼 과목을 고르면 개념 리스트와 실전 퀴즈가 따로 열립니다.</p>' +
      '<ul class="domain-list">' + domainRowHTML('marketing') + domainRowHTML('finance') + '</ul>' +
      '<p class="home-foot">' + esc(foot) + '</p>' +
      '</section>';
  }

  /* ---------- 공통 조각 ---------- */

  function paneHeadHTML(d) {
    return '<div class="pane-head">' +
      '<p class="eyebrow">' + esc(d.meta.week || '') + '</p>' +
      '<h1 class="pane-title">' + esc(d.meta.title) + '</h1>' +
      '<p class="pane-sub">' + esc(d.meta.subtitle) + '</p>' +
      '</div>';
  }

  function subtabsHTML(active) {
    return '<div class="subtabs" role="tablist">' +
      '<button type="button" role="tab" class="subtab' + (active === 'lessons' ? ' is-active' : '') + '"' +
      ' data-act="view" data-view="lessons" aria-selected="' + (active === 'lessons') + '">개념 리스트</button>' +
      '<button type="button" role="tab" class="subtab' + (active === 'quiz' ? ' is-active' : '') + '"' +
      ' data-act="view" data-view="quiz" aria-selected="' + (active === 'quiz') + '">실전 퀴즈</button>' +
      '</div>';
  }

  /* ---------- 개념 리스트 ---------- */

  function filteredTerms(d) {
    var q = state.query.trim().toLowerCase();
    return d.terms.filter(function (t) {
      if (state.keyOnly && !t.key) return false;
      if (!q) return true;
      var hay = [t.term, t.en, t.def, t.tip, t.keyGroup].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function termHTML(t, showFlag) {
    var open = !!state.open[t.id];
    var sub = t.en ? '<span class="term-sub">' + esc(t.en) + '</span>' : '';
    var flag = showFlag && t.keyGroup && t.keyGroup !== t.term
      ? '<span class="term-flag">' + esc(t.keyGroup) + '</span>' : '';
    return '<div class="term">' +
      '<button type="button" class="term-row' + (open ? ' is-open' : '') + '" data-act="term" data-id="' + esc(t.id) + '"' +
      ' aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="term-txt"><span class="term-name">' + esc(t.term) + '</span>' + sub + flag + '</span>' +
      '<span class="term-chev" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="term-body"' + (open ? '' : ' hidden') + '>' +
      '<p class="term-def">' + esc(t.def) + '</p>' +
      '<p class="term-tip"><span class="tip-label">한 줄 팁</span>' + esc(t.tip) + '</p>' +
      '</div></div>';
  }

  function listHTML(d) {
    var terms = filteredTerms(d);
    var head = '<p class="count-line">' + (state.keyOnly ? '헷갈린 핵심 ' : '전체 ') + terms.length + '개';
    if (state.query.trim()) head += ' · "' + esc(state.query.trim()) + '" 검색 결과';
    head += '</p>';

    if (!terms.length) {
      return head + '<p class="empty">조건에 맞는 개념이 없어요. 검색어를 지우거나 필터를 꺼 보세요.</p>';
    }

    var html = head;

    if (state.keyOnly) {
      terms.forEach(function (t) { html += termHTML(t, true); });
      return html;
    }

    var known = {};
    d.rounds.forEach(function (round) {
      known[round.id] = true;
      var items = terms.filter(function (t) { return t.round === round.id; });
      if (!items.length) return;
      html += '<section class="group">' +
        '<h2 class="group-head"><span>' + esc(round.label) + '</span>' +
        '<span class="group-meta">' + esc(round.date) + ' · ' + items.length + '개</span></h2>';
      items.forEach(function (t) { html += termHTML(t, false); });
      html += '</section>';
    });

    // rounds 목록에 아직 없는 회차도 빠뜨리지 않고 보여준다.
    var orphans = terms.filter(function (t) { return !known[t.round]; });
    if (orphans.length) {
      var groups = [];
      orphans.forEach(function (t) {
        var id = t.round || '기타';
        var found = null;
        groups.forEach(function (g) { if (g.id === id) found = g; });
        if (!found) { found = { id: id, items: [] }; groups.push(found); }
        found.items.push(t);
      });
      groups.forEach(function (g) {
        html += '<section class="group">' +
          '<h2 class="group-head"><span>' + esc(g.id) + '</span>' +
          '<span class="group-meta">' + g.items.length + '개</span></h2>';
        g.items.forEach(function (t) { html += termHTML(t, false); });
        html += '</section>';
      });
    }

    return html;
  }

  function lessonsHTML(domain, d) {
    return paneHeadHTML(d) + subtabsHTML('lessons') +
      '<div class="toolbar">' +
      '<input id="q" class="search" type="search" inputmode="search" autocomplete="off" spellcheck="false"' +
      ' placeholder="용어 · 영문명 · 뜻 · 팁 검색" aria-label="개념 검색" value="' + esc(state.query) + '">' +
      '<button type="button" class="chip" data-act="key" aria-pressed="' + (state.keyOnly ? 'true' : 'false') + '">헷갈린 핵심</button>' +
      '</div>' +
      '<div id="lessonList">' + listHTML(d) + '</div>';
  }

  function refreshList() {
    var d = state.data[state.domain];
    var box = $('lessonList');
    if (!d || !box) {
      render();
      return;
    }
    box.innerHTML = listHTML(d);
  }

  /* ---------- 퀴즈 ---------- */

  /* 아직 안 나온 문제를 우선으로 뽑는다. 한 바퀴 다 돌면 자동으로 리셋돼 다시 섞인다. */

  function drawRoundIds(domain, d, count) {
    if (!count || count <= 0) return [];
    var all = d.quizzes.map(function (q) { return q.id; });
    var seen = readSeen(domain).filter(function (id) { return all.indexOf(id) >= 0; });
    var remaining = all.filter(function (id) { return seen.indexOf(id) < 0; });
    shuffle(remaining);
    var picks = remaining.slice(0, count);

    if (picks.length < count) {
      // 이번 바퀴의 남은 문제를 다 썼다 — 새 바퀴를 열어 방금 뽑은 것을 뺀 문제로 채운다.
      var fresh = all.filter(function (id) { return picks.indexOf(id) < 0; });
      shuffle(fresh);
      picks = picks.concat(fresh.slice(0, count - picks.length));
      seen = picks.slice();
    } else {
      seen = seen.concat(picks);
      if (seen.length >= all.length) seen = [];
    }

    writeSeen(domain, seen);
    return picks;
  }

  /* 한 라운드 구성: 동적 생성 문제 6문제 + 은행 문제 4문제를 섞는다.
     생성기가 없거나 실패하면 은행 문제만으로 채운다. */

  function buildRoundQueue(domain, d, count) {
    var dyn = [];
    var want = Math.min(DYNAMIC_PER_ROUND, count);
    if (window.QuizGen && typeof window.QuizGen.build === 'function') {
      try {
        var made = window.QuizGen.build(domain, d, want);
        if (made && made.length) dyn = made;
      } catch (err) {
        dyn = [];
      }
    }

    var seen = {};
    dyn = dyn.filter(function (q) {
      if (!q || !q.id || !q.options || q.options.length !== 4) return false;
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) return false;
      if (!q.situation || !q.question || !q.explanation || !q.topic) return false;
      var dup = false;
      q.options.forEach(function (o, i) {
        if (!o || q.options.indexOf(o) !== i) dup = true;
      });
      if (dup) return false;
      var key = q.question + '|' + q.situation;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    if (dyn.length > want) dyn = dyn.slice(0, want);
    rememberGenerated(domain, dyn);

    var need = Math.max(0, count - dyn.length);
    var bankIds = need ? drawRoundIds(domain, d, need) : [];
    return shuffle(dyn.map(function (q) { return q.id; }).concat(bankIds));
  }

  /* 보기 순서를 매 라운드 섞고, 정답 위치를 새 순서에 맞춰 다시 계산한다. */

  function buildOrders(d, ids) {
    var orders = {};
    ids.forEach(function (id) {
      var q = quizById(d, id);
      if (!q) return;
      var order = q.options.map(function (_, i) { return i; });
      shuffle(order);
      var same = order.length > 1;
      for (var i = 0; i < order.length; i++) {
        if (order[i] !== i) { same = false; break; }
      }
      if (same) order.push(order.shift());
      orders[id] = { order: order, answer: order.indexOf(q.answer) };
    });
    return orders;
  }

  function startSession(domain, mode, onlyIds) {
    var d = state.data[domain];
    if (!d) return;
    var queue;
    if (mode === 'wrong') {
      var pool = Array.isArray(onlyIds) && onlyIds.length ? onlyIds : wrongIdsAll(domain, d);
      queue = pool.filter(function (id) { return !!quizById(d, id); });
      if (!queue.length) queue = buildRoundQueue(domain, d, ROUND_SIZE);
    } else {
      queue = buildRoundQueue(domain, d, ROUND_SIZE);
    }
    state.sessions[domain] = {
      domain: domain,
      mode: mode,
      queue: queue,
      idx: 0,
      answers: {},
      orders: buildOrders(d, queue)
    };
  }

  /* 은행 문제 + 동적으로 생성했던 문제 전체에서 오답을 모은다. */

  function wrongIdsAll(domain, d) {
    var answers = savedAnswers(domain);
    var out = [];
    Object.keys(answers).forEach(function (id) {
      var q = quizById(d, id);
      if (!q) return;
      var a = answers[id];
      if (a === undefined || a === null) return;
      if (a !== q.answer) out.push(id);
    });
    return out;
  }

  function wrongIdsOf(domain, s) {
    var d = state.data[domain];
    if (!d || !s) return [];
    return s.queue.filter(function (id) {
      var q = quizById(d, id);
      return q && s.answers[q.id] !== q.answer;
    });
  }

  function countSession(d, s) {
    var answered = 0;
    var correct = 0;
    s.queue.forEach(function (id) {
      var q = quizById(d, id);
      if (!q) return;
      var a = s.answers[q.id];
      if (a === undefined || a === null) return;
      answered++;
      if (a === q.answer) correct++;
    });
    return { answered: answered, correct: correct };
  }

  function quizIntroHTML(domain, d) {
    var answers = savedAnswers(domain);
    var answered = 0;
    var correct = 0;
    d.quizzes.forEach(function (q) {
      var a = answers[q.id];
      if (a === undefined || a === null) return;
      answered++;
      if (a === q.answer) correct++;
    });

    var pool = poolOf(domain);
    var gAnswered = 0;
    var gCorrect = 0;
    Object.keys(pool).forEach(function (id) {
      var q = pool[id];
      var a = answers[id];
      if (!q || a === undefined || a === null) return;
      gAnswered++;
      if (a === q.answer) gCorrect++;
    });

    var totalWrong = wrongIdsAll(domain, d).length;
    var round = Math.min(ROUND_SIZE, d.quizzes.length);

    var html = '<div class="quiz-intro">' +
      '<p class="qi-num">' + d.quizzes.length + '문제 은행 + 매 라운드 새 문제</p>' +
      '<p class="qi-desc">한 번에 ' + round + '문제 중 ' + Math.min(DYNAMIC_PER_ROUND, round) +
      '문제를 그 자리에서 새로 만듭니다. 보고서 수치를 읽고 원인을 진단하거나 다음 액션을 고르는 상황 판단 5문제에, 암산으로 풀리는 기초 산수 1문제를 섞습니다. 나머지는 은행에서 최근에 안 나온 문제부터 뽑고, 보기 순서도 매번 섞입니다.</p>';

    if (answered > 0) {
      html += '<div class="saved">' +
        '<p class="saved-line">은행 문제 <strong>' + answered + '</strong> / ' + d.quizzes.length +
        '문제 · 정답 ' + correct + ' · 틀린 문제 ' + (answered - correct) + '개</p>' +
        (gAnswered > 0
          ? '<p class="saved-line">새로 생성된 문제 <strong>' + gAnswered + '</strong>문제 · 정답 ' + gCorrect +
            ' · 틀린 문제 ' + (gAnswered - gCorrect) + '개</p>'
          : '') +
        '</div>';
    }

    html += '<button type="button" class="btn-primary" data-act="quiz-start" data-mode="random">새 문제 ' +
      round + '개 풀기 (랜덤)</button>';

    if (totalWrong > 0) {
      html += '<button type="button" class="btn-ghost" data-act="quiz-start" data-mode="wrong">틀린 문제 ' +
        totalWrong + '개만 다시 풀기</button>';
    }

    html += '<button type="button" class="btn-quiet" data-act="quiz-reset">기록 초기화</button>';

    html += '</div>';
    return html;
  }

  function questionHTML(domain, d, s) {
    var q = quizById(d, s.queue[s.idx]);
    if (!q) return '';
    var total = s.queue.length;
    var picked = s.answers[q.id];
    var answered = picked !== undefined && picked !== null;
    var counts = countSession(d, s);
    var pct = total ? Math.round((counts.answered / total) * 100) : 0;
    var last = s.idx === total - 1;
    var ord = s.orders && s.orders[q.id] ? s.orders[q.id] : null;
    var order = ord ? ord.order : q.options.map(function (_, i) { return i; });
    var answerPos = ord ? ord.answer : q.answer;
    var pickedPos = answered ? order.indexOf(picked) : -1;
    var badge = q.kind === 'calc' ? '🧮 기초 산수'
      : q.kind === 'judge' ? '🧭 상황 판단'
      : q.kind === 'concept' ? '🎲 개념 조합' : '📋 실전 사례';

    var html = '<div class="qbar">' +
      '<div class="qbar-top"><span>문제 ' + (s.idx + 1) + ' / ' + total + '</span>' +
      '<span>정답 ' + counts.correct + '</span></div>' +
      '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
      '<span style="width:' + pct + '%"></span></div>' +
      '</div>' +
      '<article class="q">' +
      '<p class="q-topic"><span class="q-badge">' + badge + '</span>' + esc(q.topic) + '</p>' +
      '<p class="q-situation">' + esc(q.situation) + '</p>' +
      '<p class="q-question">' + esc(q.question) + '</p>' +
      '<ul class="options">';

    order.forEach(function (original, i) {
      var opt = q.options[original];
      var cls = 'opt';
      var badge = '';
      if (answered) {
        if (i === answerPos) {
          cls += ' is-correct';
          badge = '<span class="opt-badge">정답</span>';
        } else if (i === pickedPos) {
          cls += ' is-picked';
          badge = '<span class="opt-badge is-mine">내 선택</span>';
        } else {
          cls += ' is-dim';
        }
      }
      html += '<li><button type="button" class="' + cls + '" data-act="opt" data-i="' + i + '"' +
        (answered ? ' disabled' : '') + '>' +
        '<span class="opt-key">' + String.fromCharCode(65 + i) + '</span>' +
        '<span class="opt-text">' + esc(opt) + '</span>' + badge +
        '</button></li>';
    });

    html += '</ul>';

    if (answered) {
      var ok = picked === q.answer;
      html += '<div class="explain' + (ok ? '' : ' is-wrong') + '">' +
        '<p class="ex-head">' + (ok ? '정답' : '오답') + ' · ' + esc(q.topic) + '</p>' +
        '<p class="ex-body">' + esc(q.explanation) + '</p>' +
        '</div>';
    }

    html += '<button type="button" class="btn-primary next" data-act="next"' + (answered ? '' : ' disabled') + '>' +
      (last ? '결과 보기' : '다음 문제') + '</button>' +
      '</article>';

    return html;
  }

  function resultHTML(domain, d, s) {
    var total = s.queue.length;
    var correct = 0;
    var wrongList = [];
    s.queue.forEach(function (id) {
      var q = quizById(d, id);
      if (!q) return;
      if (s.answers[q.id] === q.answer) correct++;
      else wrongList.push(q);
    });
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var round = Math.min(ROUND_SIZE, d.quizzes.length);

    var html = '<div class="result">' +
      '<p class="res-label">' + (s.mode === 'wrong' ? '틀린 문제 다시 풀기 결과' : '랜덤 ' + total + '문제 결과') + '</p>' +
      '<p class="res-score"><strong>' + correct + '</strong> / ' + total + '</p>' +
      '<p class="res-line">정답률 ' + pct + '% · 틀린 문제 ' + wrongList.length + '개</p>';

    if (wrongList.length) {
      html += '<ul class="wrong-list">';
      wrongList.forEach(function (q) {
        html += '<li><span class="wl-topic">' + esc(q.topic) + '</span>' +
          '<span class="wl-q">' + esc(q.question) + '</span></li>';
      });
      html += '</ul>';
    }

    html += '<button type="button" class="btn-primary" data-act="result-random">새 문제 ' +
      round + '개 풀기 (랜덤)</button>';

    if (wrongList.length) {
      html += '<button type="button" class="btn-ghost" data-act="result-wrong">틀린 문제 ' +
        wrongList.length + '개만 다시 풀기</button>';
    }

    html += '<button type="button" class="btn-quiet" data-act="quiz-reset">기록 초기화</button>' +
      '<p class="res-note">답안은 이 기기에 저장됩니다. 새 라운드는 최근에 안 나온 은행 문제와 그 자리에서 새로 만든 문제를 섞어 출제합니다. 생성된 문제를 틀렸다면 문제 자체가 함께 저장돼 다음에 그대로 다시 풀 수 있습니다.</p>' +
      '</div>';

    return html;
  }

  function quizHTML(domain, d) {
    var s = state.sessions[domain] || null;
    var body;
    if (!s) body = quizIntroHTML(domain, d);
    else if (s.idx >= s.queue.length) body = resultHTML(domain, d, s);
    else body = questionHTML(domain, d, s);
    return paneHeadHTML(d) + subtabsHTML('quiz') + body;
  }

  /* ---------- 렌더 ---------- */

  function render() {
    if (!viewEl) viewEl = $('view');
    var switchEl = $('domainSwitch');

    if (state.domain) {
      switchEl.hidden = false;
      var buttons = switchEl.querySelectorAll('button[data-domain]');
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute('data-domain') === state.domain;
        buttons[i].classList.toggle('is-active', on);
        if (on) buttons[i].setAttribute('aria-current', 'true');
        else buttons[i].removeAttribute('aria-current');
      }
    } else {
      switchEl.hidden = true;
    }

    if (!state.domain) {
      viewEl.innerHTML = homeHTML();
      return;
    }

    var d = state.data[state.domain];
    if (!d) {
      if (state.loadError[state.domain]) {
        viewEl.innerHTML = '<p class="empty">자료를 불러오지 못했어요. (' +
          esc(state.loadError[state.domain]) + ')<br>페이지를 새로고침하면 다시 시도합니다.</p>';
        return;
      }
      viewEl.innerHTML = '<p class="loading">불러오는 중…</p>';
      loadDomain(state.domain).then(function () {
        render();
      }, function (err) {
        state.loadError[state.domain] = err && err.message ? err.message : '알 수 없는 오류';
        render();
      });
      return;
    }

    viewEl.innerHTML = state.view === 'quiz' ? quizHTML(state.domain, d) : lessonsHTML(state.domain, d);
  }

  /* ---------- 동작 ---------- */

  function toggleTerm(el) {
    var id = el.getAttribute('data-id');
    var body = el.nextElementSibling;
    var open = !state.open[id];
    state.open[id] = open;
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.classList.toggle('is-open', open);
    if (body) body.hidden = !open;
  }

  function pickOption(el) {
    var domain = state.domain;
    var s = state.sessions[domain];
    var d = state.data[domain];
    if (!s || !d) return;
    var q = quizById(d, s.queue[s.idx]);
    if (!q) return;
    var already = s.answers[q.id];
    if (already !== undefined && already !== null) return;
    var pos = parseInt(el.getAttribute('data-i'), 10);
    if (isNaN(pos)) return;
    var ord = s.orders && s.orders[q.id] ? s.orders[q.id] : null;
    var original = ord ? ord.order[pos] : pos;
    if (original === undefined) return;
    s.answers[q.id] = original;
    saveAnswer(domain, q.id, original);
    render();
  }

  function nextQuestion() {
    var s = state.sessions[state.domain];
    var d = state.data[state.domain];
    if (!s || !d) return;
    var q = quizById(d, s.queue[s.idx]);
    if (q) {
      var a = s.answers[q.id];
      if (a === undefined || a === null) return;
    }
    s.idx++;
    render();
    window.scrollTo(0, 0);
  }

  var ACTIONS = {
    home: function () { goHome(); },
    go: function (el) { go(el.getAttribute('data-domain'), 'lessons'); },
    view: function (el) { go(state.domain, el.getAttribute('data-view')); },
    term: function (el) { toggleTerm(el); },
    key: function () { state.keyOnly = !state.keyOnly; render(); },
    'quiz-start': function (el) { startSession(state.domain, el.getAttribute('data-mode')); render(); window.scrollTo(0, 0); },
    opt: function (el) { pickOption(el); },
    next: function () { nextQuestion(); },
    'result-wrong': function () {
      var ids = wrongIdsOf(state.domain, state.sessions[state.domain]);
      startSession(state.domain, 'wrong', ids);
      render();
      window.scrollTo(0, 0);
    },
    'result-random': function () { startSession(state.domain, 'random'); render(); window.scrollTo(0, 0); },
    'quiz-reset': function () {
      clearAnswers(state.domain);
      state.sessions[state.domain] = null;
      render();
    }
  };

  document.addEventListener('click', function (event) {
    var el = event.target.closest ? event.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (!ACTIONS[act]) return;
    event.preventDefault();
    ACTIONS[act](el, event);
  });

  document.addEventListener('input', function (event) {
    var el = event.target;
    if (!el || el.id !== 'q') return;
    state.query = el.value;
    refreshList();
  });

  window.addEventListener('hashchange', applyRoute);

  function boot() {
    viewEl = $('view');
    applyRoute();
    Object.keys(DOMAINS).forEach(function (key) {
      loadDomain(key).then(function () {
        if (state.domain === null || state.domain === key) render();
      }, function () { /* 첫 화면 카운트는 기본값 유지 */ });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
