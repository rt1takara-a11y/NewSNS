"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function PostComposer() {
  const { state, createPost } = useStore();
  const [text, setText] = useState("");

  const onPost = () => {
    createPost(text);
    setText("");
  };

  const noName = !state.me.displayName.trim();

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="avatar">{state.me.icon}</div>
        <textarea
          className="grow"
          rows={3}
          placeholder={
            noName
              ? "その前に、プロフィールで今月の名前を決めよう"
              : "今月のあなたは、何を書く？（消えるから自由に）"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 12, marginRight: "auto" }}>
          月末にすべて消えます
        </span>
        <button className="btn" onClick={onPost} disabled={!text.trim()}>
          投稿
        </button>
      </div>
    </div>
  );
}
