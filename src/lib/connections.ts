import type { AppState, Profile } from './types';

export type Connections = {
  epoch: string;
  targetPublicId: string;
  following: Profile[];
  followers: Profile[];
};

export type ConnectionsResult = { snapshot: AppState; data?: Connections };

export function currentConnections(state: AppState, publicId: string, result?: ConnectionsResult): Connections | undefined {
  if (result?.snapshot !== state || result.data?.targetPublicId !== publicId ||
      result.data?.epoch !== state.epoch) return undefined;
  return result.data;
}

// The demo only models relationships created by the current viewer.
export function demoConnections(state: AppState, targetPublicId: string): Connections {
  const visible = [state.me, ...state.people].filter(p =>
    !state.blocked?.some(b => b.publicId === p.publicId));
  const targetVisible = visible.some(p => p.publicId === targetPublicId);
  return {
    epoch: state.epoch ?? state.period, targetPublicId,
    following: targetVisible && targetPublicId === state.me.publicId
      ? visible.filter(p => state.following.includes(p.publicId)) : [],
    followers: targetVisible && state.following.includes(targetPublicId) ? [state.me] : [],
  };
}
