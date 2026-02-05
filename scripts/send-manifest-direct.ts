#!/usr/bin/env npx tsx
/**
 * Send manifest directly using the normalized certificate file
 */

import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SDL } from '@akashnetwork/chain-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;
const infisicalEncryptionKey = process.env.INFISICAL_ENCRYPTION_KEY;
const infisicalJwtSecret = process.env.INFISICAL_JWT_SECRET;

if (!mongoPassword || !infisicalEncryptionKey || !infisicalJwtSecret) {
  console.error('Missing required env vars: MONGO_INITDB_ROOT_PASSWORD, INFISICAL_ENCRYPTION_KEY, INFISICAL_JWT_SECRET');
  process.exit(1);
}

const SDL_CONTENT = `---
version: "2.0"

services:
  mongo:
    image: mongo:7
    env:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=${mongoPassword}
    expose:
      - port: 27017
        as: 27017
        to:
          - service: infisical
    params:
      storage:
        data:
          mount: /data/db
          readOnly: false

  infisical:
    image: infisical/infisical:latest
    env:
      - ENCRYPTION_KEY=${infisicalEncryptionKey}
      - JWT_SIGNUP_SECRET=${infisicalJwtSecret}
      - JWT_REFRESH_SECRET=${infisicalJwtSecret}
      - JWT_AUTH_SECRET=${infisicalJwtSecret}
      - JWT_SERVICE_SECRET=${infisicalJwtSecret}
      - MONGO_URL=mongodb://admin:${mongoPassword}@mongo:27017/infisical?authSource=admin
      - SITE_URL=https://secrets.alternatefutures.ai
      - HTTPS_ENABLED=false
      - TELEMETRY_ENABLED=false
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
        accept:
          - secrets.alternatefutures.ai
    depends_on:
      - mongo

profiles:
  compute:
    mongo:
      resources:
        cpu:
          units: 1.0
        memory:
          size: 2Gi
        storage:
          - name: data
            size: 20Gi

    infisical:
      resources:
        cpu:
          units: 1.0
        memory:
          size: 1Gi
        storage:
          size: 512Mi

  placement:
    dcloud:
      signedBy:
        anyOf:
          - "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"
      attributes:
        host: akash
      pricing:
        mongo:
          denom: uakt
          amount: 25
        infisical:
          denom: uakt
          amount: 20

deployment:
  mongo:
    dcloud:
      profile: mongo
      count: 1

  infisical:
    dcloud:
      profile: infisical
      count: 1
`;

async function main() {
  const dseq = process.env.DSEQ;
  const providerHost = process.env.PROVIDER_HOST;

  if (!dseq || !providerHost) {
    console.error('Usage: DSEQ=123 PROVIDER_HOST=provider.example.com:8443 npx tsx send-manifest-direct.ts');
    process.exit(1);
  }

  console.log('=== Direct Manifest Send ===\n');
  console.log('DSEQ:', dseq);
  console.log('Provider:', providerHost);

  // Load certificate from file
  const certPath = path.resolve(__dirname, '../dist/utils/certificates/akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn.json');
  const certData = JSON.parse(fs.readFileSync(certPath, 'utf8'));

  console.log('\nCertificate loaded');
  console.log('Has \\r\\n:', certData.cert.includes('\r\n'));

  // Parse SDL
  const sdl = SDL.fromString(SDL_CONTENT, 'beta3');
  const manifest = sdl.manifestSortedJSON();

  console.log('Manifest length:', manifest.length);

  // Parse provider host
  const [hostname, port] = providerHost.split(':');

  const agent = new https.Agent({
    cert: certData.cert,
    key: certData.privateKey,
    rejectUnauthorized: false,
  });

  const requestPath = `/deployment/${dseq}/manifest`;
  console.log('\nSending to:', `https://${hostname}:${port}${requestPath}`);

  const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port: parseInt(port) || 8443,
        path: requestPath,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': manifest.length,
        },
        agent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: data });
        });
      }
    );

    req.on('error', reject);
    req.write(manifest);
    req.end();
  });

  console.log('\nResponse status:', result.status);
  console.log('Response body:', result.body);

  if (result.status === 200) {
    console.log('\n✅ Manifest sent successfully!');
  } else {
    console.log('\n❌ Manifest send failed');
  }
}

main().catch(console.error);
