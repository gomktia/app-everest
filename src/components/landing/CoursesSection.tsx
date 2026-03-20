import { Card, CardContent } from '@/components/ui/card'
import {
  BookOpen,
  Brain,
  FileText,
  Trophy,
  Target,
  Headphones,
  BarChart3,
  MessageSquare,
  Timer,
  Library,
  ClipboardList,
  Layers,
} from 'lucide-react'

const features = [
  {
    title: 'Videoaulas',
    description: 'Aulas gravadas com professores especialistas, organizadas por módulos.',
    icon: BookOpen,
    color: 'text-blue-500 bg-blue-100 dark:bg-blue-950/50',
  },
  {
    title: 'Flashcards',
    description: 'Revisão espaçada com sistema de repetição inteligente para fixar conteúdo.',
    icon: Brain,
    color: 'text-purple-500 bg-purple-100 dark:bg-purple-950/50',
  },
  {
    title: 'Simulados',
    description: 'Provas completas no formato oficial com correção automática e ranking.',
    icon: ClipboardList,
    color: 'text-red-500 bg-red-100 dark:bg-red-950/50',
  },
  {
    title: 'Redações',
    description: 'Envie suas redações e receba correção detalhada com nota por competência.',
    icon: FileText,
    color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950/50',
  },
  {
    title: 'Quizzes',
    description: 'Teste seus conhecimentos com questões organizadas por matéria e tópico.',
    icon: Layers,
    color: 'text-amber-500 bg-amber-100 dark:bg-amber-950/50',
  },
  {
    title: 'Ranking',
    description: 'Compare seu desempenho com outros alunos e suba no ranking geral.',
    icon: Trophy,
    color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-950/50',
  },
  {
    title: 'Plano de Estudos',
    description: 'Organize sua rotina com cronograma, Pomodoro e acompanhamento de metas.',
    icon: Target,
    color: 'text-primary bg-primary/10',
  },
  {
    title: 'Evercast',
    description: 'Audioaulas para estudar em qualquer lugar, no ônibus ou na academia.',
    icon: Headphones,
    color: 'text-pink-500 bg-pink-100 dark:bg-pink-950/50',
  },
  {
    title: 'Progresso',
    description: 'Acompanhe sua evolução com gráficos detalhados e histórico de estudos.',
    icon: BarChart3,
    color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-950/50',
  },
  {
    title: 'Comunidade',
    description: 'Fórum de discussão com outros alunos e professores para tirar dúvidas.',
    icon: MessageSquare,
    color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-950/50',
  },
  {
    title: 'Pomodoro',
    description: 'Timer integrado com técnica Pomodoro e janela flutuante Picture-in-Picture.',
    icon: Timer,
    color: 'text-rose-500 bg-rose-100 dark:bg-rose-950/50',
  },
  {
    title: 'Acervo Digital',
    description: 'Biblioteca com provas anteriores, livros e materiais complementares.',
    icon: Library,
    color: 'text-teal-500 bg-teal-100 dark:bg-teal-950/50',
  },
]

export const CoursesSection = () => {
  return (
    <section id="cursos" className="py-16 md:py-24 bg-secondary">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Tudo que você precisa para ser aprovado
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Uma plataforma completa com todas as ferramentas para sua preparação.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
