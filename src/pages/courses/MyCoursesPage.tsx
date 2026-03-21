import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Play, Lock, Layers, ShoppingCart } from 'lucide-react'
import { cachedFetch } from '@/lib/offlineCache'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { SectionLoader } from '@/components/SectionLoader'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { courseService, CourseWithProgress } from '@/services/courseService'
import { getStorefrontCourses } from '@/services/adminCourseService'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

function formatBRL(cents: number, installmentsMax: number): string {
  const reais = cents / 100
  const formatted = reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (installmentsMax > 1) {
    const perInstallment = (reais / installmentsMax).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return `${installmentsMax}x de ${perInstallment}`
  }
  return formatted
}

interface ProductInfo {
  price_cents: number
  installments_max: number
  landing_page_slug: string
}

export default function MyCoursesPage() {
  const { user, isStudent } = useAuth()
  const navigate = useNavigate()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [storefrontCourses, setStorefrontCourses] = useState<any[]>([])
  const [courseProducts, setCourseProducts] = useState<Record<string, ProductInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        if (!user?.id) return
        const result = await cachedFetch(`my-courses-${user.id}`, () =>
          courseService.getUserCoursesWithDetails(user.id)
        )
        setCourses(result.data)
        setFromCache(result.fromCache)
      } catch (error) {
        logger.error('Error fetching courses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      getStorefrontCourses(user.id).then(async (sfCourses) => {
        setStorefrontCourses(sfCourses)
        // Fetch product info for storefront courses via their class associations
        try {
          // Get class_courses for these course IDs
          const courseIds = sfCourses.map((c: any) => c.id)
          if (courseIds.length === 0) return

          const { data: classCourses } = await supabase
            .from('class_courses')
            .select('course_id, class_id')
            .in('course_id', courseIds)

          if (!classCourses || classCourses.length === 0) return

          const classIds = [...new Set(classCourses.map(cc => cc.class_id))]

          const { data: productClasses } = await supabase
            .from('stripe_product_classes')
            .select('class_id, stripe_products(price_cents, installments_max, landing_page_slug)')
            .in('class_id', classIds)

          if (!productClasses) return

          // Build map: class_id -> product info
          const classToProduct: Record<string, ProductInfo> = {}
          for (const pc of productClasses) {
            const prod = pc.stripe_products
            if (prod && prod.landing_page_slug) {
              classToProduct[pc.class_id] = {
                price_cents: prod.price_cents,
                installments_max: prod.installments_max || 1,
                landing_page_slug: prod.landing_page_slug,
              }
            }
          }

          // Build map: course_id -> product info (first match)
          const courseToProduct: Record<string, ProductInfo> = {}
          for (const cc of classCourses) {
            if (!courseToProduct[cc.course_id] && classToProduct[cc.class_id]) {
              courseToProduct[cc.course_id] = classToProduct[cc.class_id]
            }
          }

          setCourseProducts(courseToProduct)
        } catch (err) {
          logger.error('Error fetching product info:', err)
        }
      }).catch(() => {})
    }
  }, [user?.id])

  if (permissionsLoading || isLoading) {
    return <SectionLoader />
  }

  if (isStudent && !hasFeature(FEATURE_KEYS.VIDEO_LESSONS)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de videoaulas bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O sistema de videoaulas não está disponível para sua turma. Entre em contato com seu professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seu progresso</p>
      </div>

      <OfflineBanner fromCache={fromCache} />

      {courses.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum curso encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Você ainda não tem acesso a nenhum curso. Entre em contato com seu professor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="border-border shadow-sm overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={course.image || '/placeholder.svg'}
                  alt={course.title}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
                {course.progress === 100 && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-emerald-500 text-white text-xs font-bold">
                    Concluído
                  </div>
                )}
              </div>

              <CardContent className="flex-1 p-4 flex flex-col">
                <h3 className="font-bold text-base leading-tight line-clamp-2 min-h-[2.5rem]">
                  {course.title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{course.modules_count} módulo{course.modules_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{course.lessons_count} aula{course.lessons_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border mt-auto">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className={cn(
                      course.progress === 100 ? 'text-emerald-600' : 'text-primary'
                    )}>
                      {Math.round(course.progress)}%
                    </span>
                  </div>
                  <Progress
                    value={course.progress}
                    className={cn(
                      'h-2',
                      course.progress === 100 ? '[&>div]:bg-emerald-500' : ''
                    )}
                  />
                </div>

                <Button asChild className="w-full mt-2" size="sm">
                  <Link to={`/courses/${course.id}`}>
                    <Play className="w-4 h-4 mr-2" />
                    {course.progress > 0 ? 'Continuar curso' : 'Iniciar curso'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {storefrontCourses.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Outros Cursos Disponíveis</h2>
            <p className="text-sm text-muted-foreground">Explore mais cursos da plataforma</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storefrontCourses.map(course => {
              const product = courseProducts[course.id]
              return (
                <Card
                  key={course.id}
                  className="hover:border-primary/50 transition-colors relative overflow-hidden flex flex-col"
                >
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={`Capa do curso ${course.name}`} className="w-full h-40 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-40 bg-muted flex items-center justify-center">
                      <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Bloqueado
                    </Badge>
                  </div>
                  <CardContent className="pt-4 space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{course.name}</h3>
                      {course.acronym && (
                        <Badge variant="outline" className="text-xs">{course.acronym}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.video_modules?.length || 0} módulos
                    </p>
                    {product ? (
                      <div className="mt-auto pt-2 space-y-2">
                        <p className="text-sm font-semibold text-foreground">
                          {formatBRL(product.price_cents, product.installments_max)}
                        </p>
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                          onClick={() => navigate(`/checkout/${product.landing_page_slug}`)}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Comprar
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-auto pt-2">
                        <Button
                          variant="outline"
                          className="w-full"
                          size="sm"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        >
                          Ver detalhes
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
