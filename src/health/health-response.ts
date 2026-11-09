export interface HealthResponse {
  status: 'ok' | 'unhealthy';
  uptime: number;
  timestamp: string;
  checks: {
    aiProvider: {
      status: 'up' | 'down';
      message?: string;
    };
  };
}
