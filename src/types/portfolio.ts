export interface Project {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  role: string;
  launch: string;
  recognition: string[];
  image: string;
  client?: string;
  techStack?: string[];
  liveUrl?: string;
  overview?: string;
  gallery?: string[];
}

export type NavSection = 'work' | 'about' | 'playground' | 'contact';
