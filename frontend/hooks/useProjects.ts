import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "../lib/auth-token";
import {
  apiGetProjects,
  apiCreateProject,
  apiUpdateProject,
  apiDeleteProject,
  apiAddToProject,
  apiRemoveFromProject,
  apiGetGenerationProjects,
  type ProjectData,
} from "../lib/api";

export function useProjects() {
  const [projects, setProjects]   = useState<ProjectData[]>([]);
  const [loading, setLoading]     = useState(false);
  const { isSignedIn, isLoaded, getToken }  = useAuth();

  const reload = useCallback(async () => {
    // Sync auth token before any API call (guards against the React effect
    // bottom-up firing order where this hook runs before ClerkTokenSync)
    setTokenGetter(isSignedIn ? getToken : null);
    if (!isSignedIn) { setProjects([]); return; }
    setLoading(true);
    const { data } = await apiGetProjects();
    if (data) setProjects(data);
    setLoading(false);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isLoaded) reload();
  }, [reload, isLoaded, isSignedIn]);

  const createProject = async (name: string, emoji?: string): Promise<ProjectData | null> => {
    const { data } = await apiCreateProject(name, emoji);
    if (data) setProjects((p) => [data, ...p]);
    return data;
  };

  const deleteProject = async (projectId: number) => {
    await apiDeleteProject(projectId);
    setProjects((p) => p.filter((x) => x.id !== projectId));
  };

  const updateProject = async (projectId: number, name: string, emoji: string): Promise<ProjectData | null> => {
    const { data } = await apiUpdateProject(projectId, name, emoji);
    if (data) setProjects((p) => p.map((x) => x.id === projectId ? { ...x, name: data.name, emoji: data.emoji } : x));
    return data ?? null;
  };

  const addToProject = async (projectId: number, generationId: number): Promise<boolean> => {
    const { error } = await apiAddToProject(projectId, generationId);
    if (!error) {
      setProjects((p) =>
        p.map((x) => x.id === projectId ? { ...x, item_count: x.item_count + 1 } : x)
      );
    }
    return !error;
  };

  const removeFromProject = async (projectId: number, generationId: number): Promise<boolean> => {
    const { error } = await apiRemoveFromProject(projectId, generationId);
    if (!error) {
      setProjects((p) =>
        p.map((x) => x.id === projectId ? { ...x, item_count: Math.max(0, x.item_count - 1) } : x)
      );
    }
    return !error;
  };

  const getGenerationProjects = async (generationId: number): Promise<number[]> => {
    const { data } = await apiGetGenerationProjects(generationId);
    return data ?? [];
  };

  return {
    projects,
    loading,
    reload,
    createProject,
    deleteProject,
    updateProject,
    addToProject,
    removeFromProject,
    getGenerationProjects,
  };
}
