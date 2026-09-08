// 試作品のデータモデル。
// ※ 本番では「継続する情報（内部アカウント）」と「月ごとに消える情報（公開プロフィール・投稿など）」を
//    DBで分離する（docs/architecture.md 参照）。ここでは画面と流れを試すためのモック用の型。

// 今月の公開プロフィール。publicId は毎月新しく発行される想定（内部IDは画面に出さない）。
export type Profile = {
  publicId: string;
  displayName: string;
  icon: string; // 絵文字で代替（画像アップロードは後回し）
  bio: string;
};

export type Reply = {
  id: string;
  authorPublicId: string;
  body: string;
  createdAt: number;
};

export type Post = {
  id: string;
  authorPublicId: string;
  body: string;
  createdAt: number;
  likedBy: string[]; // いいねした人の publicId
  replies: Reply[];
};

export type AppState = {
  serverNow?: number;
  nextResetAt?: number;
  epoch?: string; // DB-owned month + reset generation
  blocked?: Profile[];
  period: string; // 今月（例: "2026-09"）
  me: Profile; // ログイン中の利用者の「今月の姿」
  people: Profile[]; // 今月存在する他の利用者たち
  posts: Post[];
  following: string[]; // me がフォローしている publicId の一覧
};

