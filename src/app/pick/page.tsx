import { parseWalkMinutes } from "@/config/app";
import { PickScreen } from "@/screens/PickScreen";

interface PickPageProps {
  searchParams: Promise<{ walk?: string | string[]; id?: string | string[] }>;
}

export default async function PickPage({ searchParams }: PickPageProps) {
  const params = await searchParams;
  const fixedId = Array.isArray(params.id) ? params.id[0] : params.id;
  return <PickScreen walkMinutes={parseWalkMinutes(params.walk)} fixedId={fixedId} />;
}
