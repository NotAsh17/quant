/**
 * CAT Quant · storage layer
 *
 * Reads/writes user state (attempts, bookmarks, scores, time tracking).
 * Default backend: localStorage.
 * Optional: drop-in Supabase backend, see SUPABASE.md.
 */
(function () {
  const KEYS = {
    attempts:   'catq.attempts.v1',     // {test_id: {answers, marked, qTime, score, completed_at}}
    bookmarks:  'catq.bookmarks.v1',    // {test_id-qNum: true}
    progress:   'catq.progress.v1',     // {test_id: 'in-progress' | 'completed'}
    settings:   'catq.settings.v1',     // {theme, ...}
    history:    'catq.history.v1',      // [{test_id, score, max, time_used, completed_at}]
  };

  function safeGet(key, def) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    } catch { return def; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('storage write failed', e); }
  }

  const Storage = {
    /* attempts: full state of a test in progress or completed */
    getAttempt(testId) {
      const all = safeGet(KEYS.attempts, {});
      return all[testId] || null;
    },
    saveAttempt(testId, attempt) {
      const all = safeGet(KEYS.attempts, {});
      all[testId] = attempt;
      safeSet(KEYS.attempts, all);
    },
    clearAttempt(testId) {
      const all = safeGet(KEYS.attempts, {});
      delete all[testId];
      safeSet(KEYS.attempts, all);
    },

    /* bookmarks: a question is bookmarked or not */
    bookmarkKey(testId, qNum) { return `${testId}::${qNum}`; },
    isBookmarked(testId, qNum) {
      const all = safeGet(KEYS.bookmarks, {});
      return !!all[this.bookmarkKey(testId, qNum)];
    },
    toggleBookmark(testId, qNum) {
      const all = safeGet(KEYS.bookmarks, {});
      const k = this.bookmarkKey(testId, qNum);
      if (all[k]) delete all[k]; else all[k] = { test_id: testId, q: qNum, ts: Date.now() };
      safeSet(KEYS.bookmarks, all);
      return !!all[k];
    },
    allBookmarks() {
      return safeGet(KEYS.bookmarks, {});
    },

    /* progress: completion status per test */
    setProgress(testId, status) {
      const all = safeGet(KEYS.progress, {});
      all[testId] = status;
      safeSet(KEYS.progress, all);
    },
    getProgress(testId) {
      return safeGet(KEYS.progress, {})[testId] || 'untouched';
    },
    allProgress() { return safeGet(KEYS.progress, {}); },

    /* history: log of completed attempts */
    addHistory(entry) {
      const arr = safeGet(KEYS.history, []);
      arr.unshift(entry);
      safeSet(KEYS.history, arr.slice(0, 200));
    },
    getHistory() { return safeGet(KEYS.history, []); },

    /* settings: theme etc. */
    getSetting(k, def) {
      const all = safeGet(KEYS.settings, {});
      return k in all ? all[k] : def;
    },
    setSetting(k, v) {
      const all = safeGet(KEYS.settings, {});
      all[k] = v;
      safeSet(KEYS.settings, all);
    },

    /* aggregates for dashboard */
    aggregateStats(allTests) {
      const attempts = safeGet(KEYS.attempts, {});
      let attempted = 0, correct = 0, timeMin = 0;
      for (const test of allTests) {
        const a = attempts[test.test_id];
        if (!a || !a.completed_at) continue;
        attempted += a.attempted || 0;
        correct += a.correct || 0;
        timeMin += Math.round((a.time_used || 0) / 60);
      }
      return { attempted, correct, timeMin };
    },
  };

  window.Storage = Storage;
})();
