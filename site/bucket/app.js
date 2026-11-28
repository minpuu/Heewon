/* 버킷리스트 · 나의 노트
   - 데이터: 비공개 GitHub Gist 의 heewon-bucket.json
   - 로컬 모드: 토큰 없이 이 기기의 localStorage 에만 저장(나중에 클라우드로 병합)
   - 잠금: 기기의 localStorage 에 저장한 GitHub 토큰(없으면 잠금 화면)
   - 저장: 변경 즉시 디바운스 후 PATCH, 상태 표시 + 수동 ↻ */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var FILE = 'heewon-bucket.json';
  var LS = {
    token: 'hwBucket.token',
    gist: 'hwBucket.gist',
    doc: 'hwBucket.doc',
    stamp: 'hwBucket.stamp',
    local: 'hwBucket.local'
  };
  var PREVIEW = /(?:^|[?&])preview=1(?:&|$)/.test(location.search);

  var CATS = [
    { id: '여행·경험', cls: 'cat-travel' },
    { id: '커리어·성장', cls: 'cat-career' },
    { id: '취향·소비', cls: 'cat-taste' },
    { id: '건강·생활', cls: 'cat-health' },
    { id: '관계·기타', cls: 'cat-etc' }
  ];
  var PERIODS = [
    { id: 'y2026', short: '올해', label: '올해 남은 한 달', chip: '올해 (2026)' },
    { id: 'y2027', short: '내년', label: '내년', chip: '내년 (2027)' },
    { id: 'someday', short: '언젠가', label: '언젠가', chip: '언젠가' }
  ];
  var PERIOD_CHIPS = PERIODS.map(function (p) { return { id: p.id, label: p.chip }; });
  var FILTERS = [
    { id: 'all', label: '전체', short: '전체' },
    { id: 'y2026', label: '올해 남은 한 달', short: '올해' },
    { id: 'y2027', label: '내년', short: '내년' },
    { id: 'someday', label: '언젠가', short: '언젠가' },
    { id: 'done', label: '달성 완료', short: '달성' }
  ];

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    mode: 'boot',
    local: false,
    token: '',
    gistId: '',
    stamp: '',
    doc: emptyDoc(),
    filter: 'all',
    editingId: null,
    confirmId: null,
    draft: null,
    dirty: false,
    saving: false,
    queued: false,
    timer: null,
    sync: 'idle',
    errorText: '',
    lastSyncAt: 0,
    addCat: CATS[0].id,
    addPeriod: 'y2026'
  };

  /* ── 작은 도구들 ────────────────────────────────────────── */
  function emptyDoc() {
    return { version: 1, updatedAt: new Date().toISOString(), items: [] };
  }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function catOf(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i];
    return CATS[0];
  }
  function periodOf(id) {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].id === id) return PERIODS[i];
    return PERIODS[2];
  }
  function read(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* 사파리 프라이빗 등 */ }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-on');
      setTimeout(function () { el.hidden = true; }, 240);
    }, 2600);
  }

  /* ── 문서 정규화 · 캐시 ─────────────────────────────────── */
  function normalizeDoc(raw) {
    var doc = emptyDoc();
    if (!raw || typeof raw !== 'object') return doc;
    doc.version = Number(raw.version) || 1;
    doc.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString();
    var items = Array.isArray(raw.items) ? raw.items : [];
    doc.items = items.map(function (it) {
      it = it || {};
      return {
        id: String(it.id || uid()),
        title: String(it.title || '').slice(0, 80),
        memo: String(it.memo || '').slice(0, 140),
        cat: catOf(String(it.cat || '')).id,
        period: periodOf(String(it.period || '')).id,
        done: !!it.done,
        doneAt: it.done && it.doneAt ? String(it.doneAt) : null,
        createdAt: String(it.createdAt || new Date().toISOString()),
        updatedAt: String(it.updatedAt || new Date().toISOString())
      };
    }).filter(function (it) { return it.title; });
    return doc;
  }
  function cacheDoc() { write(LS.doc, JSON.stringify(state.doc)); }
  function cachedDoc() {
    var raw = read(LS.doc);
    if (!raw) return null;
    try { return normalizeDoc(JSON.parse(raw)); } catch (e) { return null; }
  }

  function parseGist(gist) {
    var files = gist && gist.files;
    if (!files) return null;
    var f = files[FILE] || files[Object.keys(files)[0]];
    if (!f || !f.content) return null;
    try { return normalizeDoc(JSON.parse(f.content)); } catch (e) { return null; }
  }

  /* ── 두 문서 합치기 (로컬 모드 → 클라우드) ─────────────────
     같은 id 는 더 최근에 고친 쪽을 남기고, 없는 항목은 더합니다. */
  function mergeDocs(base, extra) {
    var items = normalizeDoc(base).items.slice();
    var extraItems = normalizeDoc(extra).items;
    var pos = {};
    items.forEach(function (it, i) { pos[it.id] = i; });
    extraItems.forEach(function (it) {
      if (pos[it.id] == null) {
        pos[it.id] = items.length;
        items.push(it);
      } else if (String(it.updatedAt || '') > String(items[pos[it.id]].updatedAt || '')) {
        items[pos[it.id]] = it;
      }
    });
    return { version: 1, updatedAt: new Date().toISOString(), items: items };
  }

  /* ── GitHub API ─────────────────────────────────────────── */
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + (opts.token || state.token)
    };
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store' };
    if (opts.body) {
      init.body = opts.body;
      headers['Content-Type'] = 'application/json';
    }
    return fetch(API + path, init);
  }

  function apiError(status) {
    if (status === 401) return '토큰이 맞지 않아요. 복사한 값을 다시 확인해 주세요.';
    if (status === 403) return '권한이 부족해요. 토큰의 Gists 권한(Read and write)을 확인해 주세요.';
    if (status === 404) return '저장소를 찾을 수 없어요. Gist ID를 확인하거나 비워 두고 다시 연결해 주세요.';
    if (status === 422) return '저장소를 만들 수 없어요. 토큰 권한을 확인해 주세요.';
    if (status === 429) return '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.';
    return '연결에 실패했어요 (HTTP ' + status + ').';
  }

  /* ── 상태 표시 ──────────────────────────────────────────── */
  function relTime(ts) {
    if (!ts) return '방금 전';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return '방금 전';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function setSync(kind, text) {
    state.sync = kind;
    var pill = $('syncPill');
    if (!pill) return;
    pill.dataset.state = kind;
    $('syncText').textContent = text || ({
      idle: '연결 중…',
      saving: '저장 중…',
      saved: '동기화됨 · ' + relTime(state.lastSyncAt),
      error: '저장 실패 · 다시 시도',
      local: '이 기기에 저장됨',
      preview: '미리보기'
    }[kind] || '');
  }

  /* ── 화면 전환 ──────────────────────────────────────────── */
  function showLock(msg, info) {
    state.mode = 'lock';
    $('mainView').hidden = true;
    $('lockView').hidden = false;
    $('menu').open = false;
    if (msg) {
      var el = $('lockMsg');
      el.textContent = msg;
      el.hidden = false;
      el.classList.toggle('is-info', !!info);
    }
    $('gistInput').value = state.gistId || read(LS.gist) || '';
    if (!state.token) $('tokenInput').value = '';
  }
  function showMain() {
    state.mode = 'main';
    $('lockView').hidden = true;
    $('mainView').hidden = false;
    $('previewNote').hidden = !PREVIEW;
    renderMenu();
  }

  /* ── 설정 메뉴 — 지금 모드에 맞게 ──────────────────────── */
  function renderMenu() {
    if (!$('menuGist')) return;
    var local = state.local;
    var count = state.doc.items.length;

    $('menuStorageTitle').textContent = local ? '이 기기 저장' : '저장소';
    $('menuGist').textContent = local ? '클라우드 연결 안 됨' : (state.gistId || '—');
    $('copyGistBtn').hidden = local || !state.gistId;
    $('cloudBtn').hidden = !local;
    $('lockBtn').hidden = local;
    if (local) $('lockConfirm').hidden = true;
    $('menuNote').textContent = local
      ? '토큰 없이 쓰는 중이에요. 이 브라우저를 지우면 같이 지워지니, 기기를 바꿀 때는 JSON으로 내보내 두세요.'
      : '다른 기기에서는 같은 토큰과 위 저장소 ID를 넣으면 이어집니다.';
    $('cloudHint').textContent = count
      ? '지금 이 기기에 적어 둔 ' + count + '줄은 지워지지 않고 그대로 클라우드 노트에 더해져요.'
      : '토큰을 넣으면 비공개 Gist 노트를 새로 만들어요.';

    var foot = $('footText');
    if (foot) foot.textContent = local ? '나의 버킷리스트 · 이 기기에만 저장' : '나의 버킷리스트 · 비공개 Gist에 자동 저장';
  }

  /* ── 렌더 ───────────────────────────────────────────────── */
  function visibleItems() {
    var items = state.doc.items.slice();
    if (state.filter === 'done') items = items.filter(function (i) { return i.done; });
    else if (state.filter !== 'all') items = items.filter(function (i) { return i.period === state.filter; });

    var order = { y2026: 0, y2027: 1, someday: 2 };
    items.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done && b.done) return String(b.doneAt || '').localeCompare(String(a.doneAt || ''));
      if (a.period !== b.period) return order[a.period] - order[b.period];
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    return items;
  }

  function renderSummary() {
    var items = state.doc.items;
    var y26 = items.filter(function (i) { return i.period === 'y2026'; });
    var y27 = items.filter(function (i) { return i.period === 'y2027'; });
    var some = items.filter(function (i) { return i.period === 'someday'; });
    function doneOf(arr) { return arr.filter(function (i) { return i.done; }).length; }

    var d26 = doneOf(y26), dall = doneOf(items);
    $('summaryCount').innerHTML = '<strong>' + d26 + '</strong> / ' + y26.length + ' <span>달성</span>';
    var pct = y26.length ? Math.round((d26 / y26.length) * 100) : 0;
    var bar = $('yearBar');
    bar.querySelector('span').style.width = pct + '%';
    bar.setAttribute('aria-label', '올해 달성률 ' + pct + '%');

    $('stAll').textContent = dall + ' / ' + items.length;
    $('stYear27').textContent = doneOf(y27) + ' / ' + y27.length;
    $('stSomeday').textContent = doneOf(some) + ' / ' + some.length;

    var now = new Date();
    var end = new Date(2026, 11, 31);
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var left = Math.round((end - today) / 86400000);
    var days = $('summaryDays');
    if (left > 0) days.textContent = '2026년이 ' + left + '일 남았어요 · 한 줄씩 채워봐요';
    else if (left === 0) days.textContent = '오늘이 2026년의 마지막 날이에요';
    else days.textContent = '2026년은 지나갔어요 · 남은 줄을 정리해 볼까요';
  }

  function renderFilters() {
    var items = state.doc.items;
    var counts = {
      all: items.length,
      y2026: items.filter(function (i) { return i.period === 'y2026'; }).length,
      y2027: items.filter(function (i) { return i.period === 'y2027'; }).length,
      someday: items.filter(function (i) { return i.period === 'someday'; }).length,
      done: items.filter(function (i) { return i.done; }).length
    };
    $('filters').innerHTML = FILTERS.map(function (f) {
      return '<button type="button" class="filter-btn" role="tab" data-filter="' + f.id + '"' +
        ' aria-pressed="' + (state.filter === f.id ? 'true' : 'false') + '">' +
        '<span class="lg">' + esc(f.label) + '</span><span class="sm">' + esc(f.short || f.label) + '</span>' +
        '<span class="cnt">' + counts[f.id] + '</span></button>';
    }).join('');
  }

  function chipsMarkup(list, activeId, act) {
    return list.map(function (c) {
      var id = c.id || c;
      var label = c.label || c.id || c;
      return '<button type="button" class="chip-btn" data-act="' + act + '" data-value="' + esc(id) + '"' +
        ' aria-pressed="' + (activeId === id ? 'true' : 'false') + '">' + esc(label) + '</button>';
    }).join('');
  }

  function renderAddChips() {
    $('addCats').innerHTML = chipsMarkup(CATS, state.addCat, 'add-cat');
    $('addPeriods').innerHTML = chipsMarkup(PERIOD_CHIPS, state.addPeriod, 'add-period');
  }

  function itemHtml(it) {
    var done = it.done;
    var editing = state.editingId === it.id;
    var confirming = state.confirmId === it.id;
    var cat = catOf(it.cat);
    var label = '';

    if (state.filter === 'all' && !done) {
      label = '<span class="done-date">' + esc(periodOf(it.period).short) + '</span>';
    }
    if (done) {
      label = '<span class="done-date">' + esc(it.doneAt || '') + ' 달성</span>';
    }

    var body = '';
    if (editing) {
      var d = state.draft || { title: it.title, memo: it.memo, cat: it.cat, period: it.period };
      body =
        '<div class="edit">' +
          '<input type="text" data-field="title" maxlength="80" value="' + esc(d.title) + '" aria-label="제목" enterkeyhint="done">' +
          '<textarea data-field="memo" maxlength="140" placeholder="짧은 메모 (선택)" aria-label="메모">' + esc(d.memo) + '</textarea>' +
          '<div class="chips">' + chipsMarkup(CATS, d.cat, 'edit-cat') + '</div>' +
          '<div class="chips chips-period">' + chipsMarkup(PERIOD_CHIPS, d.period, 'edit-period') + '</div>' +
          '<div class="edit-acts">' +
            '<button type="button" class="btn btn-paper" data-act="cancelEdit">취소</button>' +
            '<button type="button" class="btn btn-primary" data-act="saveEdit">저장</button>' +
          '</div>' +
        '</div>';
    } else {
      body =
        '<div class="item-head"><p class="item-title">' + esc(it.title) + '</p></div>' +
        (it.memo ? '<p class="item-memo">' + esc(it.memo) + '</p>' : '') +
        '<div class="item-line"><span class="tag ' + cat.cls + '">' + esc(cat.id) + '</span>' + label + '</div>';

      if (confirming) {
        body +=
          '<div class="confirm"><p>이 줄을 지울까요?</p>' +
          '<div class="confirm-acts">' +
            '<button type="button" class="btn btn-paper" data-act="cancelDelete">취소</button>' +
            '<button type="button" class="btn btn-danger" data-act="doDelete">삭제</button>' +
          '</div></div>';
      } else {
        body +=
          '<div class="item-tools">' +
            '<div class="seg" role="group" aria-label="시기 이동">' +
              PERIODS.map(function (p) {
                return '<button type="button" data-act="period" data-value="' + p.id + '"' +
                  ' aria-pressed="' + (it.period === p.id ? 'true' : 'false') + '">' + p.short + '</button>';
              }).join('') +
            '</div>' +
            '<div class="item-acts">' +
              '<button type="button" class="act" data-act="edit">수정</button>' +
              '<button type="button" class="act danger" data-act="delete">삭제</button>' +
            '</div>' +
          '</div>';
      }
    }

    return '<li class="item' + (done ? ' is-done' : '') + '" data-id="' + it.id + '">' +
      '<button type="button" class="check" data-act="toggle" aria-pressed="' + (done ? 'true' : 'false') + '"' +
        ' aria-label="' + (done ? '달성 취소' : '달성 표시') + '"></button>' +
      '<div class="item-body">' + body + '</div>' +
    '</li>';
  }

  function renderList() {
    var items = visibleItems();
    var list = $('list');
    list.innerHTML = items.map(itemHtml).join('');
    var empty = $('empty');
    if (items.length) {
      empty.hidden = true;
    } else {
      empty.hidden = false;
      var msg = '이 칸은 아직 비어 있어요.';
      if (state.filter === 'y2026') msg = '올해 남은 한 달은 아직 비어 있어요.\n한 줄 적어 두면 12월이 조금 달라져요.';
      else if (state.filter === 'y2027') msg = '내년 칸이 비어 있어요.\n크게 하나 적어 볼까요?';
      else if (state.filter === 'someday') msg = '언젠가 하고 싶은 것들을 적어 두는 칸이에요.';
      else if (state.filter === 'done') msg = '아직 달성한 줄이 없어요.\n체크하는 순간 날짜가 함께 적힙니다.';
      else msg = '아직 아무것도 없어요.\n위 칸에 첫 번째 버킷리스트를 적어 보세요.';
      empty.textContent = msg;
      empty.style.whiteSpace = 'pre-line';
    }
  }

  function renderAll() {
    renderSummary();
    renderFilters();
    renderList();
  }

  /* ── 저장 예약 ──────────────────────────────────────────── */
  function touch() {
    state.doc.updatedAt = new Date().toISOString();
    cacheDoc();
    renderAll();
    dirtySchedule();
  }
  function dirtySchedule() {
    if (PREVIEW) { setSync('preview', '미리보기'); return; }
    if (state.local) {
      state.lastSyncAt = Date.now();
      setSync('local', '이 기기에 저장됨');
      return;
    }
    state.dirty = true;
    setSync('saving', '저장 중…');
    clearTimeout(state.timer);
    state.timer = setTimeout(flush, 700);
  }
  function flush() {
    if (PREVIEW || !state.gistId || !state.token) return;
    if (state.saving) { state.queued = true; return; }
    clearTimeout(state.timer);
    state.saving = true;
    setSync('saving', '저장 중…');

    var payload = JSON.stringify({ files: (function () {
      var f = {}; f[FILE] = { content: JSON.stringify(state.doc) }; return f;
    })() });

    gh('/gists/' + state.gistId, { method: 'PATCH', body: payload }).then(function (res) {
      if (!res.ok) throw new Error(apiError(res.status));
      return res.json();
    }).then(function (gist) {
      state.saving = false;
      state.dirty = false;
      state.stamp = gist.updated_at || state.stamp;
      state.lastSyncAt = Date.now();
      setSync('saved');
      if (state.queued) { state.queued = false; flush(); }
    }).catch(function (err) {
      state.saving = false;
      state.queued = false;
      state.dirty = true;
      state.errorText = (err && err.message) || '인터넷 연결을 확인해 주세요.';
      setSync('error');
    });
  }

  /* ── 원격에서 당겨오기 ──────────────────────────────────── */
  function pull(manual) {
    if (PREVIEW || state.local || !state.gistId || !state.token) return Promise.resolve(false);
    if (state.dirty || state.saving) {
      if (manual) { flush(); toast('방금 고친 내용을 먼저 저장하고 있어요'); }
      return Promise.resolve(false);
    }
    return gh('/gists/' + state.gistId).then(function (res) {
      if (res.status === 401) {
        clearLockState(true);
        showLock('토큰이 만료되었거나 취소되었어요. 새 토큰으로 다시 연결해 주세요.');
        return false;
      }
      if (!res.ok) throw new Error(apiError(res.status));
      return res.json().then(function (gist) {
        if (gist.updated_at && gist.updated_at !== state.stamp) {
          var remote = parseGist(gist);
          if (remote && remote.updatedAt !== state.doc.updatedAt) {
            state.doc = remote;
            cacheDoc();
            renderAll();
            if (manual) toast('다른 기기에서 바뀐 내용을 불러왔어요');
          }
        } else if (manual) {
          toast('지금이 가장 최신 상태예요');
        }
        state.stamp = gist.updated_at || state.stamp;
        state.lastSyncAt = Date.now();
        state.dirty = false;
        setSync('saved');
        return true;
      });
    }).catch(function (err) {
      setSync('error');
      state.errorText = (err && err.message) || '인터넷 연결을 확인해 주세요.';
      if (manual) toast(state.errorText);
      return false;
    });
  }

  /* ── 잠금 / 연결 ────────────────────────────────────────── */
  function clearLockState(keepGist) {
    state.token = '';
    drop(LS.token);
    state.stamp = '';
    drop(LS.stamp);
    if (!keepGist) {
      state.gistId = '';
      drop(LS.gist);
      state.doc = emptyDoc();
      drop(LS.doc);
    }
  }

  function setLockMsg(msg, info) {
    var el = $('lockMsg');
    if (!msg) { el.hidden = true; return; }
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle('is-info', !!info);
  }

  function tokenProblem(token) {
    if (!token) return '토큰을 넣어 주세요.';
    if (!/^gh[a-z]_[A-Za-z0-9_]{10,}|^github_pat_[A-Za-z0-9_]{20,}$/.test(token)) {
      return '토큰 형식이 아니에요. ghp_… 또는 github_pat_… 로 시작하는 값을 붙여넣어 주세요.';
    }
    return '';
  }

  function filePayload(doc) {
    var f = {};
    f[FILE] = { content: JSON.stringify(doc) };
    return { files: f };
  }
  function writeGist(token, gistId, doc) {
    return gh('/gists/' + encodeURIComponent(gistId), {
      method: 'PATCH', token: token, body: JSON.stringify(filePayload(doc))
    }).then(function (res) {
      if (!res.ok) throw new Error(apiError(res.status));
      return res.json();
    });
  }
  function createGist(token, doc) {
    var payload = filePayload(doc);
    payload.description = '버킷리스트 · 비공개 데이터';
    payload.public = false;
    return gh('/gists', { method: 'POST', token: token, body: JSON.stringify(payload) }).then(function (res) {
      if (!res.ok) throw new Error(apiError(res.status));
      return res.json();
    });
  }

  /* 연결을 마치고 이 기기를 클라우드 모드로 */
  function applyCloud(token, gistId, stamp, doc) {
    state.local = false;
    drop(LS.local);
    state.token = token;
    state.gistId = gistId;
    state.stamp = stamp || '';
    state.doc = normalizeDoc(doc);
    state.lastSyncAt = Date.now();
    state.dirty = false;
    state.saving = false;
    state.queued = false;
    clearTimeout(state.timer);
    write(LS.token, token);
    write(LS.gist, gistId);
    write(LS.stamp, state.stamp);
    cacheDoc();
  }

  /* 로컬 모드에서 적어 둔 줄을 버리지 않고 Gist 로 올립니다(있으면 병합) */
  function connectCloud(token, gistId) {
    var localDoc = state.local ? normalizeDoc(state.doc) : emptyDoc();
    var hasLocal = localDoc.items.length > 0;

    if (gistId) {
      return gh('/gists/' + encodeURIComponent(gistId), { token: token }).then(function (res) {
        if (!res.ok) throw new Error(apiError(res.status));
        return res.json();
      }).then(function (gist) {
        var remote = parseGist(gist);
        var base = remote || (hasLocal ? null : cachedDoc()) || emptyDoc();
        var merged = hasLocal ? mergeDocs(base, localDoc) : base;
        var added = merged.items.length - base.items.length;
        return writeGist(token, gist.id || gistId, merged).then(function (saved) {
          applyCloud(token, gist.id || gistId, (saved && saved.updated_at) || gist.updated_at || '', merged);
          return { created: false, added: added };
        });
      });
    }

    // Gist ID 없이 연결 → 지금 이 기기의 목록을 그대로 담아 새 비공개 Gist
    return createGist(token, localDoc).then(function (gist) {
      applyCloud(token, gist.id, gist.updated_at || '', localDoc);
      return { created: true, added: 0 };
    });
  }

  function connect(ev) {
    if (ev) ev.preventDefault();
    if (state.mode !== 'lock') return;
    var token = $('tokenInput').value.trim();
    var gistId = $('gistInput').value.trim();
    setLockMsg('');

    var problem = tokenProblem(token);
    if (problem) { setLockMsg(problem); $('tokenInput').focus(); return; }

    var btn = $('connectBtn');
    btn.disabled = true;
    btn.textContent = gistId ? '확인하는 중…' : '노트를 만드는 중…';

    var done = function () {
      btn.disabled = false;
      btn.textContent = '연결하고 열기';
    };

    connectCloud(token, gistId).then(function (r) {
      done();
      showMain();
      renderAddChips();
      renderAll();
      setSync('saved');
      if (r.created) {
        toast('비공개 노트를 만들었어요 · 저장소 ID를 맥북에서도 쓸 수 있어요');
        $('menu').open = true;
      } else if (r.added > 0) {
        toast('이 기기에 있던 ' + r.added + '줄을 클라우드 노트에 더했어요');
      }
    }).catch(function (err) {
      done();
      setLockMsg((err && err.message) || '인터넷 연결을 확인해 주세요.');
    });
  }

  /* 토큰 없이 이 기기에서 바로 시작 */
  function startLocal() {
    if (state.mode !== 'lock') return;
    var cached = cachedDoc();
    state.local = true;
    state.token = '';
    state.stamp = '';
    state.gistId = read(LS.gist) || state.gistId || '';
    state.doc = cached || emptyDoc();
    state.lastSyncAt = Date.now();
    write(LS.local, '1');
    cacheDoc();
    showMain();
    renderAddChips();
    renderAll();
    setSync('local', '이 기기에 저장됨');
    toast('이 기기에 저장하기 시작했어요 · 토큰 없이도 됩니다');
  }

  /* ── 항목 조작 ──────────────────────────────────────────── */
  function findItem(id) {
    for (var i = 0; i < state.doc.items.length; i++) if (state.doc.items[i].id === id) return state.doc.items[i];
    return null;
  }

  function readEditDraft(li) {
    if (!li || !state.draft) return null;
    var t = li.querySelector('[data-field="title"]');
    var m = li.querySelector('[data-field="memo"]');
    if (t) state.draft.title = t.value;
    if (m) state.draft.memo = m.value;
    return state.draft;
  }

  function addItem(ev) {
    if (ev) ev.preventDefault();
    var title = $('addTitle').value.trim();
    var memo = $('addMemo').value.trim();
    var errEl = $('addError');
    if (!title) {
      errEl.textContent = '한 줄이라도 적어 주세요.';
      errEl.hidden = false;
      $('addTitle').focus();
      return;
    }
    errEl.hidden = true;
    var now = new Date().toISOString();
    state.doc.items.push({
      id: uid(),
      title: title,
      memo: memo,
      cat: state.addCat,
      period: state.addPeriod,
      done: false,
      doneAt: null,
      createdAt: now,
      updatedAt: now
    });
    $('addTitle').value = '';
    $('addMemo').value = '';
    touch();
    $('addTitle').focus();
  }

  /* ── 이벤트 ─────────────────────────────────────────────── */
  function bind() {
    $('lockForm').addEventListener('submit', connect);
    $('localStartBtn').addEventListener('click', startLocal);

    $('tokenPeek').addEventListener('click', function () {
      var input = $('tokenInput');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      this.setAttribute('aria-pressed', show ? 'true' : 'false');
      this.textContent = show ? '가리기' : '보기';
    });

    function manualRefresh() {
      if (PREVIEW) { toast('미리보기 모드예요 · 아무것도 저장되지 않아요'); return; }
      if (state.local) { toast('이 기기에 저장하고 있어요 · 클라우드 연결은 ⋯ → 클라우드 동기화 연결하기'); return; }
      if (state.sync === 'error') { flush(); return; }
      pull(true);
    }
    $('syncPill').addEventListener('click', manualRefresh);
    $('refreshBtn').addEventListener('click', manualRefresh);

    $('copyGistBtn').addEventListener('click', function () {
      var id = state.gistId;
      if (!id) { toast('저장소 ID가 아직 없어요'); return; }
      var ok = function () { toast('저장소 ID를 복사했어요'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(ok, function () { fallbackCopy(id); ok(); });
      } else { fallbackCopy(id); ok(); }
    });

    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(state.doc, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'heewon-bucket-' + todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      $('menu').open = false;
      toast('JSON 파일로 내려받았어요');
    });

    /* ── 클라우드 동기화 연결 (로컬 모드 → Gist) ────────── */
    $('cloudBtn').addEventListener('click', function () {
      var box = $('cloudBox');
      var opening = box.hidden;
      box.hidden = !opening;
      if (opening) {
        $('menuGistInput').value = state.gistId || read(LS.gist) || '';
        $('menuErr').hidden = true;
        setTimeout(function () {
          try { $('menuToken').focus(); } catch (e) {}
        }, 60);
      }
    });

    $('menuConnectBtn').addEventListener('click', function () {
      var btn = this;
      var token = $('menuToken').value.trim();
      var gistId = $('menuGistInput').value.trim();
      var errEl = $('menuErr');
      errEl.hidden = true;
      var problem = tokenProblem(token);
      if (problem) { errEl.textContent = problem; errEl.hidden = false; $('menuToken').focus(); return; }

      btn.disabled = true;
      btn.textContent = gistId ? '확인하는 중…' : '노트를 만드는 중…';

      var reset = function () {
        btn.disabled = false;
        btn.textContent = '연결하고 올리기';
      };

      connectCloud(token, gistId).then(function (r) {
        reset();
        $('cloudBox').hidden = true;
        $('menuToken').value = '';
        $('menu').open = false;
        renderMenu();
        renderAll();
        setSync('saved');
        if (r.added > 0) toast('이 기기에 있던 ' + r.added + '줄을 클라우드 노트에 더했어요');
        else if (r.created) toast('비공개 노트를 만들어 연결했어요');
        else toast('클라우드 동기화를 연결했어요');
      }).catch(function (err) {
        reset();
        errEl.textContent = (err && err.message) || '인터넷 연결을 확인해 주세요.';
        errEl.hidden = false;
      });
    });

    /* ── JSON 불러오기(복원) ──────────────────────────── */
    $('importBtn').addEventListener('click', function () {
      var file = $('importFile');
      file.value = '';
      file.click();
    });

    $('importFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var doc = null;
        try { doc = normalizeDoc(JSON.parse(String(reader.result))); } catch (e) { doc = null; }
        if (!doc || !doc.items.length) {
          toast('이 파일에서는 버킷리스트를 읽지 못했어요');
          return;
        }
        var before = state.doc.items.length;
        var merged = mergeDocs(state.doc, doc);
        var added = merged.items.length - before;
        if (added <= 0) { toast('새로 더할 줄이 없어요 · 이미 있는 목록이에요'); return; }
        state.doc = normalizeDoc(merged);
        touch();
        toast('JSON에서 ' + added + '줄을 불러왔어요');
      };
      reader.onerror = function () { toast('파일을 읽지 못했어요'); };
      reader.readAsText(file);
    });

    var lockBtn = $('lockBtn');
    var lockConfirm = $('lockConfirm');
    lockBtn.addEventListener('click', function () {
      lockBtn.hidden = true;
      lockConfirm.hidden = false;
    });
    $('lockCancel').addEventListener('click', function () {
      lockConfirm.hidden = true;
      lockBtn.hidden = false;
    });
    $('lockOk').addEventListener('click', function () {
      lockConfirm.hidden = true;
      lockBtn.hidden = false;
      clearLockState(false);
      showLock('잠갔어요. 토큰을 다시 넣으면 이어집니다.', true);
    });

    $('menu').addEventListener('toggle', function () {
      if (!this.open) return;
      renderMenu();
      // 닫아 둔 사이의 오류 문구·토큰이 남아 있으면 지음
      if ($('cloudBox').hidden) {
        $('menuErr').hidden = true;
        $('menuToken').value = '';
      }
    });
    $('menu').addEventListener('click', function (e) {
      var item = e.target.closest('.menu-item');
      if (item && ['lockBtn', 'lockCancel', 'lockOk', 'cloudBtn', 'importBtn'].indexOf(item.id) === -1) this.open = false;
    });
    document.addEventListener('click', function (e) {
      var menu = $('menu');
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });

    $('addForm').addEventListener('submit', addItem);
    $('addForm').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'add-cat') { state.addCat = btn.dataset.value; renderAddChips(); }
      if (act === 'add-period') { state.addPeriod = btn.dataset.value; renderAddChips(); }
    });

    $('filters').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      state.filter = btn.dataset.filter;
      state.editingId = null;
      state.confirmId = null;
      renderFilters();
      renderList();
    });

    $('list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var li = btn.closest('.item');
      var id = li && li.dataset.id;
      var item = id ? findItem(id) : null;
      if (!item) return;
      var act = btn.dataset.act;

      if (act === 'toggle') {
        item.done = !item.done;
        item.doneAt = item.done ? todayStr() : null;
        item.updatedAt = new Date().toISOString();
        touch();

      } else if (act === 'period') {
        item.period = btn.dataset.value;
        item.updatedAt = new Date().toISOString();
        touch();

      } else if (act === 'edit') {
        state.editingId = id;
        state.confirmId = null;
        state.draft = { title: item.title, memo: item.memo, cat: item.cat, period: item.period };
        renderList();
        var input = $('list').querySelector('.item[data-id="' + id + '"] [data-field="title"]');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }

      } else if (act === 'edit-cat' || act === 'edit-period') {
        readEditDraft(li);
        if (act === 'edit-cat') state.draft.cat = btn.dataset.value;
        else state.draft.period = btn.dataset.value;
        renderList();

      } else if (act === 'saveEdit') {
        var d = readEditDraft(li) || {};
        var title = String(d.title || '').trim();
        if (!title) { toast('제목을 한 줄 남겨 주세요'); return; }
        item.title = title.slice(0, 80);
        item.memo = String(d.memo || '').trim().slice(0, 140);
        item.cat = d.cat;
        item.period = d.period;
        item.updatedAt = new Date().toISOString();
        state.editingId = null;
        state.draft = null;
        touch();

      } else if (act === 'cancelEdit') {
        state.editingId = null;
        state.draft = null;
        renderList();

      } else if (act === 'delete') {
        state.confirmId = id;
        state.editingId = null;
        renderList();

      } else if (act === 'cancelDelete') {
        state.confirmId = null;
        renderList();

      } else if (act === 'doDelete') {
        state.doc.items = state.doc.items.filter(function (i) { return i.id !== id; });
        state.confirmId = null;
        touch();
        toast('한 줄을 지웠어요');
      }
    });

    $('list').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return;
      var field = e.target.closest('[data-field]');
      if (!field) return;
      e.preventDefault();
      var li = field.closest('.item');
      var save = li && li.querySelector('[data-act="saveEdit"]');
      if (save) save.click();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.mode === 'main') {
        if (Date.now() - state.lastSyncAt > 15000) pull(false);
      }
    });
    window.addEventListener('focus', function () {
      if (state.mode === 'main' && Date.now() - state.lastSyncAt > 15000) pull(false);
    });
    window.addEventListener('online', function () {
      if (state.mode === 'main' && state.dirty) flush();
    });

    // 상대 시간 갱신
    setInterval(function () {
      if (state.sync === 'saved') setSync('saved');
    }, 30000);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch (e) {}
  }

  /* ── 미리보기용 샘플 ────────────────────────────────────── */
  function sampleDoc() {
    var now = new Date();
    function iso(daysAgo) {
      return new Date(now.getTime() - daysAgo * 86400000).toISOString();
    }
    function dateStr(daysAgo) {
      var d = new Date(now.getTime() - daysAgo * 86400000);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    var rows = [
      ['졸업작품 전시 마무리하고 웃으면서 나오기', '패널 인쇄까지 끝내고, 마지막 날은 사진 남기기', '커리어·성장', 'y2026', true, 5],
      ['크리스마스에 혼자 호텔 하룻밤', '조용한 방, 늦잠, 룸서비스', '취향·소비', 'y2026', false, null],
      ['이 노트에 첫 줄 적기', '지금 하고 있는 일', '관계·기타', 'y2026', true, 12],
      ['리스본에서 한 달 살기', '노트북 하나, 짐은 캐리어 반', '여행·경험', 'y2027', false, null],
      ['브랜드 마케팅 실무 프로젝트 끝까지 해보기', '인턴이든 프로젝트든, 처음부터 끝까지', '커리어·성장', 'y2027', false, null],
      ['내 이름으로 된 작은 브랜드 하나', '이름부터 정해보기', '커리어·성장', 'someday', false, null],
      ['아이슬란드에서 오로라 보기', '겨울, 렌터카 없이', '여행·경험', 'someday', false, null]
    ];
    return {
      version: 1,
      updatedAt: now.toISOString(),
      items: rows.map(function (r, i) {
        return {
          id: 'p' + i,
          title: r[0],
          memo: r[1],
          cat: r[2],
          period: r[3],
          done: r[4],
          doneAt: r[4] ? dateStr(r[5]) : null,
          createdAt: iso(30 - i),
          updatedAt: iso(1)
        };
      })
    };
  }

  /* ── 시작 ───────────────────────────────────────────────── */
  function init() {
    renderAddChips();
    bind();

    if (PREVIEW) {
      state.doc = normalizeDoc(sampleDoc());
      state.gistId = '';
      showMain();
      renderAll();
      setSync('preview', '미리보기');
      return;
    }

    var token = read(LS.token);
    var gistId = read(LS.gist);
    var stamp = read(LS.stamp);

    if (token && gistId) {
      state.token = token;
      state.gistId = gistId;
      state.stamp = stamp;
      state.local = false;
      drop(LS.local);
      var cached = cachedDoc();
      if (cached) state.doc = cached;
      showMain();
      renderAll();
      setSync('idle');
      pull(false).then(function (ok) {
        if (!ok && state.mode === 'main' && state.sync !== 'error') setSync('saved');
      });
      return;
    }

    // 토큰 없이 이 기기에만 저장해 오던 중
    if (read(LS.local) === '1') {
      state.local = true;
      state.gistId = gistId || '';
      state.doc = cachedDoc() || emptyDoc();
      state.lastSyncAt = Date.now();
      showMain();
      renderAll();
      setSync('local', '이 기기에 저장됨');
      return;
    }

    showLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
