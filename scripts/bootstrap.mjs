#!/usr/bin/env node

import readline from 'readline';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('nomaebot NEW Bootstrap\n');

  const apiKey = await ask('Enter your OpenRouter API key: ');
  const username = await ask('Admin username (default: admin): ') || 'admin';
  const password = await ask('Admin password: ');

  console.log('\nHashing password...');
  const passwordHash = await bcrypt.hash(password, 10);
  const sessionSecret = randomBytes(32).toString('hex');

  const envContent = `OPENROUTER_API_KEY=${apiKey}
ADMIN_USERNAME=${username}
ADMIN_PASSWORD_HASH=${passwordHash}
SESSION_SECRET=${sessionSecret}
`;

  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);
  console.log(`\n.env written to ${envPath}`);
  console.log('Run ./scripts/start.sh to start nomaebot NEW');

  rl.close();
}

main().catch(console.error);
