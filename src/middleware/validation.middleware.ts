import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './error.middleware';
import { logger } from '../utils/logger';

/**
 * Valide qu'un spreadsheet ID est fourni et valide
 */
export const validateSpreadsheetId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('Spreadsheet ID is required');
  }
  
  // Validation basique du format UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError('Invalid spreadsheet ID format');
  }
  
  next();
};

/**
 * Valide les données de changement de cellule
 */
export const validateCellChange = (req: Request, res: Response, next: NextFunction): void => {
  const { row, column, value } = req.body;
  
  if (row === undefined || column === undefined) {
    throw new ValidationError('Row and column are required');
  }
  
  if (typeof row !== 'number' || typeof column !== 'number') {
    throw new ValidationError('Row and column must be numbers');
  }
  
  if (row < 0 || column < 0) {
    throw new ValidationError('Row and column must be non-negative');
  }
  
  // La valeur peut être null ou undefined (pour suppression)
  // mais on vérifie qu'elle n'est pas un objet complexe non sérialisable
  if (value !== null && value !== undefined) {
    try {
      JSON.stringify(value);
    } catch (error) {
      throw new ValidationError('Cell value must be JSON serializable');
    }
  }
  
  next();
};

/**
 * Valide un batch de changements
 */
export const validateBatchChanges = (req: Request, res: Response, next: NextFunction): void => {
  const { changes } = req.body;
  
  if (!Array.isArray(changes)) {
    throw new ValidationError('Changes must be an array');
  }
  
  if (changes.length === 0) {
    throw new ValidationError('At least one change is required');
  }
  
  if (changes.length > 1000) {
    throw new ValidationError('Too many changes in one batch (max 1000)');
  }
  
  // Valide chaque changement
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    
    if (!change || typeof change !== 'object') {
      throw new ValidationError(`Change at index ${i} is invalid`);
    }
    
    const { row, column, cellId } = change;
    
    if (!cellId && (row === undefined || column === undefined)) {
      throw new ValidationError(`Change at index ${i} must have cellId or row/column`);
    }
    
    if (row !== undefined && (typeof row !== 'number' || row < 0)) {
      throw new ValidationError(`Invalid row at index ${i}`);
    }
    
    if (column !== undefined && (typeof column !== 'number' || column < 0)) {
      throw new ValidationError(`Invalid column at index ${i}`);
    }
  }
  
  next();
};

/**
 * Valide les paramètres de pagination
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const { page = 1, limit = 20 } = req.query;
  
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Page must be a positive number');
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }
  
  // Attache les valeurs parsées à la requête
  req.query.page = pageNum.toString();
  req.query.limit = limitNum.toString();
  
  next();
};

/**
 * Nettoie et valide les entrées pour prévenir les injections
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Nettoie les paramètres
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = req.params[key].trim();
      }
    });
  }
  
  // Nettoie le body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  // Nettoie la query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string).trim();
      }
    });
  }
  
  next();
};

/**
 * Fonction récursive pour nettoyer un objet
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Supprime les caractères de contrôle et trim
        obj[key] = obj[key].replace(/[\x00-\x1F\x7F]/g, '').trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  }
}

/**
 * Limite le taux de requêtes par IP
 */
import rateLimit from 'express-rate-limit';

export const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }
      });
    }
  });
};

// Rate limiters spécifiques
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requêtes par 15 minutes
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 tentatives par 15 minutes