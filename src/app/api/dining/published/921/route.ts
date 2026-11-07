import { getDiningSnapshotRepository } from "@/services/diningSnapshotRepository";
import { bentleyMenuDate, isBentleyMenuDate } from "@/lib/bentleyDiningDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date");
  if (requestedDate !== null && !isBentleyMenuDate(requestedDate)) {
    return Response.json({ ok: false, error: "invalid-menu-date" }, { status: 400 });
  }
  const repository = getDiningSnapshotRepository();
  const snapshot = requestedDate
    ? await repository.get("921", requestedDate)
    : await repository.getCurrentPublished("921") ?? await repository.get("921", bentleyMenuDate());

  if (!snapshot || snapshot.publicationSource !== "trusted-browser-sync") {
    return Response.json({ ok: false, error: "published-snapshot-unavailable" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json({ ok: true, availabilityVerified: false, view: requestedDate ? "dated-publication" : "last-publication", menuDate: snapshot.menuDate, snapshot }, {
    headers: { "Cache-Control": "no-store" },
  });
}
