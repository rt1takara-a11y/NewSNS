"use client";

import { Icon } from "./Icon";
import { useState } from "react";
import type { Post } from "@/lib/types";
import { useStore, useProfileLookup } from "@/lib/store";
import { timeAgo } from "@/lib/format";

export function PostCard({ post }: { post: Post }) {
  const { state, toggleLike, addReply } = useStore();
  const lookup = useProfileLookup();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const author = lookup(post.authorPublicId);
  const liked = post.likedBy.includes(state.me.publicId);

  const onReply = () => {
    addReply(post.id, replyText);
    setReplyText("");
    setShowReply(false);
  };

  return (
    <article className="card post-card">
      <div className="post-head">
        <div className="avatar">{author?.icon ?? "👤"}</div>
        <div>
          <div className="name">{author?.displayName || "（名前未設定）"}</div>
          <div className="handle">今月のつながり</div>
        </div>
        <div className="time">{timeAgo(post.createdAt)}</div>
      </div>

      <p className="post-body">{post.body}</p>

      <div className="actions">
        <button
          className={liked ? "action liked" : "action"}
          onClick={() => toggleLike(post.id)}
          aria-pressed={liked}
          aria-label={liked ? "いいねを取り消す" : "いいね"}
        >
          <Icon name="heart" /> {post.likedBy.length > 0 ? post.likedBy.length : ""}
        </button>
        <button className="action" aria-expanded={showReply} aria-label="返信する" onClick={() => setShowReply((v) => !v)}>
          <Icon name="reply" /> {post.replies.length > 0 ? post.replies.length : "返信"}
        </button>
      </div>

      {post.replies.length > 0 && (
        <div className="replies">
          {post.replies.map((r) => {
            const ra = lookup(r.authorPublicId);
            return (
              <div className="reply" key={r.id}>
                <div className="avatar">{ra?.icon ?? "👤"}</div>
                <div>
                  <div className="name" style={{ fontSize: 13 }}>
                    {ra?.displayName || "（名前未設定）"}{" "}
                    <span className="handle">・{timeAgo(r.createdAt)}</span>
                  </div>
                  <div>{r.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReply && (
        <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <textarea
            className="grow"
            aria-label="返信内容"
            rows={2}
            placeholder="今月のこの人に返信…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button className="btn small" onClick={onReply} disabled={!replyText.trim()}>
            返信
          </button>
        </div>
      )}
    </article>
  );
}
