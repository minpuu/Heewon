import { parseWalkMinutes } from "@/config/app";
import { ListScreen } from "@/screens/ListScreen";

interface ListPageProps {
  searchParams: Promise<{ walk?: string | string[] }>;
}

export default async function ListPage({ searchParams }: ListPageProps) {
  const params = await searchParams;
  return <ListScreen walkMinutes={parseWalkMinutes(params.walk)} />;
}
