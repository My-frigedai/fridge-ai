// app/api/stripe/createCheckoutSession/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const priceId = process.env.STRIPE_PRICE_ID;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

if (!stripeKey) console.error("STRIPE_SECRET_KEY not set");
if (!priceId) console.error("STRIPE_PRICE_ID not set");

const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "支払い機能が未設定です" },
        { status: 500 },
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "価格IDが設定されていません" },
        { status: 500 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: encodeURIComponent(priceId),
          quantity: 1,
        },
      ],
      payment_method_types: ["card"],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe error:", err);
    return NextResponse.json(
      { error: "支払いの準備に失敗しました。時間を置いて再試行してください。" },
      { status: 500 },
    );
  }
}
