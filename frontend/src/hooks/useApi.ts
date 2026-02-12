import { useQuery } from "@tanstack/react-query";
import { apiService } from "../services/api";

export const useILI = () => {
  return useQuery({
    queryKey: ["ili", "current"],
    queryFn: apiService.getCurrentILI,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useReserveState = () => {
  return useQuery({
    queryKey: ["reserve", "state"],
    queryFn: apiService.getReserveState,
    refetchInterval: 30000,
  });
};

export const useHealth = () => {
  return useQuery({
    queryKey: ["health"],
    queryFn: apiService.getHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};

export const useRevenue = () => {
  return useQuery({
    queryKey: ["revenue", "current"],
    queryFn: apiService.getRevenue,
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useILIHistory = () => {
  return useQuery({
    queryKey: ["ili", "history"],
    queryFn: apiService.getILIHistory,
    refetchInterval: 300000, // Refresh every 5 minutes
  });
};
