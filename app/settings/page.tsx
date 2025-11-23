"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/button";
import { useTheme } from "@/app/components/ThemeProvider";
import NavBar from "@/app/components/NavBar"; // ✅ 追加

export default function SettingsPage() {
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [billingHistory] = useState<{ date: string; amount: number }[]>([
    { date: "2025-09-01", amount: 500 },
    { date: "2025-08-10", amount: 500 },
  ]);

  const { theme, setTheme } = useTheme();

  const handleSaveProfile = () => {
    setIsEditing(false);
    alert("プロフィールを更新しました！");
  };

  const handlePasswordChange = () => {
    alert(`パスワードを変更しました: ${newPassword}`);
    setNewPassword("");
    setShowPasswordChange(false);
  };

  const handleDeleteAccount = async () => {
    if (!confirm("本当にアカウントを削除しますか？この操作は元に戻せません。")) return;

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
      });

      if (res.ok) {
        alert("アカウントを削除しました");
        signOut({ callbackUrl: "/register" });
      } else {
        const data = await res.json();
        alert(`削除に失敗しました: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 pb-32"> {/* ✅ 下のNavBar分余白追加 */}
      {/* プロフィールカード */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">{session?.user?.name || "未設定"}</div>
            <div className="text-muted">{session?.user?.email || "メール未設定"}</div>
          </div>
          <Button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "キャンセル" : "編集"}
          </Button>
        </div>

        {isEditing && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="名前を変更"
              defaultValue={session?.user?.name || ""}
              className="input"
            />
            <input
              type="email"
              placeholder="メールを変更"
              defaultValue={session?.user?.email || ""}
              className="input"
            />
            <Button onClick={handleSaveProfile} className="w-full">
              保存
            </Button>
          </div>
        )}
      </div>

      {/* テーマ設定 */}
      <div className="card p-4 space-y-3">
        <div className="font-semibold">画面テーマ</div>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as "system" | "light" | "dark")}
          className="input"
        >
          <option value="system">OSに合わせる</option>
          <option value="light">ライト（オレンジ背景＋白枠）</option>
          <option value="dark">ダーク（濃い背景＋薄い枠）</option>
        </select>
      </div>

      {/* アカウント設定 */}
      <div className="card p-4 space-y-3">
        <div className="font-semibold">アカウント設定</div>
        <Button
          onClick={() => setShowPasswordChange(!showPasswordChange)}
          className="w-full"
        >
          パスワードを変更
        </Button>

        {showPasswordChange && (
          <div className="space-y-3 mt-2">
            <input
              type="password"
              placeholder="新しいパスワード"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
            />
            <Button onClick={handlePasswordChange} className="w-full">
              変更を保存
            </Button>
          </div>
        )}

        <Button
          onClick={() => signOut({ callbackUrl: "/register" })}
          className="w-full bg-gray-200"
        >
          ログアウト
        </Button>
      </div>

      {/* 課金履歴 */}
      <div className="card p-4">
        <div className="font-semibold mb-3">課金履歴</div>
        {billingHistory.length === 0 ? (
          <p className="text-muted">履歴はありません</p>
        ) : (
          <ul className="space-y-1">
            {billingHistory.map((b, i) => (
              <li key={i} className="text-sm">
                {b.date} - ¥{b.amount}（プレミアム更新）
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 危険ゾーン */}
      <div className="rounded-2xl border p-4 bg-red-50 dark:bg-red-900 shadow">
        <div className="font-semibold text-red-600 dark:text-red-300 mb-3">
          アカウント削除
        </div>
        <Button
          onClick={handleDeleteAccount}
          className="w-full bg-red-600 text-white hover:bg-red-700"
        >
          アカウントを削除
        </Button>
      </div>

      {/* ✅ 常時下部タブ表示 */}
      <NavBar />
    </div>
  );
}
