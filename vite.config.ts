/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile, mkdir } from 'node:fs/promises';
import { exchangeToken } from './server/stravaToken';

// Tylko dev (configureServer): zapis wycinanek kolażu z src/dev/collageCutouts.ts do src/assets/collage/cutouts.
function collageCutoutsSink(): Plugin {
  return {
    name: 'collage-cutouts-sink',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.match(/^\/__dev\/collage-cutouts\/([0-9a-z]+\.(?:png|json))$/)?.[1];
        if (!name || req.method !== 'POST') return next();
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        await mkdir('src/assets/collage/cutouts', { recursive: true });
        await writeFile(`src/assets/collage/cutouts/${name}`, Buffer.concat(chunks));
        res.end();
      });
    },
  };
}

// Lokalny odpowiednik api/strava/token.ts (Vercel): ten sam moduł, tylko inne wejście HTTP.
function stravaTokenApi(env: Record<string, string>): Plugin {
  return {
    name: 'strava-token-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/strava/token') return next();
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          body = undefined;
        }
        const result = await exchangeToken(body, env);
        res.statusCode = result.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result.json));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), stravaTokenApi(loadEnv(mode, process.cwd(), '')), collageCutoutsSink()],
  // Tylko testy tego repo, bez kopii w worktree innych sesji (.claude/worktrees).
  test: { exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'] },
}));
