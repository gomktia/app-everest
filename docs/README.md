# Everest Preparatorios - Documentacao do Sistema

Plataforma de ensino preparatorio para concursos militares e ENEM.

## Indice

| Documento | Descricao |
|-----------|-----------|
| [Arquitetura](architecture.md) | Stack, estrutura de pastas, padroes de projeto |
| [Rotas](routes.md) | Todas as rotas da aplicacao (publicas, aluno, professor, admin) |
| [Banco de Dados](database.md) | Tabelas, RPCs, views, triggers, storage buckets |
| [Integracoes](integrations.md) | Supabase, Panda Video, MemberKit, Kiwify, Resend, AI |
| [Servicos e Hooks](services-and-hooks.md) | Todos os services, hooks e contexts do frontend |
| [Deploy e Configuracao](deploy.md) | Variaveis de ambiente, Vercel, dominio, PWA |

## Stack Resumida

- **Frontend:** React 19 + TypeScript + Vite (rolldown)
- **UI:** Shadcn/UI + Radix UI + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime + Storage)
- **Video:** Panda Video API v2
- **Deploy:** Vercel
- **Dominio:** app.everestpreparatorios.com.br

## Roles

| Role | Descricao |
|------|-----------|
| `student` | Aluno matriculado em turmas, acessa cursos, quizzes, flashcards |
| `teacher` | Professor, cria conteudo (cursos, quizzes, flashcards, redacoes) |
| `administrator` | Admin completo, gerencia usuarios, turmas, sistema |

## Credenciais de Teste

```
Admin:     admin@teste.com / Admin@252
Professor: professor@teste.com / Prof@252
Aluno:     geisonhoehr@gmail.com / Geison@252
```
