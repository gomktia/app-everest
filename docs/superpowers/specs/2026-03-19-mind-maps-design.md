# Mind Maps — Design Spec

**Data:** 2026-03-19
**Objetivo:** Mapas mentais interativos gerados por IA a partir de PDFs de referencia, exibidos no acervo digital e vinculaveis a aulas.

---

## Visao Geral

A IA le PDFs de estudo (ex: Mapas da Lulu) e gera mapas mentais originais em JSON. O aluno acessa na plataforma como cards interativos em cascata, organizados por materia e topico (mesma logica de quiz subjects/topics).

---

## Database

### Tabela `mind_maps`

```sql
CREATE TABLE mind_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL,
  title text NOT NULL,
  data jsonb NOT NULL,
  icon text DEFAULT 'brain',
  color text DEFAULT 'purple',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_mind_maps_subject ON mind_maps(subject);
```

### Estrutura do JSON `data`

```json
{
  "nodes": [
    {
      "id": "1",
      "label": "Sintaxe",
      "icon": "book",
      "children": [
        {
          "id": "1.1",
          "label": "Predicado Verbal",
          "detail": "Contem verbo transitivo ou intransitivo como nucleo",
          "type": "concept",
          "children": [
            {
              "id": "1.1.1",
              "label": "VTD → Objeto Direto",
              "detail": "Ex: O candidato fez a prova",
              "type": "example"
            }
          ]
        }
      ]
    }
  ]
}
```

Tipos de no: `concept`, `example`, `exception`, `tip`, `rule`, `warning`

---

## Componente Visual — Cards em Cascata

### MindMapViewer.tsx

Componente principal que renderiza o mapa mental interativo.

**Design visual:**
- Fundo com gradiente sutil (bg-gradient)
- No raiz: card grande com titulo, icone da materia, cor tematica
- Nivel 1: cards com borda colorida forte, icone, seta animada de expand
- Nivel 2: cards com cor mais clara, indent visual
- Nivel 3+: cards minimalistas com borda fina
- Cada card tem cantos arredondados (rounded-2xl), sombra sutil
- Campo `detail` aparece com animacao slide-down ao expandir
- Tags visuais por tipo: concept=blue, example=green, exception=orange, tip=purple, rule=slate, warning=red
- Icones por tipo (Lightbulb para tip, AlertTriangle para warning, BookOpen para concept, Code para example, etc)
- Linhas de conexao entre niveis usando borda esquerda colorida (border-l-4)
- Botao "Expandir Tudo" / "Colapsar Tudo" no header
- Animacao spring suave no expand/collapse (CSS transition)
- 100% responsivo — no mobile os cards ficam full-width empilhados

**Cores por materia:**
- Portugues: blue
- Direito Constitucional: purple
- Direito Penal: red
- Direito Administrativo: emerald
- Informatica: cyan
- Matematica: orange
- (configuravel via prop)

### MindMapCard.tsx

Card individual de um no do mapa. Recursivo para renderizar filhos.

Props: node, level, color, expanded, onToggle

**Visual por nivel:**
- Level 0 (raiz): p-6, text-xl, bg com gradiente da cor, texto branco, shadow-lg
- Level 1: p-4, text-base, bg-{color}-50, border-l-4 border-{color}-500
- Level 2: p-3, text-sm, bg-{color}-25, border-l-2 border-{color}-300
- Level 3+: p-2, text-sm, bg-muted/30, border-l border-{color}-200

**Interacao:**
- Click no card expande/colapsa filhos
- Hover mostra shadow mais forte
- Badge com contagem de filhos quando colapsado (ex: "5 subtopicos")
- Chevron animado (rotaciona 90 graus)

---

## Pagina de Mapas Mentais (Acervo)

### MindMapsPage.tsx

Nova pagina `/mapas-mentais` acessivel pela sidebar do aluno.

**Layout:**
- Header: titulo "Mapas Mentais" + icone Brain + contador total
- Filtro por materia (chips/badges clicaveis)
- Search por titulo
- Grid de cards — cada card mostra: titulo do mapa, materia (badge colorida), numero de topicos, icone
- Click no card → abre MindMapViewer fullscreen (dialog ou pagina)

**Card do grid:**
- Icone Brain com cor da materia
- Titulo do mapa (ex: "Sintaxe")
- Badge da materia (ex: "Portugues")
- Subtitulo com quantidade de nos (ex: "24 conceitos")
- Hover com scale sutil + shadow

---

## Script de Importacao Local

### scripts/generate-mind-maps.ts

Script Node.js que roda no PC do admin:

1. Le todos os PDFs de uma pasta recursivamente
2. Para cada PDF, extrai texto com pdf.js
3. Envia para Gemini Flash via API direta (nao via Edge Function)
4. Pede para gerar JSON estruturado no formato do mind_maps.data
5. Salva no Supabase via service_role key

**Prompt Gemini:**
```
Voce e um especialista em criar mapas mentais para concursos brasileiros.
A partir do conteudo abaixo, crie um mapa mental estruturado em JSON.

Regras:
- Organize hierarquicamente: tema principal → subtemas → detalhes
- Cada no tem: id, label (curto), detail (explicacao 1-2 frases), type, children
- Types: concept (conceito), example (exemplo pratico), exception (excecao), tip (dica), rule (regra), warning (pegadinha/cuidado)
- Maximo 4 niveis de profundidade
- Foque nos pontos mais cobrados em concursos
- Inclua exemplos praticos e pegadinhas comuns
```

**Uso:**
```bash
npx tsx scripts/generate-mind-maps.ts --dir "D:/Mapas da Lulu 3.0/72. (v) Português" --subject "Português"
```

---

## Integracao com Aulas

Na LessonPlayerPage, se a aula tem um mind_map vinculado (via subject/topic match), mostrar uma aba "Mapa Mental" com o MindMapViewer.

---

## Sidebar

Adicionar item "Mapas Mentais" na sidebar do aluno, com icone Brain, agrupado na categoria de estudos junto com Flashcards e Banco de Questoes.

---

## Resumo de Mudancas

### Banco de Dados
- `mind_maps`: nova tabela

### Novos Arquivos
- `src/pages/MindMapsPage.tsx` — pagina principal com grid
- `src/components/mind-maps/MindMapViewer.tsx` — visualizador interativo
- `src/components/mind-maps/MindMapCard.tsx` — card recursivo de no
- `src/services/mindMapService.ts` — CRUD de mapas mentais
- `scripts/generate-mind-maps.ts` — script de importacao local

### Modificacoes
- `src/pages/courses/LessonPlayerPage.tsx` — aba opcional "Mapa Mental"
- Sidebar — novo item "Mapas Mentais"
- Router — nova rota `/mapas-mentais`
