module.exports = {
  apps: [
    {
      name: 'icb-orchestrator',
      script: 'backend/src/services/agent-swarm/orchestrator.ts',
      interpreter: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ENABLE_SELF_MANAGEMENT: 'true',
        ENABLE_AUTO_UPGRADE: 'true',
        ENABLE_SKILL_LEARNING: 'true'
      },
      error_file: 'logs/orchestrator-error.log',
      out_file: 'logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'icb-backend',
      script: 'backend/src/index.ts',
      interpreter: 'ts-node',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/backend-error.log',
      out_file: 'logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'icb-policy-agent',
      script: 'backend/src/services/agent-swarm/agents/policy-agent.ts',
      interpreter: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/policy-agent-error.log',
      out_file: 'logs/policy-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'icb-security-agent',
      script: 'backend/src/services/agent-swarm/agents/security-agent.ts',
      interpreter: 'ts-node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/security-agent-error.log',
      out_file: 'logs/security-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      cron_restart: '0 */6 * * *' // Run security audit every 6 hours
    }
  ]
};
