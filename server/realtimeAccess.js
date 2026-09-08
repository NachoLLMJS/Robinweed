export function realtimeRoleForUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl, 'https://stockdealer.invalid');
  } catch {
    return null;
  }
  if (url.pathname !== '/realtime') return null;
  const entries = [...url.searchParams.entries()];
  if (entries.length === 0) return 'player';
  if (entries.length === 1 && entries[0][0] === 'role' && entries[0][1] === 'spectator') return 'spectator';
  return null;
}

export function roleAllowsClientMessages(role) {
  return role === 'player';
}

export function stateReceivesSnapshots(state) {
  return state?.role === 'spectator' || (state?.role === 'player' && state.joined === true);
}
