import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Étend l'interface Request pour ajouter le token utilisateur
 */
declare global {
  namespace Express {
    interface Request {
      userToken?: string;
      userId?: string;
      userName?: string;
    }
  }
}

/**
 * Middleware proxy qui transmet les headers d'authentification
 * sans les valider localement
 */
export const proxyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // On transmet simplement les headers d'authentification
  // sans les valider localement
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warn('Request without authorization header', {
      method: req.method,
      url: req.url,
      ip: req.ip
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'NO_AUTH_HEADER',
        message: 'No authorization header provided'
      }
    });
    return;
  }

  // Vérification basique du format
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', {
      method: req.method,
      url: req.url
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_AUTH_FORMAT',
        message: 'Invalid authorization header format. Expected: Bearer <token>'
      }
    });
    return;
  }

  // On attache le token à la requête pour usage ultérieur
  req.userToken = authHeader;
  
  logger.debug('Auth header attached to request', {
    method: req.method,
    url: req.url
  });
  
  next();
};

/**
 * Middleware optionnel qui extrait le token Bearer
 */
export const extractBearerToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    req.userToken = token;
  }
  
  next();
};

/**
 * Middleware pour les routes qui n'ont pas besoin d'authentification
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.userToken = authHeader;
  }
  
  next();
};
