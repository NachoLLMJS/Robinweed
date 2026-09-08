export const PLAYER_SKINS = Object.freeze([
  Object.freeze({ key: 'fox', url: '/models-v30/characters/fox-walk.glb?v=1' }),
  Object.freeze({ key: 'neonCat', url: '/models-v31/characters/neon-cat-walk.glb?v=1' }),
]);

export function assignSessionPlayerSkin(session, random = Math.random) {
  if (session.playerSkin) return session;
  const index = Math.min(PLAYER_SKINS.length - 1, Math.floor(random() * PLAYER_SKINS.length));
  return { ...session, playerSkin: PLAYER_SKINS[index] };
}
