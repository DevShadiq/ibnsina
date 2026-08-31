const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'ipi-employees-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '300M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3003
      }
    }
  ]
};
