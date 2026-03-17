# TODO Pos-Lancamento

## UI/Layout
- [x] Atualizar layout da pagina `/quizzes` (Quizzes por materia) para o padrao visual atual (cards modernos)
- [x] Adicionar link para `/quizzes` no sidebar do aluno (hoje so tem Banco de Questoes e Simulados)

## Performance
- [x] Cache de module/lesson rules no CourseDetailPage (5-10 min TTL)
- [x] Code splitting para chunks maiores que 500KB

## Seguranca
- [x] lesson_comments/ratings SELECT policy leaks across courses - restringir por enrollment
- [x] Password minimo 8 chars (hoje e 6 - default Supabase)
- [x] saveDrawing upsert pode apagar note content

## Features
- [ ] Webhook Kiwify para auto-enrollment apos pagamento
- [ ] Notificacao "acesso expirando em X dias"
- [x] Note auto-save flush ao trocar de aula (edge case)

## Cleanup
- [ ] Remover tabelas com 0 registros se nao usadas (audio_progress, quiz_classes, etc.)
