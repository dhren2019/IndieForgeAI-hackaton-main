import {
  createProject,
  getProjects,
  deleteProject,
  updateProject,
  addToProject,
  removeFromProject,
  getProjectItems,
  getGenerationProjects,
} from "../db/client";
import type { Project, Generation } from "../db/client";

export async function createUserProject(sessionId: string, name: string, emoji?: string): Promise<Project> {
  return createProject(sessionId, name, emoji);
}

export async function getUserProjects(sessionId: string): Promise<Project[]> {
  return getProjects(sessionId);
}

export async function deleteUserProject(projectId: number, sessionId: string): Promise<boolean> {
  return deleteProject(projectId, sessionId);
}

export async function updateUserProject(projectId: number, sessionId: string, name: string, emoji: string) {
  return updateProject(projectId, sessionId, name, emoji);
}

export async function addGenerationToProject(projectId: number, generationId: number, sessionId: string): Promise<boolean> {
  return addToProject(projectId, generationId, sessionId);
}

export async function removeGenerationFromProject(projectId: number, generationId: number, sessionId: string): Promise<boolean> {
  return removeFromProject(projectId, generationId, sessionId);
}

export async function listProjectItems(projectId: number, sessionId: string): Promise<Generation[]> {
  return getProjectItems(projectId, sessionId);
}

export async function getGenerationProjectIds(generationId: number, sessionId: string): Promise<number[]> {
  return getGenerationProjects(generationId, sessionId);
}
