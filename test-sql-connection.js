const sql = require('mssql');

// Test different connection configurations
const configs = [
  {
    name: 'Config 1: app_user login (recommended)',
    config: {
      server: 'localhost',
      port: 1433,
      user: 'app_user',
      password: 'YourStrong@Passw0rd',
      database: 'CollaborativeSpreadsheet',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    }
  },
  {
    name: 'Config 2: SA with reset password',
    config: {
      server: 'localhost',
      port: 1433,
      user: 'sa',
      password: 'YourStrong@Passw0rd',
      database: 'CollaborativeSpreadsheet',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    }
  },
  {
    name: 'Config 3: app_user to master DB',
    config: {
      server: 'localhost',
      port: 1433,
      user: 'app_user',
      password: 'YourStrong@Passw0rd',
      database: 'master',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    }
  },
  {
    name: 'Config 4: Using 127.0.0.1 instead of localhost',
    config: {
      server: '127.0.0.1',
      port: 1433,
      user: 'app_user',
      password: 'YourStrong@Passw0rd',
      database: 'CollaborativeSpreadsheet',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    }
  }
];

async function testConnection(configObj) {
  console.log(`\nTesting: ${configObj.name}`);
  console.log('Config:', JSON.stringify(configObj.config, null, 2));
  
  try {
    const pool = await sql.connect(configObj.config);
    console.log('✅ Connected successfully!');
    
    // Try to query
    const result = await pool.request().query('SELECT @@VERSION as version, @@SERVERNAME as serverName, SYSTEM_USER as currentUser');
    console.log('Server:', result.recordset[0].serverName);
    console.log('Current User:', result.recordset[0].currentUser);
    console.log('Version:', result.recordset[0].version.substring(0, 50) + '...');
    
    // Check if our database exists
    const dbCheck = await pool.request()
      .query("SELECT name FROM sys.databases WHERE name = 'CollaborativeSpreadsheet'");
    
    if (dbCheck.recordset.length > 0) {
      console.log('✅ Database "CollaborativeSpreadsheet" exists');
    } else {
      console.log('⚠️ Database "CollaborativeSpreadsheet" does not exist');
    }
    
    await pool.close();
    return configObj.config;
  } catch (err) {
    console.log('❌ Connection failed:', err.message);
    if (err.code === 'ELOGIN') {
      console.log('Possible causes:');
      console.log('  1. User does not exist or wrong password');
      console.log('  2. SQL Server Authentication not enabled');
      console.log('  3. Account is disabled');
    }
    return null;
  }
}

async function runTests() {
  console.log('=================================');
  console.log('SQL Server Connection Diagnostic');
  console.log('=================================');
  
  let workingConfig = null;
  
  // Test each configuration
  for (const config of configs) {
    const result = await testConnection(config);
    if (result) {
      workingConfig = result;
      console.log('\n✅ Found working configuration!');
      break;
    }
  }
  
  if (workingConfig) {
    console.log('\n=================================');
    console.log('✅ SOLUTION FOUND!');
    console.log('=================================');
    console.log('\nUpdate your .env file with these settings:');
    console.log(`
DB_SERVER=${workingConfig.server}
DB_PORT=${workingConfig.port}
DB_USER=${workingConfig.user}
DB_PASSWORD=${workingConfig.password}
DB_NAME=${workingConfig.database}
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
`);
  } else {
    console.log('\n=================================');
    console.log('❌ No working configuration found');
    console.log('=================================');
    console.log('\nNext Steps:');
    console.log('1. Open SSMS (SQL Server Management Studio)');
    console.log('2. Connect using Windows Authentication');
    console.log('3. Run the script: create-app-user.sql');
    console.log('4. If prompted to restart SQL Server, do so');
    console.log('5. Run this test again: node test-sql-connection.js');
    console.log('\nThe script will:');
    console.log('  - Enable SQL Server Authentication');
    console.log('  - Create a new user "app_user" with password "YourStrong@Passw0rd"');
    console.log('  - Create the CollaborativeSpreadsheet database');
    console.log('  - Grant all necessary permissions');
  }
}

// Check if SQL Server service is running (Windows only)
async function checkSQLServerService() {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec('sc query MSSQLSERVER', (error, stdout) => {
      if (error) {
        console.log('⚠️ Could not check SQL Server service status');
      } else if (stdout.includes('RUNNING')) {
        console.log('✅ SQL Server service is running');
      } else {
        console.log('❌ SQL Server service is not running!');
        console.log('   Start it from Services (services.msc) or SQL Server Configuration Manager');
      }
    });
  }
}

// Run the tests
checkSQLServerService();
setTimeout(() => {
  runTests().catch(console.error);
}, 1000);
