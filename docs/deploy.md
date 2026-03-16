# Deploy e Configuracao

## Hospedagem

| Componente | Provedor |
|-----------|----------|
| Frontend | Vercel |
| Backend | Supabase (sa-east-1) |
| Video | Panda Video |
| Email | Resend (SMTP) |
| Dominio | app.everestpreparatorios.com.br |

## Variaveis de Ambiente

### Obrigatorias (Vite)

```env
VITE_SUPABASE_URL=https://hnhzindsfuqnaxosujay.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Opcionais (com fallback hardcoded)

```env
VITE_PANDA_API_KEY=panda-33e2092c...
VITE_MEMBERKIT_API_KEY=3cG57cb4CAgAKMX7Fg59qY8f
```

Se ausentes, valores hardcoded no codigo sao usados.

### Build-Time

```
import.meta.env.DEV   — true em desenvolvimento
import.meta.env.PROD  — true em producao
```

## Desenvolvimento Local

### Requisitos

- Node.js 18+
- npm

### Setup

```bash
npm install
npm run dev
```

O Vite roda em `http://localhost:5173` com proxy configurado para a Panda Video API.

### Proxy Local (vite.config.ts)

```
/panda-api → https://api-v2.pandavideo.com.br
```

O proxy injeta o header `Authorization` com a API key do Panda automaticamente em dev.

## Supabase

### Projeto

| Item | Valor |
|------|-------|
| Project Ref | hnhzindsfuqnaxosujay |
| Regiao | sa-east-1 |
| PostgreSQL | v17 |

### Migrations

Migrations ficam em `supabase/migrations/`. Para aplicar:

```bash
# Linkar projeto (precisa do access token)
npx supabase link --project-ref hnhzindsfuqnaxosujay

# Push migrations
npx supabase db push --db-url "postgres://postgres.hnhzindsfuqnaxosujay:<DB_PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

### Regenerar Types

```bash
npx supabase gen types typescript --project-id hnhzindsfuqnaxosujay > src/lib/supabase/types.ts
```

## PWA (Progressive Web App)

A aplicacao e instalavel como PWA em mobile e desktop.

### Caching (Workbox)

| Recurso | Duracao |
|---------|---------|
| Google Fonts | 1 ano |
| Imagens | 30 dias |
| Storage/media | 7 dias |
| API calls | 1 dia |

### Service Worker

- Pre-cache de assets estaticos no build
- Runtime cache com estrategias por tipo de recurso
- Offline fallback para paginas ja visitadas

## Dominios Configurados

### Vercel

- `app.everestpreparatorios.com.br` (producao)
- `everestpreparatorios.vercel.app` (preview)
- `everest-*-preparatorios-geisonhoehr.vercel.app` (branches)

### Supabase Auth (redirect URIs)

```
https://app.everestpreparatorios.com.br/**
https://everestpreparatorios.vercel.app/**
https://everest-*-preparatorios-geisonhoehr.vercel.app/**
```

### Panda Video

Dominio `app.everestpreparatorios.com.br` liberado para embed do player.

## Scripts de Import

Scripts utilitarios em raiz do projeto:

| Script | Descricao |
|--------|-----------|
| `import-enem.ts` | Importar questoes ENEM de CSV |
| `import-military-regex.ts` | Importar questoes militares de PDF via regex |
| `upload-acervo.ts` | Upload de PDFs para o acervo digital |

## Logging

- **Desenvolvimento:** Todos os niveis (debug, info, warn, error, success)
- **Producao:** Apenas `error()` loga no console
- Preparado para integracao com Sentry (comentado no codigo)
- `console.log/warn/error` removidos do codigo (substituidos por `logger`)
