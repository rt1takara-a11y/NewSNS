import Link from "next/link";
import type { Profile } from "@/lib/types";
import { publicProfileHref } from "@/lib/publicProfile";

export function ProfileLink({ profile, icon = false }: { profile: Profile | undefined; icon?: boolean }) {
  const name = profile?.displayName || "（名前未設定）";
  const content = icon ? profile?.icon ?? "👤" : name;
  const className = icon ? "avatar profile-link" : "name profile-link";
  if (!profile) return <span className={className}>{content}</span>;
  return <Link href={publicProfileHref(profile)} className={className}
    aria-label={`${name}の今月のプロフィールを開く`}>{content}</Link>;
}
