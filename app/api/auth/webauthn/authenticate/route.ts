// app/api/auth/webauthn/authenticate/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyAuthenticationResponse,
  AuthenticationResponseJSON,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";

/** base64url -> base64 */
function base64urlToBase64(b64url: string): string {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return s;
}

/** base64 -> Uint8Array (型安全) */
function base64ToUint8Array(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Required env */
const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL;
if (!ORIGIN) throw new Error("NEXT_PUBLIC_BASE_URL is required");

const expectedOrigin = ORIGIN;
const rpID = ORIGIN.replace(/^https?:\/\//, "");

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, assertionResponse } = body as any ?? {};

    if (!rawEmail || !assertionResponse) {
      return NextResponse.json({ ok: false, message: "email and assertionResponse are required" }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) {
      return NextResponse.json({ ok: false, message: "no challenge stored" }, { status: 400 });
    }

    const expectedChallenge = String(user.verifyToken);

    // DB からパスキー取得
    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });
    }

    // クライアントの credential id（base64url）で DB レコードを探す
    const clientCredId = String(assertionResponse.id);
    const pk = passkeys.find((p) => p.credentialId === clientCredId);
    if (!pk) {
      return NextResponse.json({ ok: false, message: "unknown credential" }, { status: 400 });
    }

    // DB に保存した publicKey が base64url か base64 か判定して Uint8Array を作る
    const publicKeyStr = String(pk.publicKey || "");
    const publicKeyBase64 = publicKeyStr.includes("-") || publicKeyStr.includes("_")
      ? base64urlToBase64(publicKeyStr)
      : publicKeyStr;
    const publicKeyUint8 = base64ToUint8Array(publicKeyBase64);

    // credentialId も Uint8Array に（必要なら）
    const credIdBase64 = clientCredId.includes("-") || clientCredId.includes("_")
      ? base64urlToBase64(clientCredId)
      : clientCredId;
    const credentialIDUint8 = base64ToUint8Array(credIdBase64);

    // assertionResponse を型に合わせて扱う
    const assertionJSON = assertionResponse as AuthenticationResponseJSON;

    // --- 型不一致を回避するための最小キャスト ---
    // verifyAuthenticationResponse の型定義が 'authenticator' を受け入れない場合があるため、
    // options を any にキャストして呼び出す（実行時の検証はライブラリが行う）。
    const optionsAny: any = {
      response: assertionJSON,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
      // authenticator info: library will use this to verify signature/counter
      authenticator: {
        credentialID: credentialIDUint8,
        credentialPublicKey: publicKeyUint8,
        counter: Number(pk.signCount ?? 0),
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
      },
    };

    const verification = (await (verifyAuthenticationResponse as any)(optionsAny)) as VerifiedAuthenticationResponse;

    if (!verification || !verification.verified) {
      return NextResponse.json({ ok: false, message: "verification failed" }, { status: 400 });
    }

    // ライブラリが返す newCounter を優先して更新
    const newCounter = verification.authenticationInfo?.newCounter ?? Number(pk.signCount ?? 0);

    await prisma.passkey.update({
      where: { id: pk.id },
      data: { signCount: Number(newCounter) },
    });

    // ワンタイムチャレンジをクリア
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null },
    });

    return NextResponse.json({ ok: true, userId: user.id, message: "webauthn success" });
  } catch (err: any) {
    console.error("webauthn authenticate error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
