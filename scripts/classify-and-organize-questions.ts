/**
 * Script: Classificar e Organizar Questões de Português por Tópico
 *
 * Problema: Questões importadas de PDF estão jogadas em quizzes gigantes
 * sem separação por tópico (ex: 937 questões num quiz só).
 *
 * Solução: Analisa o enunciado de cada questão, classifica pelo tópico
 * correto de gramática, e move para o quiz apropriado.
 *
 * Uso: npx tsx scripts/classify-and-organize-questions.ts [--dry-run] [--execute]
 *   --dry-run   (padrão) Mostra relatório sem mover nada
 *   --execute   Move as questões de verdade
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hnhzindsfuqnaxosujay.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuaHppbmRzZnVxbmF4b3N1amF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjkzNTk1MiwiZXhwIjoyMDY4NTExOTUyfQ.Fj2biXwZJNz-cqnma6_gJDMviVGo92ljDCIdFynojZ4'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================================
// REGRAS DE CLASSIFICAÇÃO POR TÓPICO
// Ordem importa: regras mais específicas primeiro
// ============================================================

interface ClassificationRule {
  topic: string
  keywords: RegExp[]
  // If ALL keywords must match (default: any one keyword matches)
  requireAll?: boolean
}

const RULES: ClassificationRule[] = [
  // --- SINTAXE: PERÍODO COMPOSTO (mais específico primeiro) ---
  {
    topic: 'Sintaxe - Período Composto',
    keywords: [
      /ora[çc][ãa]o\s+(subordinad|coordenad)/i,
      /per[ií]odo\s+composto/i,
      /ora[çc][ãa]o\s+(principal|reduzida)/i,
      /subordinada\s+(substantiv|adjetiv|adverbi)/i,
      /conjun[çc][ãa]o\s+(subordinativ|coordenativ|integrante)/i,
      /classifi\w+\s+(da|a)\s+ora[çc][ãa]o/i,
      /ora[çc][õo]es?\s+(subordinad|coordenad)/i,
      /valor\s+sint[áa]tico\s+d[aoe]\s+ora[çc][ãa]o/i,
      /ora[çc][ãa]o\s+em\s+destaque\s+pode\s+ser\s+classific/i,
      /ora[çc][ãa]o\s+adjetiv/i,
      /ora[çc][ãa]o\s+adverbi/i,
      /pronome\s+relativo\s+que\s+(exerce|funciona|tem)/i,
      /ora[çc][ãa]o\s+substantiv/i,
    ],
  },

  // --- SINTAXE: TERMOS INTEGRANTES ---
  {
    topic: 'Sintaxe - Termos Integrantes',
    keywords: [
      /complemento\s+nominal/i,
      /complemento\s+verbal/i,
      /objeto\s+(direto|indireto)/i,
      /agente\s+d[ao]\s+passiva/i,
      /termos?\s+integrantes?/i,
      /fun[çc][ãa]o\s+de\s+(complemento|objeto)/i,
      /complemento\s+e\s+n[ãa]o\s+(como\s+)?adjunto/i,
      /adjunto\s+adnominal\s+(ou|e|x|versus)\s+complemento/i,
    ],
  },

  // --- SINTAXE: TERMOS ACESSÓRIOS ---
  {
    topic: 'Sintaxe - Termos Acessórios',
    keywords: [
      /adjunto\s+adnominal/i,
      /adjunto\s+adverbial/i,
      /aposto/i,
      /vocativo/i,
      /termos?\s+acess[óo]rios?/i,
    ],
  },

  // --- SINTAXE: TERMOS ESSENCIAIS ---
  {
    topic: 'Sintaxe - Termos Essenciais',
    keywords: [
      /sujeito\s+(indeterminad|simples|composto|oculto|inexistente|desinencial|el[íi]ptico|oracional|passiv)/i,
      /classifica[çc][ãa]o\s+d[oe]\s+sujeito/i,
      /sujeito\s+(d[aeo]|é|da\s+ora|est[áa]|posposto|anteposto|corretamente)/i,
      /predicado\s+(verbal|nominal|verbo-nominal)/i,
      /predicativo\s+d[oe]\s+(sujeito|objeto)/i,
      /termos?\s+essenciais?/i,
      /funciona\s+como\s+sujeito/i,
      /n[ãa]o\s+funciona\s+como\s+sujeito/i,
      /verbo\s+(impessoal|impessoais)/i,
      /ora[çc][ãa]o\s+sem\s+sujeito/i,
    ],
  },

  // --- SINTAXE GERAL ---
  {
    topic: 'Sintaxe',
    keywords: [
      /an[áa]lise\s+sint[áa]tic/i,
      /fun[çc][ãa]o\s+sint[áa]tic/i,
      /classifica[çc][ãa]o\s+sint[áa]tic/i,
      /sintaticamente/i,
      /termo\s+sint[áa]tic/i,
      /exerc[eê]\w*\s+(a\s+)?mesma\s+fun[çc][ãa]o\s+sint/i,
      /mesmo\s+papel\s+sint/i,
      /fun[çc][ãa]o\s+(id[eê]ntic|diferent|distint)/i,
    ],
  },

  // --- CONCORDÂNCIA ---
  {
    topic: 'Concordância',
    keywords: [
      /concord[âa]ncia\s+(verbal|nominal)/i,
      /concord[âa]ncia/i,
      /o\s+verbo\s+concorda/i,
      /concordar\s+com/i,
      /flex[ãa]o\s+verbal\s+(est[áa]|é)\s+(corret|incorret)/i,
      /verbo\s+deve\w*\s+(ir|ficar|estar)\s+(no|na)\s+(singular|plural)/i,
    ],
  },

  // --- REGÊNCIA ---
  {
    topic: 'Regência',
    keywords: [
      /reg[êe]ncia\s+(verbal|nominal)/i,
      /reg[êe]ncia/i,
      /verbo\s+\w+\s+[ée]\s+transitivo/i,
      /transitiv(o|a)\s+(diret|indiret)/i,
      /transitividade/i,
      /verbo\s+transitivo/i,
      /intransitivo/i,
      /erro\s+(de\s+)?reg[êe]ncia/i,
    ],
  },

  // --- CRASE ---
  {
    topic: 'Crase',
    keywords: [
      /crase/i,
      /acento\s+(grave|indicativo\s+de\s+crase)/i,
      /uso\s+d[oa]\s+crase/i,
      /sinal\s+indicativo\s+de\s+crase/i,
    ],
  },

  // --- PONTUAÇÃO ---
  {
    topic: 'Pontuação',
    keywords: [
      /pontua[çc][ãa]o/i,
      /v[íi]rgula/i,
      /ponto\s+e\s+v[íi]rgula/i,
      /dois[\s-]pontos/i,
      /aspas/i,
      /travess[ãa]o/i,
      /par[êe]nteses/i,
      /sinal\s+de\s+pontua/i,
      /emprego\s+da\s+v[íi]rgula/i,
      /ponto\s+final/i,
    ],
  },

  // --- COLOCAÇÃO PRONOMINAL ---
  {
    topic: 'Colocação Pronominal',
    keywords: [
      /coloca[çc][ãa]o\s+pronominal/i,
      /pr[óo]clise/i,
      /[êe]nclise/i,
      /mes[óo]clise/i,
      /pronome\s+(obl[íi]quo|[áa]tono)\s+(est[áa]|foi)\s+(bem|mal|corret|incorret)/i,
      /substituir\s+\w+\s+pel[oa]\s+pronome\s+obl[íi]quo/i,
      /erro.*pronome\s+obl[íi]quo/i,
      /pronome\s+obl[íi]quo/i,
    ],
  },

  // --- VOZES VERBAIS ---
  {
    topic: 'Vozes Verbais',
    keywords: [
      /vozes?\s+verb(al|ais)/i,
      /voz\s+(passiva|ativa|reflexiva)/i,
      /passiva\s+(sint[ée]tica|anal[ií]tica)/i,
      /agente\s+e\s+paciente/i,
      /valor\s+de\s+paciente/i,
      /convers[ãa]o\s+(para|em|da|de)\s+voz/i,
      /processo\s+de\s+passiva/i,
    ],
  },

  // --- MORFOLOGIA: ESTRUTURA E FORMAÇÃO DE PALAVRAS ---
  {
    topic: 'Morfologia',
    keywords: [
      // Estrutura de palavras
      /radical/i,
      /raiz\s+(d[aoe]|é|da\s+palavra)/i,
      /mesma\s+raiz/i,
      /mesmo\s+radical/i,
      /prefixo/i,
      /sufixo/i,
      /afixo/i,
      /desin[êe]ncia/i,
      /m[óo]rfico/i,
      /morfema/i,
      /elemento\s+m[óo]rfico/i,
      /an[áa]lise\s+m[óo]rfic/i,
      /estrutura\s+(d[aoe]\s+)?palavr/i,
      // Formação de palavras
      /processo\s+de\s+forma[çc][ãa]o/i,
      /forma[çc][ãa]o\s+de\s+palavr/i,
      /formad[ao]s?\s+por\s+(deriva|composi)/i,
      /deriva[çc][ãa]o\s+(regressiv|parassint[ée]tic|prefixal|sufixal|impr[óo]pria)/i,
      /deriva[çc][ãa]o/i,
      /composi[çc][ãa]o\s+(por\s+)?(aglutina|justaposi)/i,
      /composi[çc][ãa]o/i,
      /cognato/i,
      /neologismo/i,
      /estrangeirismo/i,
      /empréstimo\s+lingu[íi]stico/i,
      /processo\s+de\s+formação/i,
      /formação\s+de\s+\w+\s+(é|está|foram)/i,
      /voc[áa]bulo\s+que\s+apresenta\s+o\s+mesmo\s+processo/i,
      /palavras?\s+formad/i,
      /forma[çc][ãa]o\s+(de|do|da)/i,
      /processo.+forma[çc][ãa]o/i,
      /caracteriza[çc][ãa]o\s+d[oe]\s+processo/i,
    ],
  },

  // --- MORFOLOGIA: CLASSES DE PALAVRAS ---
  {
    topic: 'Morfologia - Classes de Palavras',
    keywords: [
      /classe\s+d[aeo]\s+palavr/i,
      /classes?\s+gramaticais?/i,
      /classe\s+morfol[óo]gica/i,
      /substantivo/i,
      /adjetivo/i,
      /adv[ée]rbio/i,
      /preposi[çc][ãa]o/i,
      /conjun[çc][ãa]o(?!\s+(subordinativ|coordenativ|integrante))/i,
      /pronome\s+(demonstrativ|possessiv|indefinid|interrogativ|pessoal|relativ)/i,
      /artigo\s+(definid|indefinid)/i,
      /interjei[çc][ãa]o/i,
      /numeral/i,
      /emprego\s+d[oae]\s+(pronome|preposi|conjun)/i,
      /valor\s+(d[oae]\s+)?(pronome|preposi|conjun|adv[ée]rbio)/i,
      /classifica[çc][ãa]o\s+(d[oae]\s+)?(pronome|preposi|conjun)/i,
      /voc[áa]bulo\s+"?se"?\s+(tem|apresenta|exerce|possui|é)/i,
      /part[íi]cula\s+"?se"?/i,
      /a\s+classe\s+d[ao]/i,
      /a\s+palavra\s+(grifad|sublinhadsublinh)[ao]?\s+[ée]/i,
      /se\s+classifica\s+como/i,
      /classifica[çc][ãa]o\s+(d[oa]\s+)?palavra/i,
      /funciona\s+como\s+(substantivo|adjetivo|adv[ée]rbio)/i,
      /palavra\s+"?\w+"?\s+[ée]\s+(um|uma)\s+(substantivo|adjetivo|adv[ée]rbio|pronome|preposi|conjun)/i,
      /este\s*\/\s*esta|esse\s*\/\s*essa|aquele\s*\/\s*aquela/i,
      /pronome\s+cujo/i,
      /uso\s+d[oe]\s+"?onde"?/i,
      /classificad[ao]s?\s+corretamente/i,
      /corretamente\s+classificad/i,
      /classifica[çc][ãa]o\s+corret/i,
      /classificam\s+respectivamente/i,
      /a\s+express[ãa]o\s+(sublinhadsublinh|grifad)/i,
      /o\s+vocábulo\s+sublinhadsublinh/i,
      /o\s+termo\s+grifado/i,
      /palavra\s+grifad/i,
      /palavras?\s+sublinhadsublinh/i,
      /é\s+(um|uma)\s+(exemplo\s+de)/i,
      /palavra\s+sublinhadsublinh/i,
      /a\s+palavra\s+sublinhada/i,
      /vocábulos?\s+sublinhadsublinh/i,
      /termos?\s+sublinhadsublinh/i,
      /termos?\s+grifadsublinh/i,
      /express[ãa]o\s+sublinhadsublinh/i,
      /express[ãa]o\s+grifadsublinh/i,
      /palavra\s+grifada/i,
      /vocábulo\s+grifado/i,
      /pronome\s+se[\s,]/i,
      /pronome\s+si[\s,]/i,
      /pronome\s+consigo/i,
      /emprego\s+d[oe]\w*\s+pronome/i,
      /preencha.*lacuna/i,
      /completa\w*\s+(corretamente\s+)?(as\s+)?lacunas?/i,
      /lacunas?\s+d[aoe]\s+frase/i,
      /admitem\s+"?o"?/i,
      /cujo|cuja|cujos/i,
      /este\s+ou\s+neste/i,
      /esse\s+ou\s+nesse/i,
      /a\s+palavra\s+sublinhada\s+[ée]/i,
      /o\s+vocábulo\s+sublinhado\s+[ée]/i,
      /sublinhad[ao]s?\s+est[ãa]o\s+(corretamente\s+)?classificad/i,
      /classificam\s+respectivamente/i,
      /se\s+classifica\w*\s+(como|em)/i,
      /lhe\s+(e\s+)?n[ãa]o\s+o/i,
      /use\s+lhe/i,
    ],
  },

  // --- MORFOLOGIA: FLEXÃO ---
  {
    topic: 'Morfologia - Flexão',
    keywords: [
      /flex[ãa]o\s+(nominal|verbal|de\s+g[êe]nero|de\s+n[úu]mero|de\s+grau)/i,
      /plural\s+d[eoa]/i,
      /plural\s+(corret|incorret|est[áa])/i,
      /grau\s+(superlativo|comparativo|diminutivo|aumentativo)/i,
      /forma[çc][ãa]o\s+d[oe]\s+plural/i,
      /conjuga[çc][ãa]o\s+(verbal|d[oe]\s+verbo)/i,
      /modo\s+(subjuntivo|indicativo|imperativo)/i,
      /tempo\s+verbal/i,
      /pret[ée]rito/i,
      /ger[úu]ndio/i,
      /partic[íi]pio/i,
      /infinitivo\s+(pessoal|impessoal|flexionado)/i,
      /flexionar/i,
      /g[êe]nero\s+(masculin|feminin)/i,
      /admite[mn]?\s+flex[ãa]o/i,
      /n[ãa]o\s+admite\s+flex[ãa]o/i,
      /diminutivo/i,
      /aumentativo/i,
      /forma\s+verbal/i,
      /forma\s+verbais/i,
      /formas?\s+d[oe]\s+(plural|feminino|masculino)/i,
      /mesmo\s+g[êe]nero/i,
      /g[êe]nero\s+masculino/i,
      /g[êe]nero\s+feminino/i,
      /an[áa]lise\s+m[óo]rfic\w+\s+d[aoe]\s+forma\s+verbal/i,
      /plural/i,
      /masculino/i,
      /feminino/i,
      /s[ée]rie\s+de\s+nomes/i,
      /mal\s+ou\s+mau/i,
      /esse\s+ou\s+este/i,
      /formas?\s+verbal|verbais/i,
      /verbo\s+(an[ôo]malo|irregular|defectivo|auxiliar|de\s+liga)/i,
      /imperativo/i,
      /forma\s+correta\s+d[oe]\s+verbo/i,
      /verbo\s+(no|na)\s+(presente|passado|futuro)/i,
    ],
  },

  // --- ORTOGRAFIA ---
  {
    topic: 'Ortografia',
    keywords: [
      /ortografia/i,
      /grafia\s+(corret|incorret)/i,
      /escrita\s+(corret|incorret)/i,
      /erro\s+(de\s+)?grafia/i,
      /h[íi]fen/i,
      /separa[çc][ãa]o\s+sil[áa]bica/i,
      /grafado\s+corretamente/i,
      /escrev[ae]\s+corretamente/i,
      /emprego\s+d[aoe]\s+letr/i,
      /uso\s+(corret|incorret)\s+d[aoe]\s+letr/i,
      /palavras?\s+(est[áa]\s+)?(grafad|escrit)[ao]\s+(corret|incorret)/i,
      /com\s+"?[sS]"?\s+ou\s+"?[zZ]"?/i,
      /com\s+"?[xX]"?\s+ou\s+"?[cC][hH]"?/i,
      /com\s+"?[gG]"?\s+ou\s+"?[jJ]"?/i,
      /com\s+"?[sS][sS]"?\s+ou\s+"?[çc]"?/i,
      /erro\s+de\s+ortografia/i,
    ],
  },

  // --- ACENTUAÇÃO ---
  {
    topic: 'Acentuação',
    keywords: [
      /acentua[çc][ãa]o/i,
      /acento\s+(agudo|circunflexo|t[ôo]nico)/i,
      /regr[ao]s?\s+de\s+acentua/i,
      /acentuad[ao]\s+(corret|incorret)/i,
      /par(ox|oxi)[íi]ton/i,
      /ox[íi]ton/i,
      /proparox[íi]ton/i,
      /palavr[ao]\s+acentuad/i,
      /todas?\s+acentuad/i,
      /acentuad[ao]s?\s+graficamente/i,
      /acentuad[ao]s?\s+(pela|por|em\s+raz)/i,
      /regra\s+de\s+acentua/i,
      /acentuado\s+indevidamente/i,
      /vocábulo\s+acentuado/i,
    ],
  },

  // --- FONÉTICA E FONOLOGIA ---
  {
    topic: 'Fonética e Fonologia',
    keywords: [
      /fon[ée]tica/i,
      /fonologia/i,
      /d[íi]grafo/i,
      /encontro\s+(consonantal|voc[áa]lico)/i,
      /ditongo/i,
      /tritongo/i,
      /hiato/i,
      /fonema/i,
      /s[íi]laba\s+t[ôo]nica/i,
      /separa[çc][ãa]o/i,
    ],
  },

  // --- SEMÂNTICA ---
  {
    topic: 'Semântica',
    keywords: [
      /sem[âa]ntica/i,
      /sin[ôo]nimo/i,
      /ant[ôo]nimo/i,
      /par[ôo]nimo/i,
      /hom[ôo]nimo/i,
      /polissemia/i,
      /ambiguidade/i,
      /sentido\s+(figurado|literal|conotativ|denotativ)/i,
      /significado\s+d[aeo]\s+(palavra|express|termo|voc[áa]bulo)/i,
      /conotativo/i,
      /denotativo/i,
      /rela[çc][ãa]o\s+(significativ|sem[âa]ntic)/i,
      /mesma\s+rela[çc][ãa]o\s+(significativ|sem[âa]ntic)/i,
      /sentido\s+(d[aeo]|em\s+que)/i,
      /substituir\s+sem\s+(alter|mudar|prejud)/i,
      /rela[çc][ãa]o\s+existente\s+entre/i,
      /mesma\s+rela[çc][ãa]o/i,
      /rela[çc][ãa]o\s+entre/i,
    ],
  },

  // --- FIGURAS DE LINGUAGEM ---
  {
    topic: 'Figuras de Linguagem',
    keywords: [
      /figuras?\s+de\s+linguagem/i,
      /met[áa]fora/i,
      /meton[íi]mia/i,
      /hip[ée]rbole/i,
      /ant[íi]tese/i,
      /iron[íi]a/i,
      /eufemismo/i,
      /prosopop[ée]ia/i,
      /personifica/i,
      /catacrese/i,
      /sinestesia/i,
      /pleonasmo/i,
      /elipse/i,
      /zeugma/i,
      /an[áa]fora/i,
      /par[áa]frase/i,
      /figura\s+(de\s+)?(estilo|pensamento|sintaxe|som|palavra)/i,
    ],
  },

  // --- COESÃO E COERÊNCIA ---
  {
    topic: 'Coesão e Coerência',
    keywords: [
      /coes[ãa]o/i,
      /coer[êe]ncia/i,
      /elemento\s+(de\s+)?coes/i,
      /coesivo/i,
      /referencia[çc][ãa]o/i,
      /conector/i,
      /articulador/i,
    ],
  },

  // --- TIPOLOGIA TEXTUAL ---
  {
    topic: 'Tipologia Textual',
    keywords: [
      /tipologia\s+textual/i,
      /g[êe]nero\s+textual/i,
      /tipo\s+de\s+texto/i,
      /texto\s+(dissertativ|narrativ|descritiv|injuntiv|expositiv)/i,
      /g[êe]nero\s+(liter[áa]rio|textual)/i,
    ],
  },

  // --- REDAÇÃO ---
  {
    topic: 'Redação Dissertativa',
    keywords: [
      /reda[çc][ãa]o/i,
      /disserta[çc][ãa]o/i,
      /tese\s+e?\s+argument/i,
      /par[áa]grafo\s+(de\s+)?(introdu|conclus|desenvolvimento)/i,
    ],
  },

  // --- INTERPRETAÇÃO DE TEXTO ---
  {
    topic: 'Interpretação de Texto',
    keywords: [
      /interpreta[çc][ãa]o\s+d[eo]\s+texto/i,
      /compreens[ãa]o\s+(d[eo]\s+)?text/i,
      /de\s+acordo\s+com\s+o\s+texto/i,
      /segundo\s+o\s+texto/i,
      /o\s+texto\s+(afirma|sugere|indica|permite|apresenta|trata|aborda)/i,
      /a\s+ideia\s+(central|principal)/i,
      /o\s+autor\s+(afirma|defende|argumenta|critica|sugere)/i,
      /depreende-se/i,
      /infere-se/i,
      /pode-se\s+(concluir|inferir|depreender|afirmar)/i,
      /t[íi]tulo\s+(mais\s+)?adequado/i,
      /tema\s+(central|principal|d[oe]\s+texto)/i,
      /inten[çc][ãa]o\s+(d[oe]\s+)?(autor|texto)/i,
    ],
  },
]

// ============================================================
// TOPIC IDs (from Supabase)
// ============================================================

const TOPIC_IDS: Record<string, string> = {
  'Acentuação': 'af26ebe3-3afc-40bd-a1a3-a73fde2d5931',
  'Acentuação Gráfica': '083a808a-73a2-4de8-b6b8-281fd2005ae1',
  'Coesão e Coerência': '37def91a-b035-4422-ab95-a87bdef975bb',
  'Colocação Pronominal': '0da36730-77b9-48b3-b62e-dfcd1061bc82',
  'Concordância': '2eec0216-53d2-4869-b693-654911986f2a',
  'Crase': 'a3d8eba2-98aa-410a-aa33-9e27dc07a12f',
  'Figuras de Linguagem': 'e1563eae-579e-4575-8926-77a224dfba56',
  'Fonética e Fonologia': '1de4455f-da37-49af-b461-2df72e9667dc',
  'Interpretação de Texto': '9781af47-1611-4d89-8a6b-a1dc6a281506',
  'Morfologia': '68706c96-031f-4e19-95b6-028b3a708fdb',
  'Morfologia - Classes de Palavras': 'b709558d-4f7d-495c-b3ce-76fde9060910',
  'Morfologia - Flexão': '4c016fe4-5808-4a5e-a648-0adf09e28ade',
  'Ortografia': 'd134c8f8-ea45-42a3-a857-d2b6e0433f94',
  'Pontuação': '7a867589-f324-49c0-a1a6-a331ce81a6d1',
  'Redação Dissertativa': '418cb319-a063-499d-ad74-88d9df27967c',
  'Regência': '4ffec619-9f68-43ac-b925-5b2bf39b2400',
  'Semântica': '25a46cc8-f3e6-44ad-baa2-7469d2f686f9',
  'Semântica e Estilística': 'b8b32a74-73b3-429c-b0a3-bb02e4f2cfc2',
  'Sintaxe': '25dc629d-609e-4989-9354-481db7ca155d',
  'Sintaxe - Período Composto': 'fae6adfa-6f80-4fa7-ad67-9d476a88e6d4',
  'Sintaxe - Termos Acessórios': 'd7b25c57-0461-40d0-9d04-d090f033430f',
  'Sintaxe - Termos Essenciais': '35aebeaf-b7fe-47cf-99ca-3d98fa701952',
  'Sintaxe - Termos Integrantes': '7792a439-d4c6-47da-93c1-3eef712a76b6',
  'Tipologia Textual': '2e0ce22a-c37c-442c-a71e-d9bc3c9b99b8',
  'Vozes Verbais': '921647bf-83d5-4106-a214-f7e9b3285c0c',
}

// Quizzes to process (source quizzes with mixed content)
const SOURCE_QUIZ_IDS = [
  '02098305-cbb1-437b-89d4-fdaa1b2411de', // 1000 Exercicios
  '2697f37b-3f24-44b3-b393-38a8799c457c', // ESA-EEAR
  '9690acf8-e678-430e-bf09-0f8597b00c5a', // Bancas Diversas - Concordância
  '4bb8537a-019e-4713-b8b8-43dd19cbbc2d', // Bancas Diversas - Crase
  '2b9f2e02-4d19-4b6b-937f-faeb982ec0e9', // Bancas Diversas - Interpretação de Texto
  '77fa8ac2-69a6-4168-91f3-bed79211733d', // Bancas Diversas - Morfologia
  'e03e2cbd-7815-476a-8059-79fcb16f3151', // Bancas Diversas - Ortografia
  '9da60ebe-c2a0-4de7-af18-bc46ebd257e8', // Bancas Diversas - Pontuação
  '704b16a9-5b0d-4bbe-b44d-8bdc05959f30', // Bancas Diversas - Regência
  '649fd198-13fd-4340-b5fd-c5df77b41876', // Bancas Diversas - Sintaxe Termos Essenciais
]

// ============================================================
// FUNCTIONS
// ============================================================

function cleanPdfText(text: string): string {
  // Remove PDF line-break hyphens: "radi- cal" → "radical", "forma- ção" → "formação"
  // Use unicode-aware character class since \w doesn't match ç, ã, etc.
  return text.replace(/([a-záàâãéêíóôõúçA-ZÁÀÂÃÉÊÍÓÔÕÚÇ])-\s+([a-záàâãéêíóôõúçA-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, '$1$2')
}

function classifyQuestion(questionText: string): string | null {
  const text = cleanPdfText(questionText.toLowerCase())

  for (const rule of RULES) {
    const matches = rule.keywords.some(kw => kw.test(text))
    if (matches) {
      return rule.topic
    }
  }

  return null // unclassified
}

async function fetchAllQuestions(quizId: string) {
  const allQuestions: any[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('id, question_text, quiz_id')
      .eq('quiz_id', quizId)
      .range(offset, offset + limit - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allQuestions.push(...data)
    if (data.length < limit) break
    offset += limit
  }

  return allQuestions
}

async function getQuizInfo(quizId: string) {
  const { data } = await supabase
    .from('quizzes')
    .select('id, title, topic_id, topics ( name )')
    .eq('id', quizId)
    .single()
  return data
}

async function findOrCreateQuiz(topicName: string, source: string): Promise<string> {
  const topicId = TOPIC_IDS[topicName]
  if (!topicId) throw new Error(`Topic ID not found for: ${topicName}`)

  // Determine quiz title based on source
  let titlePrefix = 'Questões'
  if (source.includes('1000')) titlePrefix = '1000 Exercicios'
  else if (source.includes('ESA-EEAR')) titlePrefix = 'ESA-EEAR'
  else if (source.includes('Bancas Diversas')) titlePrefix = 'Bancas Diversas'
  else if (source.includes('CESPE')) titlePrefix = 'CESPE'

  const targetTitle = `${titlePrefix} - ${topicName}`

  // Check if quiz already exists for this topic with this prefix
  const { data: existing } = await supabase
    .from('quizzes')
    .select('id')
    .eq('topic_id', topicId)
    .ilike('title', `${titlePrefix}%`)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // Create new quiz (using same created_by as existing quizzes)
  const ADMIN_USER_ID = '6bbab29c-53f5-4ae9-a8ed-15333e29dbe7'
  const { data: newQuiz, error } = await supabase
    .from('quizzes')
    .insert({
      title: targetTitle,
      topic_id: topicId,
      status: 'published',
      type: 'quiz',
      created_by_user_id: ADMIN_USER_ID,
    })
    .select('id')
    .single()

  if (error) throw error
  console.log(`  ✅ Criado quiz: "${targetTitle}"`)
  return newQuiz.id
}

async function main() {
  const mode = process.argv.includes('--execute') ? 'execute' : 'dry-run'
  console.log(`\n🔍 Modo: ${mode === 'execute' ? '🚀 EXECUTAR' : '📋 DRY-RUN (relatório apenas)'}\n`)

  const stats: Record<string, number> = {}
  const unclassified: Array<{ id: string; text: string; source: string }> = []
  const moves: Array<{ questionId: string; fromQuiz: string; toTopic: string; source: string }> = []

  for (const quizId of SOURCE_QUIZ_IDS) {
    const quizInfo = await getQuizInfo(quizId)
    if (!quizInfo) {
      console.log(`⚠️  Quiz ${quizId} não encontrado, pulando...`)
      continue
    }

    const quizTitle = quizInfo.title
    const currentTopic = (quizInfo as any).topics?.name || 'N/A'
    console.log(`\n📚 Processando: "${quizTitle}" (tópico atual: ${currentTopic})`)

    const questions = await fetchAllQuestions(quizId)
    console.log(`   ${questions.length} questões encontradas`)

    let stayCount = 0
    let moveCount = 0

    for (const q of questions) {
      const classified = classifyQuestion(q.question_text)

      if (!classified) {
        unclassified.push({
          id: q.id,
          text: q.question_text.substring(0, 100),
          source: quizTitle,
        })
        stats['❓ Não classificada'] = (stats['❓ Não classificada'] || 0) + 1
        continue
      }

      stats[classified] = (stats[classified] || 0) + 1

      // Check if question is already in the correct topic
      if (classified === currentTopic) {
        stayCount++
        continue
      }

      // Question needs to move
      moveCount++
      moves.push({
        questionId: q.id,
        fromQuiz: quizTitle,
        toTopic: classified,
        source: quizTitle,
      })
    }

    console.log(`   ✅ ${stayCount} já estão no tópico correto`)
    console.log(`   🔄 ${moveCount} precisam ser movidas`)
  }

  // ============================================================
  // RELATÓRIO
  // ============================================================
  console.log('\n' + '='.repeat(60))
  console.log('📊 RELATÓRIO DE CLASSIFICAÇÃO')
  console.log('='.repeat(60))

  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1])
  for (const [topic, count] of sortedStats) {
    console.log(`  ${count.toString().padStart(4)} │ ${topic}`)
  }
  console.log(`  ${'─'.repeat(4)}─┤`)
  console.log(`  ${Object.values(stats).reduce((a, b) => a + b, 0).toString().padStart(4)} │ TOTAL`)

  console.log(`\n📦 Questões a mover: ${moves.length}`)
  console.log(`❓ Não classificadas: ${unclassified.length}`)

  if (unclassified.length > 0) {
    console.log('\n--- AMOSTRA DE NÃO CLASSIFICADAS (primeiras 20) ---')
    for (const u of unclassified.slice(0, 20)) {
      console.log(`  [${u.id.substring(0, 8)}] ${u.text}`)
      console.log(`     Fonte: ${u.source}`)
    }
  }

  // Group moves by target topic
  const movesByTopic: Record<string, typeof moves> = {}
  for (const m of moves) {
    if (!movesByTopic[m.toTopic]) movesByTopic[m.toTopic] = []
    movesByTopic[m.toTopic].push(m)
  }

  console.log('\n--- MOVIMENTAÇÕES POR TÓPICO ---')
  for (const [topic, topicMoves] of Object.entries(movesByTopic).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${topicMoves.length.toString().padStart(4)} → ${topic}`)
  }

  // ============================================================
  // EXECUTAR MOVIMENTAÇÕES
  // ============================================================
  if (mode === 'execute' && moves.length > 0) {
    console.log('\n🚀 Executando movimentações...\n')

    // Group by target topic and source for quiz creation
    const quizCache: Record<string, string> = {} // "source|topic" → quizId

    let moved = 0
    for (const m of moves) {
      const cacheKey = `${m.source.split(' - ')[0]}|${m.toTopic}`

      if (!quizCache[cacheKey]) {
        quizCache[cacheKey] = await findOrCreateQuiz(m.toTopic, m.source)
      }

      const targetQuizId = quizCache[cacheKey]

      const { error } = await supabase
        .from('quiz_questions')
        .update({ quiz_id: targetQuizId, needs_review: false })
        .eq('id', m.questionId)

      if (error) {
        console.error(`  ❌ Erro movendo ${m.questionId}: ${error.message}`)
      } else {
        moved++
      }

      if (moved % 100 === 0 && moved > 0) {
        console.log(`  ... ${moved}/${moves.length} movidas`)
      }
    }

    console.log(`\n✅ ${moved}/${moves.length} questões movidas com sucesso!`)

    // Tag unclassified questions with needs_review = true
    if (unclassified.length > 0) {
      console.log(`\n🏷️  Marcando ${unclassified.length} questões não classificadas com "Verificar Tópico"...`)
      const unclassifiedIds = unclassified.map(u => u.id)

      // Process in batches of 100
      let tagged = 0
      for (let i = 0; i < unclassifiedIds.length; i += 100) {
        const batch = unclassifiedIds.slice(i, i + 100)
        const { error } = await supabase
          .from('quiz_questions')
          .update({ needs_review: true })
          .in('id', batch)

        if (error) {
          console.error(`  ❌ Erro marcando batch: ${error.message}`)
        } else {
          tagged += batch.length
        }
      }
      console.log(`  ✅ ${tagged} questões marcadas para revisão do professor`)
    }

    // Clean up empty source quizzes
    console.log('\n🧹 Verificando quizzes vazios...')
    for (const quizId of SOURCE_QUIZ_IDS) {
      const { count } = await supabase
        .from('quiz_questions')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quizId)

      if (count === 0) {
        const info = await getQuizInfo(quizId)
        console.log(`  ⚠️  Quiz "${info?.title}" ficou vazio (0 questões)`)
      } else {
        const info = await getQuizInfo(quizId)
        console.log(`  📋 Quiz "${info?.title}": ${count} questões restantes`)
      }
    }
  } else if (mode === 'dry-run') {
    console.log('\n💡 Para executar as movimentações, rode:')
    console.log('   npx tsx scripts/classify-and-organize-questions.ts --execute')
  }
}

main().catch(console.error)
