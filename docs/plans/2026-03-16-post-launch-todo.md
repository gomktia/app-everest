# TODO Pos-Lancamento

## UI/Layout
- [ ] Atualizar layout da pagina `/quizzes` (Quizzes por materia) para o padrao visual atual (cards modernos)
- [ ] Adicionar link para `/quizzes` no sidebar do aluno (hoje so tem Banco de Questoes e Simulados)

## Performance
- [ ] Cache de module/lesson rules no CourseDetailPage (5-10 min TTL)
- [ ] Code splitting para chunks maiores que 500KB

## Seguranca
- [ ] lesson_comments/ratings SELECT policy leaks across courses - restringir por enrollment
- [ ] Password minimo 8 chars (hoje e 6 - default Supabase)
- [ ] saveDrawing upsert pode apagar note content

## Features
- [ ] Webhook Kiwify para auto-enrollment apos pagamento
- [ ] Notificacao "acesso expirando em X dias"
- [ ] Note auto-save flush ao trocar de aula (edge case)

## Cleanup
- [ ] Remover tabelas com 0 registros se nao usadas (audio_progress, quiz_classes, etc.)
