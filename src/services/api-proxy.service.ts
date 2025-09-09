import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG, getApiEndpoint } from '../config/api.config';
import { ApiResponse, ProxyRequest, ProxyResponse, UserInfo } from '../types/api.types';
import { logger } from '../utils/logger';

export class ApiProxyService {
  private apiClient: AxiosInstance;
  private retryAttempts: number;

  constructor() {
    this.retryAttempts = API_CONFIG.retryAttempts;
    
    this.apiClient = axios.create({
      baseURL: API_CONFIG.externalApiUrl,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('API Request:', {
          url: config.url,
          method: config.method,
          headers: { ...config.headers, Authorization: '***' }
        });
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('API Response:', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        if (!originalRequest._retry && originalRequest._retryCount < this.retryAttempts) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          logger.warn(`Retrying request (${originalRequest._retryCount}/${this.retryAttempts}):`, {
            url: originalRequest.url,
            method: originalRequest.method
          });
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, originalRequest._retryCount) * 1000)
          );
          
          return this.apiClient(originalRequest);
        }
        
        logger.error('API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Proxy transparent - transmet les headers d'authentification
   */
  async proxyRequest<T = any>(request: ProxyRequest): Promise<ProxyResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        method: request.method,
        url: request.endpoint,
        headers: request.headers,
        data: request.body,
        params: request.query
      };

      const response: AxiosResponse<T> = await this.apiClient.request(config);

      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      logger.error('Proxy request failed:', error);
      
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        };
      }
      
      throw error;
    }
  }

  /**
   * Récupération des données du spreadsheet
   */
  async getSpreadsheetData(spreadsheetId: string, userToken: string): Promise<any> {
    const response = await this.proxyRequest({
      endpoint: `/spreadsheets/${spreadsheetId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    return response.data;
  }

  /**
   * Sauvegarde des données
   */
  async saveSpreadsheetData(
    spreadsheetId: string,
    changes: any[],
    userToken: string
  ): Promise<any> {
    const response = await this.proxyRequest({
      endpoint: `/spreadsheets/${spreadsheetId}/save`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: { changes }
    });

    return response.data;
  }

  /**
   * Récupération des informations utilisateur
   */
  async getUserInfo(userToken: string): Promise<UserInfo> {
    const response = await this.proxyRequest<ApiResponse<UserInfo>>({
      endpoint: API_CONFIG.endpoints.userData,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error('Failed to get user info');
  }

  /**
   * Vérification des permissions
   */
  async checkPermissions(
    spreadsheetId: string,
    userToken: string
  ): Promise<{ canRead: boolean; canWrite: boolean }> {
    try {
      const response = await this.proxyRequest<ApiResponse<any>>({
        endpoint: `/spreadsheets/${spreadsheetId}/permissions`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      return {
        canRead: response.data?.data?.canRead || false,
        canWrite: response.data?.data?.canWrite || false
      };
    } catch (error) {
      logger.error('Failed to check permissions:', error);
      return { canRead: false, canWrite: false };
    }
  }

  /**
   * Batch save pour plusieurs modifications
   */
  async batchSave(
    spreadsheetId: string,
    operations: any[],
    userToken: string
  ): Promise<any> {
    const response = await this.proxyRequest({
      endpoint: `/spreadsheets/${spreadsheetId}/batch`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: { operations }
    });

    return response.data;
  }
}

// Export singleton instance
export const apiProxyService = new ApiProxyService();
