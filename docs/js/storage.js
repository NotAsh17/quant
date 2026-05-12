/**
 * CAT Quant · storage layer
 *
 * Reads/writes user state (attempts, bookmarks, scores, time tracking) into
 * localStorage, namespaced by an active "profile" so multiple people can
 * use the same browser without seeing each other's progress.
 *
 * Profile keys:
 *   catq.profiles.v1         - array of {name, created_at}
 *   catq.active-profile.v1   - name of currently-active profile
 *
 * Per-profile data lives under:
 *   catq.p:<profile>.attempts.v1
 *   catq.p:<profile>.bookmarks.v1
 *   catq.p:<profile>.progress.v1
 *   catq.p:<profile>.settings.v1
 *   catq.p:<profile>.history.v1
 *
 * On first run, if the older non-namespaced keys (catq.attempts.v1, etc.)
 * exist, they're migrated into a "Default" profile.
 */
(function () {
  const PROFILES_KEY = 'catq.profiles.v1';
  const ACTIVE_KEY   = 'catq.active-profile.v1';
  const SUFFIXES = ['attempts.v1', 'bookmarks.v1', 'progress.v1', 'settings.v1', 'history.v1'];

  function safeGetRaw(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeGet(key, def) {
    const raw = safeGetRaw(key);
    if (!raw) return def;
    try { return JSON.parse(raw); } catch { return def; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('storage write failed', e); }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function profileKey(name, suffix) {
    return `catq.p:${name}.${suffix}`;
  }

  /* ---------- Profile management ---------- */
  function getProfiles() {
    return safeGet(PROFILES_KEY, []);
  }
  function getActiveProfile() {
    return safeGetRaw(ACTIVE_KEY) || 'Default';
  }
  function setActiveProfile(name) {
    safeSet(ACTIVE_KEY, name);
    // Note: safeSet stringifies, so the value lands as `"Default"` (with quotes).
    // We want it raw. Overwrite plainly:
    try { localStorage.setItem(ACTIVE_KEY, name); } catch {}
  }
  function ensureProfile(name) {
    const profs = getProfiles();
    if (!profs.find(p => p.name === name)) {
      profs.push({ name, created_at: Date.now() });
      safeSet(PROFILES_KEY, profs);
    }
  }
  function addProfile(name) {
    name = (name || '').trim();
    if (!name) return { ok: false, error: 'Profile name cannot be empty' };
    if (name.length > 40) return { ok: false, error: 'Name too long (max 40 chars)' };
    if (/[\\\/]/.test(name)) return { ok: false, error: 'Name cannot contain / or \\' };
    const profs = getProfiles();
    if (profs.find(p => p.name === name)) return { ok: false, error: 'A profile with that name already exists' };
    profs.push({ name, created_at: Date.now() });
    safeSet(PROFILES_KEY, profs);
    return { ok: true };
  }
  function deleteProfile(name) {
    if (name === getActiveProfile()) {
      return { ok: false, error: 'Switch to a different profile first' };
    }
    let profs = getProfiles();
    if (!profs.find(p => p.name === name)) return { ok: false, error: 'Profile not found' };
    profs = profs.filter(p => p.name !== name);
    safeSet(PROFILES_KEY, profs);
    for (const suffix of SUFFIXES) safeRemove(profileKey(name, suffix));
    return { ok: true };
  }
  function renameProfile(oldName, newName) {
    newName = (newName || '').trim();
    if (!newName) return { ok: false, error: 'Name cannot be empty' };
    if (newName === oldName) return { ok: true };
    const profs = getProfiles();
    if (!profs.find(p => p.name === oldName)) return { ok: false, error: 'Profile not found' };
    if (profs.find(p => p.name === newName)) return { ok: false, error: 'A profile with that name already exists' };
    // Copy data
    for (const suffix of SUFFIXES) {
      const raw = safeGetRaw(profileKey(oldName, suffix));
      if (raw != null) {
        try { localStorage.setItem(profileKey(newName, suffix), raw); } catch {}
        safeRemove(profileKey(oldName, suffix));
      }
    }
    // Update list
    const updated = profs.map(p => p.name === oldName ? { ...p, name: newName } : p);
    safeSet(PROFILES_KEY, updated);
    if (getActiveProfile() === oldName) setActiveProfile(newName);
    return { ok: true };
  }
  function clearProfileData(name) {
    for (const suffix of SUFFIXES) safeRemove(profileKey(name, suffix));
    return { ok: true };
  }
  function switchProfile(name) {
    ensureProfile(name);
    setActiveProfile(name);
  }
  function profileStats(name) {
    const att = safeGet(profileKey(name, 'attempts.v1'), {});
    const hist = safeGet(profileKey(name, 'history.v1'), []);
    let attempted = 0, correct = 0;
    for (const a of Object.values(att)) {
      if (!a || !a.completed_at) continue;
      attempted += a.attempted || 0;
      correct += a.correct || 0;
    }
    return { tests_completed: hist.length, attempted, correct };
  }

  /* ---------- One-time migration ---------- */
  function migrateLegacy() {
    if (getProfiles().length > 0) return;
    const legacy = {
      'attempts.v1':  'catq.attempts.v1',
      'bookmarks.v1': 'catq.bookmarks.v1',
      'progress.v1':  'catq.progress.v1',
      'settings.v1':  'catq.settings.v1',
      'history.v1':   'catq.history.v1',
    };
    const anyLegacy = Object.values(legacy).some(k => safeGetRaw(k) != null);
    ensureProfile('Default');
    setActiveProfile('Default');
    if (!anyLegacy) return;
    for (const [suffix, oldKey] of Object.entries(legacy)) {
      const raw = safeGetRaw(oldKey);
      if (raw != null) {
        try { localStorage.setItem(profileKey('Default', suffix), raw); } catch {}
        safeRemove(oldKey);
      }
    }
  }

  /* ---------- Key getters that resolve to the active profile ---------- */
  function KEYS() {
    const p = getActiveProfile();
    return {
      attempts:  profileKey(p, 'attempts.v1'),
      bookmarks: profileKey(p, 'bookmarks.v1'),
      progress:  profileKey(p, 'progress.v1'),
      settings:  profileKey(p, 'settings.v1'),
      history:   profileKey(p, 'history.v1'),
    };
  }

  const Storage = {
    /* ----- profile API ----- */
    getProfiles, getActiveProfile, switchProfile, addProfile, deleteProfile,
    renameProfile, clearProfileData, profileStats, ensureProfile,

    /* ----- attempts ----- */
    getAttempt(testId) {
      const all = safeGet(KEYS().attempts, {});
      return all[testId] || null;
    },
    saveAttempt(testId, attempt) {
      const all = safeGet(KEYS().attempts, {});
      all[testId] = attempt;
      safeSet(KEYS().attempts, all);
    },
    clearAttempt(testId) {
      const all = safeGet(KEYS().attempts, {});
      delete all[testId];
      safeSet(KEYS().attempts, all);
    },

    /* ----- bookmarks ----- */
    bookmarkKey(testId, qNum) { return `${testId}::${qNum}`; },
    isBookmarked(testId, qNum) {
      const all = safeGet(KEYS().bookmarks, {});
      return !!all[this.bookmarkKey(testId, qNum)];
    },
    toggleBookmark(testId, qNum) {
      const all = safeGet(KEYS().bookmarks, {});
      const k = this.bookmarkKey(testId, qNum);
      if (all[k]) delete all[k]; else all[k] = { test_id: testId, q: qNum, ts: Date.now() };
      safeSet(KEYS().bookmarks, all);
      return !!all[k];
    },
    allBookmarks() {
      return safeGet(KEYS().bookmarks, {});
    },

    /* ----- progress ----- */
    setProgress(testId, status) {
      const all = safeGet(KEYS().progress, {});
      all[testId] = status;
      safeSet(KEYS().progress, all);
    },
    getProgress(testId) {
      return safeGet(KEYS().progress, {})[testId] || 'untouched';
    },
    allProgress() { return safeGet(KEYS().progress, {}); },

    /* ----- history ----- */
    addHistory(entry) {
      const arr = safeGet(KEYS().history, []);
      arr.unshift(entry);
      safeSet(KEYS().history, arr.slice(0, 200));
    },
    getHistory() { return safeGet(KEYS().history, []); },

    /* ----- settings ----- */
    getSetting(k, def) {
      const all = safeGet(KEYS().settings, {});
      return k in all ? all[k] : def;
    },
    setSetting(k, v) {
      const all = safeGet(KEYS().settings, {});
      all[k] = v;
      safeSet(KEYS().settings, all);
    },

    /* ----- aggregates ----- */
    aggregateStats(allTests) {
      const attempts = safeGet(KEYS().attempts, {});
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

  // Run migration on load.
  migrateLegacy();
  // Always make sure the active profile exists in the list.
  ensureProfile(getActiveProfile());

  window.Storage = Storage;
})();
