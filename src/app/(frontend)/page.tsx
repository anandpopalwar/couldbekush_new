import { getProjects } from '@/lib/getProjects';
import { PortfolioClient } from '@/components/portfolio/PortfolioClient';

// Static until an editor changes something: the Payload hooks in
// src/collections/revalidate.ts mark the site stale on publish, edit or delete.

export default async function PortfolioPage() {
  const projects = await getProjects();
  return <PortfolioClient projects={projects} />;
}
