// app/verify-email/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Status = "pending" | "success" | "invalid" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("invalid");
      setMessage("無効なリンクです。確認メールを再送してください。");
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setStatus("invalid");
          setMessage(body?.message ?? "このリンクは無効か期限切れです。");
          return;
        }

        // 成功レスポンス（JSON expected）
        await res.json().catch(() => null);
        setStatus("success");
        setMessage("メール確認が完了しました。ホームへ移動します…");

        // 短いアニメーションを見せてから遷移
        setTimeout(() => router.push("/home"), 1400);
      } catch (err) {
        setStatus("error");
        setMessage(
          "通信エラーが発生しました。ネットワークを確認して再試行してください。",
        );
      }
    };

    run();
  }, [searchParams, router]);

  // 独自スタイル（SVG stroke アニメ用）をここに追加。
  // グローバル CSS と競合しないよう短めに定義しています。
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      aria-live="polite"
    >
      <style>{`
        /* チェックマーク描画 */
        @keyframes draw-check {
          from { stroke-dashoffset: 90; }
          to { stroke-dashoffset: 0; }
        }
        /* クロス描画 */
        @keyframes draw-cross {
          from { stroke-dashoffset: 40; opacity: 0; transform: translateY(-4px); }
          to { stroke-dashoffset: 0; opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section
        className="card max-w-xl w-full p-6 sm:p-8"
        role="status"
        aria-label={
          status === "pending"
            ? "メール確認中"
            : status === "success"
              ? "メール確認完了"
              : status === "invalid"
                ? "リンク無効"
                : "エラー"
        }
      >
        <div className="flex items-start gap-4">
          {/* アイコン領域 */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center"
            style={{ background: "var(--surface-bg)" }}
            aria-hidden
          >
            {status === "pending" && (
              <div className="w-10 h-10 flex items-center justify-center">
                <div
                  className="w-8 h-8 rounded-full border-4 border-t-transparent"
                  style={{
                    borderColor: "var(--accent)",
                    borderTopColor: "transparent",
                    animation: "spin 900ms linear infinite",
                  }}
                />
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {status === "success" && (
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  stroke="rgba(16,185,129,0.12)"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  d="M13 23.5l5 4 13-13"
                  stroke="var(--accent)"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="90"
                  style={{
                    strokeDashoffset: 90,
                    animation:
                      "draw-check 520ms cubic-bezier(.2,.9,.2,1) forwards",
                  }}
                />
              </svg>
            )}

            {status === "invalid" && (
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  stroke="rgba(239,68,68,0.08)"
                  strokeWidth="4"
                  fill="none"
                />
                <g
                  transform="translate(11,11)"
                  stroke="var(--color-text-primary)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                >
                  <path
                    d="M2 2 L18 18"
                    strokeDasharray="40"
                    style={{
                      strokeDashoffset: 40,
                      animation:
                        "draw-cross 360ms cubic-bezier(.2,.9,.2,1) forwards",
                    }}
                  />
                  <path
                    d="M18 2 L2 18"
                    strokeDasharray="40"
                    style={{
                      strokeDashoffset: 40,
                      animation:
                        "draw-cross 360ms 80ms cubic-bezier(.2,.9,.2,1) forwards",
                    }}
                  />
                </g>
              </svg>
            )}

            {status === "error" && (
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  stroke="rgba(234,88,12,0.08)"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  d="M22 12v10"
                  stroke="var(--color-text-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ opacity: 0, animation: "draw-cross 420ms forwards" }}
                />
                <circle
                  cx="22"
                  cy="28"
                  r="1.6"
                  fill="var(--color-text-primary)"
                />
              </svg>
            )}
          </div>

          {/* テキスト領域 */}
          <div className="flex-1">
            <h1 className="title text-xl font-semibold mb-1">
              {status === "pending" && "メール確認中 — 少々お待ちください"}
              {status === "success" && "確認完了"}
              {status === "invalid" && "リンクが無効です"}
              {status === "error" && "通信に失敗しました"}
            </h1>

            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {message ??
                (status === "pending"
                  ? "確認処理を実行しています。完了後、自動的にホームへ移動します。"
                  : "")}
            </p>

            {/* 補助テキストや対処ボタン */}
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              {status === "pending" && (
                <button
                  className="surface-btn"
                  onClick={() => router.push("/login")}
                  aria-label="ログイン画面に戻る"
                >
                  ログインに戻る
                </button>
              )}

              {status === "success" && (
                <button
                  className="continue-btn"
                  onClick={() => router.push("/home")}
                  aria-label="ホームへ"
                >
                  今すぐホームへ
                </button>
              )}

              {status === "invalid" && (
                <>
                  <button
                    className="continue-btn"
                    onClick={() => router.push("/resend-verification")}
                    aria-label="確認メールを再送"
                  >
                    確認メールを再送する
                  </button>
                  <button
                    className="surface-btn"
                    onClick={() => router.push("/register")}
                  >
                    登録に戻る
                  </button>
                </>
              )}

              {status === "error" && (
                <>
                  <button
                    className="continue-btn"
                    onClick={() => window.location.reload()}
                  >
                    再試行
                  </button>
                  <button
                    className="surface-btn"
                    onClick={() => router.push("/register")}
                  >
                    登録に戻る
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* フッター補助：小さなヒント */}
        <div
          className="mt-6 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <p>
            もしメールが届かない場合は迷惑メールフォルダをご確認ください。ドメインの受信設定によっては受信を拒否されることがあります。
          </p>
        </div>
      </section>
    </main>
  );
}
