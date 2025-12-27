import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

// Fetch all schedules
export function useSchedules() {
  return useQuery({
    queryKey: [api.schedules.list.path],
    queryFn: async () => {
      const res = await fetch(api.schedules.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return api.schedules.list.responses[200].parse(await res.json());
    },
  });
}

// Create new schedule
export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.schedules.create.input>) => {
      const validated = api.schedules.create.input.parse(data);
      const res = await fetch(api.schedules.create.path, {
        method: api.schedules.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.schedules.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create schedule");
      }
      return api.schedules.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}

// Toggle schedule status
export function useToggleSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const url = buildUrl(api.schedules.toggle.path, { id });
      const res = await fetch(url, {
        method: api.schedules.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle schedule");
      return api.schedules.toggle.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}
