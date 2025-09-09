export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  version: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  avatar?: string;
}

export interface AuthToken {
  token: string;
  type: 'Bearer';
  expiresIn?: number;
}

export interface ApiRequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ProxyRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface ProxyResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
}
