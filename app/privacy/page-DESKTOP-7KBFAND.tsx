"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">プライバシーポリシー</h1>

      <p className="mb-4 legal-text">
        本プライバシーポリシーは，本サービス「My-fridgeai」におけるユーザーの個人情報の取扱いについて定めるものです。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        第1条（個人情報の収集）
      </h2>
      <p className="mb-4 legal-text">
        本サービスでは，ユーザーが登録する際にメールアドレスなどの個人情報を収集することがあります。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第2条（利用目的）</h2>
      <ul className="mb-4 legal-text">
        <li>サービス提供およびユーザーサポート</li>
        <li>新機能・キャンペーン情報の通知</li>
        <li>不正利用防止・セキュリティ対策</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">第3条（第三者提供）</h2>
      <p className="mb-4 legal-text">
        当社は，法令に基づく場合を除き，ユーザーの同意なく第三者に個人情報を提供することはありません。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第4条（アクセス解析）</h2>
      <p className="mb-4 legal-text">
        当社はサービス改善のため，CookieやGoogle
        Analytics等を用いたアクセス解析を行う場合があります。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        第5条（問い合わせ窓口）
      </h2>
      <p className="mb-4 legal-text">
        個人情報の取扱いに関するお問い合わせは，アプリ内の「お問い合わせ」ページよりご連絡ください。
      </p>

      <p className="text-right text-sm text-gray-600 dark:text-gray-400 mt-8">
        制定日：2025年9月27日
      </p>

      <div className="mt-8">
        <Link
          href="/"
          className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:dark:text-blue-300"
        >
          ← トップに戻る
        </Link>
      </div>
    </main>
  );
}
