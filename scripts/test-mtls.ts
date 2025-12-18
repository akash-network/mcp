#!/usr/bin/env npx tsx
/**
 * Test mTLS connection to provider
 */

import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROVIDER_URI = 'provider.hurricane.akash.pub';
const PROVIDER_PORT = 8443;

async function main() {
  const address = 'akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn';
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);

  if (!fs.existsSync(certPath)) {
    console.error('Certificate file not found:', certPath);
    process.exit(1);
  }

  const certData = JSON.parse(fs.readFileSync(certPath, 'utf8'));

  console.log('Using certificate from:', certPath);
  console.log('Cert starts with:', certData.cert.substring(0, 50));
  console.log('Key starts with:', certData.privateKey.substring(0, 50));
  console.log();

  // Create HTTPS agent with client cert
  const agent = new https.Agent({
    cert: certData.cert,
    key: certData.privateKey,
    rejectUnauthorized: false,
  });

  // Try to connect to provider status endpoint
  const url = `https://${PROVIDER_URI}:${PROVIDER_PORT}/status`;
  console.log('Connecting to:', url);

  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: PROVIDER_URI,
        port: PROVIDER_PORT,
        path: '/status',
        method: 'GET',
        agent: agent,
      },
      (res) => {
        console.log('Response status:', res.statusCode);
        console.log('Response headers:', JSON.stringify(res.headers, null, 2));

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log('Response body:', data.substring(0, 500));
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });

    req.end();
  });
}

main().catch(console.error);
