import { NextResponse } from "next/server";
import { SEARCH_RADIUS_METERS } from "@/config/app";
import { getServerRestaurantProvider } from "@/data/serverRestaurantProvider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const { source, provider } = getServerRestaurantProvider();
  try {
    const restaurants = await provider.searchNearby({ latitude, longitude }, SEARCH_RADIUS_METERS);
    return NextResponse.json({ source, restaurants });
  } catch {
    return NextResponse.json({ error: "restaurant provider failed" }, { status: 502 });
  }
}
