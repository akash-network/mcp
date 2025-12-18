import { createChainNodeSDK } from '@akashnetwork/chain-sdk';
import * as fs from 'fs';

async function debug() {
  const grpcEndpoint = 'https://akash-grpc.publicnode.com:443';

  console.log('Initializing SDK (query only)...');

  const sdk = createChainNodeSDK({
    query: { baseUrl: grpcEndpoint },
  });

  const address = 'akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn';

  console.log('=== Querying certificates on chain ===\n');

  const response = await sdk.akash.cert.v1.getCertificates({
    filter: {
      owner: address,
      serial: '',
      state: 'valid',
    },
    pagination: undefined,
  });

  console.log('Found', response.certificates?.length || 0, 'valid certificates\n');

  for (const cert of response.certificates || []) {
    console.log('Serial:', cert.serial);

    const certBytes = cert.certificate?.cert;
    if (certBytes) {
      const certPem = new TextDecoder().decode(certBytes);
      console.log('Chain cert (first line):', certPem.split('\n')[0]);
    }

    const pubkeyBytes = cert.certificate?.pubkey;
    if (pubkeyBytes) {
      const pubkeyPem = new TextDecoder().decode(pubkeyBytes);
      console.log('Chain pubkey (first line):', pubkeyPem.split('\n')[0]);
      console.log('Chain pubkey full:\n', pubkeyPem);
    }
  }

  console.log('\n=== Local certificate ===\n');
  const localCert = JSON.parse(fs.readFileSync('./dist/utils/certificates/akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn.json', 'utf8'));
  console.log('Local publicKey (first line):', localCert.publicKey.split('\n')[0]);
  console.log('Local publicKey full:\n', localCert.publicKey);
}

debug().catch(console.error);
