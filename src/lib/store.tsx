"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { AppState, Profile, Post } from "./types";
import { initialState, resetState, newPublicId } from "./mockData";

// 試作品用のブラウザ内メモリストア。ページを再読み込みすると初期状態に戻る。
// 本番ではここが API + DB になる（docs/architecture.md 参照）。

type Store = {
  state: AppState;
  createPost: (body: string) => void;
  toggleLike: (postId: string) => void;
  addReply: (postId: string, body: string) => void;
  toggleFollow: (publicId: string) => void;
  updateMyProfile: (patch: Partial<Profile>) => void;
  monthlyReset: () => void; // 月初リセットのシミュレーション
  discoverPeople: () => void; // 月初に「新しい人を探す」
};

const StoreContext = createContext<Store | null>(null);

// リセット後に「探す」と現れる、今月の新しい人たち。
function freshPeople(): { people: Profile[]; posts: Post[] } {
  const a: Profile = { publicId: newPublicId(), displayName: "とお", icon: "🌙", bio: "今月はじめまして。" };
  const b: Profile = { publicId: newPublicId(), displayName: "りん", icon: "🍋", bio: "先月のことは覚えていない。" };
  const c: Profile = { publicId: newPublicId(), displayName: "そら", icon: "🪁", bio: "新しい月、新しい名前。" };
  const now = Date.now();
  return {
    people: [a, b, c],
    posts: [
      { id: newPublicId(), authorPublicId: a.publicId, body: "また1日が来た。今月もよろしく。", createdAt: now - 60000, likedBy: [], replies: [] },
      { id: newPublicId(), authorPublicId: b.publicId, body: "知り合いがいない月初は、いつも少し心細い。", createdAt: now - 120000, likedBy: [], replies: [] },
      { id: newPublicId(), authorPublicId: c.publicId, body: "はじめまして。今月の自分はこんな感じ。", createdAt: now - 180000, likedBy: [], replies: [] },
    ],
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());

  const store: Store = useMemo(
    () => ({
      state,
      createPost: (body) => {
        const trimmed = body.trim();
        if (!trimmed) return;
        setState((s) => ({
          ...s,
          posts: [
            {
              id: newPublicId(),
              authorPublicId: s.me.publicId,
              body: trimmed,
              createdAt: Date.now(),
              likedBy: [],
              replies: [],
            },
            ...s.posts,
          ],
        }));
      },
      toggleLike: (postId) => {
        setState((s) => ({
          ...s,
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const liked = p.likedBy.includes(s.me.publicId);
            return {
              ...p,
              likedBy: liked
                ? p.likedBy.filter((id) => id !== s.me.publicId)
                : [...p.likedBy, s.me.publicId],
            };
          }),
        }));
      },
      addReply: (postId, body) => {
        const trimmed = body.trim();
        if (!trimmed) return;
        setState((s) => ({
          ...s,
          posts: s.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  replies: [
                    ...p.replies,
                    { id: newPublicId(), authorPublicId: s.me.publicId, body: trimmed, createdAt: Date.now() },
                  ],
                }
              : p
          ),
        }));
      },
      toggleFollow: (publicId) => {
        setState((s) => ({
          ...s,
          following: s.following.includes(publicId)
            ? s.following.filter((id) => id !== publicId)
            : [...s.following, publicId],
        }));
      },
      updateMyProfile: (patch) => {
        setState((s) => ({ ...s, me: { ...s.me, ...patch } }));
      },
      monthlyReset: () => {
        setState(resetState());
      },
      discoverPeople: () => {
        setState((s) => {
          if (s.people.length > 0) return s;
          const { people, posts } = freshPeople();
          return { ...s, people, posts };
        });
      },
    }),
    [state]
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore は StoreProvider の中で使ってください");
  return ctx;
}

// publicId から今月のプロフィールを引く（自分 + 他の人）。
export function useProfileLookup() {
  const { state } = useStore();
  return (publicId: string): Profile | undefined => {
    if (publicId === state.me.publicId) return state.me;
    return state.people.find((p) => p.publicId === publicId);
  };
}
