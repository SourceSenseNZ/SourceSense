export const runtime = "nodejs";

export async function POST() {
  return Response.json({ message: "Analyze route works" });
}
