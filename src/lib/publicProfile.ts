import type { AppState, Profile } from "./types";

// Resolve only within the authorized current snapshot. Never search blocked
// profiles or fall back to an account ID, email, or a previous month's data.
export function findPublicProfile(state: AppState, publicId: string | null): Profile | undefined {
  if (!publicId || state.blocked?.some((p) => p.publicId === publicId)) return undefined;
  return publicId === state.me.publicId
    ? state.me
    : state.people.find((p) => p.publicId === publicId);
}

export function publicProfileHref(profile: Profile): string {
  return `/user/?id=${encodeURIComponent(profile.publicId)}`;
}

export function publicProfilePosts(state: AppState, publicId: string | null) {
  if (!findPublicProfile(state, publicId)) return [];
  return state.posts.filter((p) => p.authorPublicId === publicId)
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
