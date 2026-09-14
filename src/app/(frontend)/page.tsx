import { getProjects } from '@/lib/getProjects';
import { PortfolioClient } from '@/components/portfolio/PortfolioClient';

// Re-read published projects from Payload at most once a minute in production.
export const revalidate = 60;

export default async function PortfolioPage() {
  const projects = await getProjects();
  return <PortfolioClient projects={projects} />;
}
