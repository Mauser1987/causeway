// Startup: restore the autosaved RCA after a crash or a closed tab, or start a new one.

(() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
  if (saved?.rca) {
    try {
      replaceState(normalizeProject(saved.rca), {saved: !saved.dirty});
      if (saved.dirty) setStatus('Recovered unsaved changes from ' + new Date(saved.savedAt).toLocaleString());
      return;
    } catch {}
  }
  replaceState(blankState());
})();
