"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    development: {
        client: 'mssql',
        connection: {
            server: process.env.DB_SERVER || 'localhost',
            port: parseInt(process.env.DB_PORT || '1433'),
            user: process.env.DB_USER || 'sa',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'CollaborativeSpreadsheet',
            options: {
                encrypt: process.env.DB_ENCRYPT === 'true',
                trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
                enableArithAbort: true
            }
        },
        migrations: {
            directory: './src/database/migrations',
            extension: 'ts'
        },
        seeds: {
            directory: './src/database/seeds',
            extension: 'ts'
        }
    },
    staging: {
        client: 'mssql',
        connection: {
            server: process.env.DB_SERVER || 'localhost',
            port: parseInt(process.env.DB_PORT || '1433'),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            options: {
                encrypt: true,
                trustServerCertificate: false,
                enableArithAbort: true
            }
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './src/database/seeds'
        }
    },
    production: {
        client: 'mssql',
        connection: {
            server: process.env.DB_SERVER,
            port: parseInt(process.env.DB_PORT || '1433'),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            options: {
                encrypt: true,
                trustServerCertificate: false,
                enableArithAbort: true
            }
        },
        pool: {
            min: 2,
            max: 20
        },
        migrations: {
            directory: './dist/database/migrations',
            tableName: 'knex_migrations'
        }
    }
};
exports.default = config;
//# sourceMappingURL=knexfile.js.map