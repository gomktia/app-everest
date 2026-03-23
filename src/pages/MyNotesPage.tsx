import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import {
  StickyNote,
  Search,
  BookOpen,
  Play,
  ChevronRight,
  Calendar,
} from 'lucide-react'

interface NoteWithContext {
  id: string
  lesson_id: string
  content: string
  updated_at: string
  lesson_title: string
  course_id: string
  course_title: string
  module_name: string
}

export default function MyNotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<NoteWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user?.id) return

    async function fetchNotes() {
      setLoading(true)
      try {
        const { data: notesData, error: notesError } = await supabase
          .from('lesson_notes')
          .select('id, lesson_id, content, updated_at')
          .eq('user_id', user!.id)
          .order('updated_at', { ascending: false })

        if (notesError) throw notesError
        if (!notesData || notesData.length === 0) {
          setNotes([])
          setLoading(false)
          return
        }

        const lessonIds = notesData.map(n => n.lesson_id)

        const { data: lessonsData } = await supabase
          .from('video_lessons')
          .select('id, title, module_id, video_modules(id, name, course_id, video_courses(id, title))')
          .in('id', lessonIds)

        const lessonMap = new Map<string, { title: string; module_name: string; course_id: string; course_title: string }>()
        if (lessonsData) {
          for (const l of lessonsData as any[]) {
            const mod = l.video_modules
            const course = mod?.video_courses
            lessonMap.set(l.id, {
              title: l.title || 'Aula sem titulo',
              module_name: mod?.name || '',
              course_id: course?.id || '',
              course_title: course?.title || 'Curso',
            })
          }
        }

        const enriched: NoteWithContext[] = notesData
          .filter(n => n.content && n.content.trim() !== '' && n.content !== '<p></p>')
          .map(n => {
            const info = lessonMap.get(n.lesson_id)
            return {
              ...n,
              lesson_title: info?.title || 'Aula',
              course_id: info?.course_id || '',
              course_title: info?.course_title || 'Curso',
              module_name: info?.module_name || '',
            }
          })

        setNotes(enriched)
      } catch (err) {
        logger.warn('Error fetching notes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()
  }, [user?.id])

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(n =>
      n.lesson_title.toLowerCase().includes(q) ||
      n.course_title.toLowerCase().includes(q) ||
      n.module_name.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    )
  }, [notes, search])

  const groupedByCourse = useMemo(() => {
    const map = new Map<string, { course_title: string; course_id: string; notes: NoteWithContext[] }>()
    for (const note of filteredNotes) {
      const key = note.course_id || 'unknown'
      if (!map.has(key)) {
        map.set(key, { course_title: note.course_title, course_id: note.course_id, notes: [] })
      }
      map.get(key)!.notes.push(note)
    }
    return Array.from(map.values())
  }, [filteredNotes])

  function stripHtml(html: string): string {
    const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] })
    return sanitized
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Minhas Anotações</h1>
        <SectionLoader />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Minhas Anotações</h1>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nas anotações..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Empty state */}
        {notes.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <StickyNote className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma anotação ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Comece a fazer anotações durante suas aulas. Elas aparecerão aqui organizadas por curso.
            </p>
            <Link
              to="/meus-cursos"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              Ir para Meus Cursos
            </Link>
          </div>
        )}

        {/* No results */}
        {notes.length > 0 && filteredNotes.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma anotacao encontrada para "{search}"</p>
          </div>
        )}

        {/* Notes grouped by course */}
        {groupedByCourse.map((group) => (
          <div key={group.course_id} className="space-y-3">
            {/* Course header */}
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{group.course_title}</h2>
              <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {group.notes.length} {group.notes.length === 1 ? 'nota' : 'notas'}
              </span>
            </div>

            {/* Note cards */}
            <div className="space-y-2">
              {group.notes.map((note, noteIndex) => (
                <Link
                  key={note.id}
                  to={`/courses/${note.course_id}/lessons/${note.lesson_id}`}
                  className={cn(
                    "block p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all group",
                    noteIndex % 2 === 1 && "bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Play className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {note.lesson_title}
                        </span>
                      </div>
                      {note.module_name && (
                        <p className="text-[11px] text-muted-foreground mb-2 pl-5">
                          {note.module_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 pl-5">
                        {stripHtml(note.content).slice(0, 200)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Calendar className="h-3 w-3" />
                        {formatDate(note.updated_at)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Stats footer */}
        {notes.length > 0 && (
          <div className="text-center pt-4 pb-2">
            <p className="text-xs text-muted-foreground/50">
              {notes.length} {notes.length === 1 ? 'anotação' : 'anotações'} no total
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
