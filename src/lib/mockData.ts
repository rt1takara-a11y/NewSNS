import type { AppState, Profile, Post } from "./types";
import { currentPeriod } from "./period";

// ランダムな公開IDを発行する（毎月切り替わるイメージ）。内部IDとは無関係。
export function newPublicId(): string {
  return "u_" + Math.random().toString(36).slice(2, 10);
}

const now = Date.now();
const min = 60 * 1000;

// 今月の他の利用者たち（試作品用のダミー）
const people: Profile[] = [
  { publicId: "u_haru01", displayName: "はる", icon: "🌱", bio: "今月はゆるく過ごす。" },
  { publicId: "u_nao02", displayName: "なお", icon: "🐟", bio: "深夜にだけ現れる。" },
  { publicId: "u_kei03", displayName: "けい", icon: "☕️", bio: "コーヒーと散歩。今月の名前は仮。" },
  { publicId: "u_mio04", displayName: "みお", icon: "🎧", bio: "今月見つけた曲を置いていく。" },
];

// ログイン中の利用者の「今月の姿」（初期値。プロフィール画面で変更できる）
const me: Profile = {
  publicId: "u_me0000",
  displayName: "名無しの9月",
  icon: "🙂",
  bio: "今月からはじめました。",
};

const posts: Post[] = [
  {
    id: "p1",
    authorPublicId: "u_haru01",
    body: "9月になった。先月の自分のことは、もう誰も知らない。ちょっとさびしくて、ちょっと身軽。",
    createdAt: now - 5 * min,
    likedBy: ["u_nao02", "u_kei03"],
    replies: [
      { id: "r1", authorPublicId: "u_kei03", body: "その感じ、わかる。", createdAt: now - 4 * min },
    ],
  },
  {
    id: "p2",
    authorPublicId: "u_mio04",
    body: "今月の名前まだ決めてない。とりあえず投稿してみる。",
    createdAt: now - 12 * min,
    likedBy: ["u_haru01"],
    replies: [],
  },
  {
    id: "p3",
    authorPublicId: "u_nao02",
    body: "月末に約束した「また会おう」が果たせるかは、たぶん運。",
    createdAt: now - 30 * min,
    likedBy: [],
    replies: [],
  },
];

export function initialState(): AppState {
  return {
    period: currentPeriod(),
    me: { ...me },
    people: people.map((p) => ({ ...p })),
    posts: posts.map((p) => ({ ...p, likedBy: [...p.likedBy], replies: [...p.replies] })),
    following: [],
  };
}

// 月初のリセット後の状態（すべての公開情報が消え、自分も新しい姿で始まる）。
export function resetState(): AppState {
  return {
    period: currentPeriod(),
    me: {
      publicId: newPublicId(),
      displayName: "",
      icon: "🙂",
      bio: "",
    },
    people: [], // 月初はまだ誰も見つけていない
    posts: [],
    following: [],
  };
}
