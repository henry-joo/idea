import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 기본 모드   : 일반 SPA 빌드 → dist/
 * artifact 모드: React를 CDN UMD 전역(React, ReactDOM)으로 외부화한 단일 HTML → dist-artifact/
 *               (scripts/build-artifact.mjs가 claude.ai Artifact용 조각으로 변환)
 */
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    // 상대 경로로 빌드해 어느 하위 경로(GitHub Pages 등)에 올려도 매니페스트·서비스 워커가 동작한다
    base: './',
    plugins: artifact ? [viteSingleFile()] : [react()],
    esbuild: artifact
      ? { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', jsxInject: `import React from 'react'` }
      : undefined,
    build: artifact
      ? {
          outDir: 'dist-artifact',
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: {
              format: 'iife',
              globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
            },
          },
        }
      : { outDir: 'dist' },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
