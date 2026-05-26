// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'church-player',
      cwd: './apps/player',
      script: 'npm',
      args: 'run preview', // Runs the SvelteKit frontend
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'sync-agent',
      script: './sync-agent/sync-agent.js',
      cwd: './',
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        API_URL: 'https://cms.yourchurch.org/api',
        DEVICE_ID: 'CLASSROOM-01',
        LOCAL_DIR: './apps/player/static/local-media'
      }
    }
  ]
}
