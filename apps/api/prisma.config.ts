import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Runtime can use Neon's pooled URL while CLI migrations use the direct URL.
    // Keeping DATABASE_URL as a fallback preserves local/dev and Docker generation.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
