module.exports = {
  apps: [
    {
      name: 'sync-agent',
      script: './sync/sync-agent.js',
      cwd: './',
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        API_URL: 'https://cms.yourchurch.org/api',
        DEVICE_API_KEY: '',
        LOCAL_DIR: './apps/player/public/local-media',
      },
    },
  ],
}
