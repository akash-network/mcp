import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import AkashMCP from './AkashMCP.js';

async function main() {
  const server = new AkashMCP();
  const transport = new StdioServerTransport();

  try {
    // Initialize the server
    await server.initialize();
    server.registerTools();

    if (!server.isInitialized()) {
      throw new Error('Server failed to initialize properly');
    }

    // Connect the transport
    await server.connect(transport);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
