#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function readMessageFromNpmArgv(scriptName) {
  const raw = process.env.npm_config_argv;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const original = Array.isArray(parsed.original) ? parsed.original : [];
    const scriptIndex = original.findIndex(arg => arg === scriptName);
    if (scriptIndex === -1) return [];

    return original.slice(scriptIndex + 1).filter(arg => arg !== '--');
  } catch {
    return [];
  }
}

function getMessageParts(scriptName, explicitArgs) {
  if (explicitArgs.length > 0) return explicitArgs;

  const npmArgvParts = readMessageFromNpmArgv(scriptName);
  if (npmArgvParts.length > 0) return npmArgvParts;

  if (process.env.npm_config_message) {
    return [process.env.npm_config_message];
  }

  return [];
}

const [channel, environment, ...explicitMessageParts] = process.argv.slice(2);
const scriptName = process.env.npm_lifecycle_event || 'update';
const messageParts = getMessageParts(scriptName, explicitMessageParts);
const message = messageParts.join(' ').trim();

if (!channel || !environment) {
  console.error('缺少 channel 或 environment 参数。');
  process.exit(1);
}

if (!message) {
  console.error(`缺少更新说明。\n用法示例：npm run ${scriptName} "修复首页显示问题"`);
  process.exit(1);
}

const result = spawnSync(
  'npx',
  [
    'eas-cli',
    'update',
    '--channel',
    channel,
    '--message',
    message,
    '--environment',
    environment,
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

process.exit(result.status ?? 1);
