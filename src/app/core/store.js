export function loadStoredState(storageKey, seedState, normalizeState) {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    const initialState = normalizeState(structuredClone(seedState));
    saveStoredState(storageKey, initialState);
    return initialState;
  }

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeState({
      ...structuredClone(seedState),
      ...parsed,
      settings: { ...seedState.settings, ...(parsed.settings ?? {}) },
    });
    saveStoredState(storageKey, normalized);
    return normalized;
  } catch {
    const initialState = normalizeState(structuredClone(seedState));
    saveStoredState(storageKey, initialState);
    return initialState;
  }
}

export function saveStoredState(storageKey, nextState) {
  localStorage.setItem(storageKey, JSON.stringify(nextState));
}
