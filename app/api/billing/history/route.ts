// app/api/billing/history/route.ts
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    history: [
      { date: "2025-09-01", amount: 500 },
      { date: "2025-08-10", amount: 500 },
      { date: "2025-07-01", amount: 500 },
    ],
  });
}
