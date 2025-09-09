export interface ApiConfig {
  externalApiUrl: string;
  endpoints: {
    userData: string;
    spreadsheetData: string;
    saveData: string;
    permissions: string;
  };
  timeout: number;
  retryAttempts: number;
  wsPort: number;
  wsCorsOrigin: string;
}

export const API_CONFIG: ApiConfig = {
  externalApiUrl: process.env.EXTERNAL_API_URL || 'https://api-epm.example.com',
  
  endpoints: {
    userData: '/api/user/info',
    spreadsheetData: '/api/spreadsheets/:id',
    saveData: '/api/spreadsheets/:id/save',
    permissions: '/api/spreadsheets/:id/permissions'
  },
  
  timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3'),
  
  wsPort: parseInt(process.env.WS_PORT || '3001'),
  wsCorsOrigin: process.env.WS_CORS_ORIGIN || '*'
};

export const getApiEndpoint = (endpoint: string, params?: Record<string, string>): string => {
  let url = API_CONFIG.endpoints[endpoint as keyof typeof API_CONFIG.endpoints] || endpoint;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return `${API_CONFIG.externalApiUrl}${url}`;
};
