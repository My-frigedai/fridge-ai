"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">利用規約</h1>
      <p className="mb-4 legal-text">
        本利用規約（以下，「本規約」といいます。）は，あなた（以下，「ユーザー」といいます。）が
        本サービス「My-fridgeai」（以下，「本サービス」といいます。）を利用するにあたり遵守していただく事項を定めるものです。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第1条（適用）</h2>
      <p className="mb-4 legal-text">
        本規約は，ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されます。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第2条（利用登録）</h2>
      <p className="mb-4 legal-text">
        本サービスにおいては，登録希望者が本規約に同意の上，当社の定める方法によって利用登録を申請し，当社がこれを承認することによって，利用登録が完了するものとします。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第3条（禁止事項）</h2>
      <ul className="mb-4 legal-text">
        <li>法令または公序良俗に違反する行為</li>
        <li>犯罪行為に関連する行為</li>
        <li>当社，本サービスの他の利用者，または第三者の権利を侵害する行為</li>
        <li>本サービスの運営を妨害する行為</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        第4条（本サービスの提供の停止）
      </h2>
      <p className="mb-4 legal-text">
        当社は，以下のいずれかの事由があると判断した場合，ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止することができます。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第5条（免責事項）</h2>
      <p className="mb-4 legal-text">
        当社は，本サービスに事実上または法律上の瑕疵がないことを保証しておりません。
        ユーザーが本サービスを利用したことにより生じたいかなる損害についても，一切の責任を負いません。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">第6条（規約の変更）</h2>
      <p className="mb-4 legal-text">
        当社は，必要と判断した場合には，ユーザーに通知することなく本規約を変更することができます。
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        第7条（準拠法・裁判管轄）
      </h2>
      <p className="mb-4 legal-text">
        本規約の解釈にあたっては，日本法を準拠法とします。本サービスに関して紛争が生じた場合には，当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
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
