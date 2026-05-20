import type { Metadata } from "next"

import { generateHomeFeedMetadata, HomeFeedPage } from "@/app/home-feed-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateHomeFeedMetadata("universe")
}

export default function UniverseFeedPage(props: {
  searchParams?: Promise<{ page?: string | string[]; source?: string | string[] }>
}) {
  return <HomeFeedPage sort="universe" searchParams={props.searchParams} enableUniverseSourceFilter />
}
