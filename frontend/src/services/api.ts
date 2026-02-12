import axios from "axios";
import {
  ILIData,
  ILIHistoryItem,
  ReserveState,
  HealthStatus,
  RevenueData,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://agentic-reserve-system-production.up.railway.app/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiService = {
  // ILI
  getCurrentILI: async (): Promise<ILIData> => {
    const response = await api.get("/ili/current");
    return response.data;
  },

  getILIHistory: async (): Promise<ILIHistoryItem[]> => {
    const response = await api.get("/ili/history");
    return response.data.data || [];
  },

  // Reserve
  getReserveState: async (): Promise<ReserveState> => {
    const response = await api.get("/reserve/state");
    return response.data;
  },

  // Health
  getHealth: async (): Promise<HealthStatus> => {
    const response = await api.get("/health");
    return response.data;
  },

  // Revenue (untuk active agents count)
  getRevenue: async (): Promise<RevenueData> => {
    const response = await api.get("/revenue/current");
    return response.data;
  },
};

export default api;
