// app/api/lookupBarcode/route.ts
import { NextResponse, NextRequest } from "next/server";
import { lookupBarcode } from "@/lib/barcode";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  // 認証チェック
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  try {
    const { barcode } = await req.json();
    if (!barcode) {
      return NextResponse.json({ error: "バーコードが指定されていません。" }, { status: 400 });
    }

    const product = await lookupBarcode(barcode);

    if (!product.found) {
      return NextResponse.json({ error: "該当する商品が見つかりませんでした。" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (e) {
    console.error("lookupBarcode error:", e);
    return NextResponse.json(
      { error: "バーコード検索に失敗しました。再度お試しください。" },
      { status: 500 }
    );
  }
}
