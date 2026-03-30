export interface ExperienceImage {
  id: number;
  imageUrl: string;
  caption?: string | null;
}

export interface ExperienceCertification {
  experienceId: number;
  certificationId: number;
  certification?: Certification;
}

export interface ExperienceProject {
  experienceId: number;
  projectId: number;
  project?: Project;
}

export interface Experience {
  id: number;
  company: string;
  position: string;
  logo?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  certifications?: ExperienceCertification[];
  images?: ExperienceImage[];
  projects?: ExperienceProject[];
}

export interface ProjectTechnology {
  name: string;
  icon: string | null;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  technologies: ProjectTechnology[];
  images: string[];
  githubLink: string;
  demoLink?: string;
  videoUrl?: string | null;
  isFeatured: boolean;
}

export interface Technology {
  id: number;
  name: string;
  icon: string | null;
}

export interface Publication {
  title: string;
  authors: string;
  publisher: string;
  index: string;
  year: number;
  link?: string;
}

export interface Achievement {
  description: string;
  link?: string;
}

export interface EducationData {
  id: number;
  institution: string;
  degree: string;
  major: string;
  logo: string;
  gpa: number;
  predicate: string;
  scholarship?: string;
  startDate: string;
  endDate: string;
  transcriptLink: string;
  publications: Publication[];
  achievements: Achievement[];
}

export interface Certification {
    id: number;
    category: string;
    name: string;
    issuer: string;
    year: number;
    link: string;
}

export interface ProfileData {
  name: string;
  profileImage: string;
  description: string;
}

export interface AboutData {
  images: string[];
  description: string;
}

export interface ContactData {
  email: string;
  instagram: string;
  youtube: string;
  linkedin: string;
  whatsapp: string | null;
  description: string;
}

export interface Activity {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  images: string[];
  createdAt: string;
}