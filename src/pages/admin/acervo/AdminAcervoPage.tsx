import { useEffect, useState, useRef } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MoreHorizontal,
  PlusCircle,
  Pencil,
  Trash2,
  Upload,
  BookOpen,
  FileText,
  Search,
  Library,
  Download,
  List,
  BarChart3,
} from 'lucide-react'
import { PageTabs } from '@/components/PageTabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { acervoService, type AcervoItem, type AcervoCreateInput } from '@/services/acervoService'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'

const CONCURSOS = ['EAOF', 'EAOP', 'CAMAR', 'CADAR', 'CAFAR', 'CFOE']

function sanitizePath(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const CATEGORIES = [
  { value: 'livro', label: 'Livro' },
  { value: 'prova', label: 'Prova' },
  { value: 'apostila', label: 'Apostila' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'regulamento', label: 'Regulamento' },
  { value: 'mapa_mental', label: 'Mapa Mental' },
] as const

type CategoryValue = typeof CATEGORIES[number]['value']

type EditFormData = {
  title: string
  category: CategoryValue
  concurso: string
  subcategory: string
  year: string
}

export default function AdminAcervoPage() {
  usePageTitle('Acervo Digital')
  const [activeTab, setActiveTab] = useState('items')
  const [items, setItems] = useState<AcervoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterConcurso, setFilterConcurso] = useState<string>('all')
  const { toast } = useToast()

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [uploadForm, setUploadForm] = useState<EditFormData>({
    title: '',
    category: 'prova',
    concurso: '',
    subcategory: '',
    year: new Date().getFullYear().toString(),
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<AcervoItem | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({
    title: '',
    category: 'prova',
    concurso: '',
    subcategory: '',
    year: '',
  })
  const [saving, setSaving] = useState(false)

  const loadItems = async () => {
    try {
      setLoading(true)
      const data = await acervoService.getAll()
      setItems(data)
    } catch (error) {
      logger.error('Erro ao carregar acervo:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar o acervo.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const filtered = items.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    if (filterConcurso !== 'all' && item.concurso !== filterConcurso) return false
    if (search) {
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q)
        || item.concurso?.toLowerCase().includes(q)
        || item.subcategory?.toLowerCase().includes(q)
    }
    return true
  })

  const handleDelete = async (item: AcervoItem) => {
    if (!confirm(`Tem certeza que deseja deletar "${item.title}"?\nO arquivo também será removido do storage.`)) {
      return
    }

    try {
      await acervoService.remove(item.id)
      toast({ title: 'Item deletado', description: `"${item.title}" foi removido.` })
      loadItems()
    } catch (error) {
      logger.error('Erro ao deletar:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o item.',
        variant: 'destructive',
      })
    }
  }

  const openEdit = (item: AcervoItem) => {
    setEditItem(item)
    setEditForm({
      title: item.title,
      category: item.category,
      concurso: item.concurso || '',
      subcategory: item.subcategory || '',
      year: item.year?.toString() || '',
    })
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    setSaving(true)

    try {
      await acervoService.update(editItem.id, {
        title: editForm.title,
        category: editForm.category,
        concurso: editForm.concurso || null,
        subcategory: editForm.subcategory || null,
        year: editForm.year ? parseInt(editForm.year) : null,
      })
      toast({ title: 'Item atualizado', description: `"${editForm.title}" foi salvo.` })
      setEditOpen(false)
      loadItems()
    } catch (error) {
      logger.error('Erro ao salvar:', error)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) return
    setUploading(true)

    let successCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i]
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
        const prefixMap: Record<string, string> = {
          livro: 'livros',
          prova: `provas/${sanitizePath(uploadForm.concurso || 'geral')}/${uploadForm.year}`,
          apostila: 'apostilas',
          exercicio: 'exercicios',
          regulamento: 'regulamentos',
          mapa_mental: 'mapas-mentais',
        }
        const prefix = prefixMap[uploadForm.category] || uploadForm.category
        const storagePath = `${prefix}/${sanitizePath(file.name)}`

        try {
          const { path, size } = await acervoService.uploadFile(file, storagePath)

          const title = uploadFiles.length === 1 && uploadForm.title
            ? uploadForm.title
            : file.name.replace(/\.(pdf|jpg|jpeg|png)$/i, '').trim()

          const newItem: AcervoCreateInput = {
            title,
            category: uploadForm.category,
            concurso: uploadForm.category === 'prova' ? (uploadForm.concurso || null) : null,
            subcategory: uploadForm.subcategory || null,
            year: uploadForm.year ? parseInt(uploadForm.year) : null,
            file_path: path,
            file_size: size,
            file_type: ext === 'jpg' || ext === 'jpeg' || ext === 'png' ? ext : 'pdf',
          }

          await acervoService.create(newItem)
          successCount++
        } catch (err) {
          logger.error(`Erro ao fazer upload de ${file.name}:`, err)
          errorCount++
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Upload concluído',
          description: `${successCount} arquivo(s) enviado(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ''}.`,
        })
      }
      if (errorCount > 0 && successCount === 0) {
        toast({
          title: 'Erro no upload',
          description: 'Nenhum arquivo foi enviado.',
          variant: 'destructive',
        })
      }

      setUploadOpen(false)
      setUploadFiles(null)
      setUploadForm({ title: '', category: 'prova', concurso: '', subcategory: '', year: new Date().getFullYear().toString() })
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadItems()
    } finally {
      setUploading(false)
    }
  }

  const livrosCount = items.filter(i => i.category === 'livro').length
  const provasCount = items.filter(i => i.category === 'prova').length
  const concursosCount = new Set(items.filter(i => i.concurso).map(i => i.concurso)).size

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Acervo Digital</h1>
        <p className="text-muted-foreground mt-1">Gerencie livros, provas e documentos do acervo</p>
      </div>

      <div className="max-w-7xl mx-auto">
        <PageTabs
          value={activeTab}
          onChange={setActiveTab}
          layout="full"
          tabs={[
            {
              value: 'items',
              label: 'Todos os Itens',
              icon: <List className="h-4 w-4" />,
              count: filtered.length,
              content: (
                <div className="space-y-6 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <Library className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Gerenciar Acervo</h2>
                        <p className="text-muted-foreground text-lg">Upload, edição e organização de arquivos</p>
                      </div>
                    </div>
                    <Button onClick={() => setUploadOpen(true)} className="px-6 py-3 rounded-xl font-semibold">
                      <Upload className="mr-2 h-4 w-4" />
                      Novo Upload
                    </Button>
                  </div>

                  <Card className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        {/* Search & Filters */}
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar por título, concurso..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas</SelectItem>
                              {CATEGORIES.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={filterConcurso} onValueChange={setFilterConcurso}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Concurso" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {CONCURSOS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Results count */}
                        <div className="text-sm text-muted-foreground">
                          {filtered.length} {filtered.length === 1 ? 'item' : 'itens'} encontrado(s)
                        </div>

                        {/* Table */}
                        <div className="rounded-xl border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Título</TableHead>
                                <TableHead className="font-semibold">Categoria</TableHead>
                                <TableHead className="font-semibold">Concurso</TableHead>
                                <TableHead className="font-semibold">Ano</TableHead>
                                <TableHead className="font-semibold">Tamanho</TableHead>
                                <TableHead className="text-right font-semibold">
                                  <span className="sr-only">Ações</span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Nenhum item encontrado.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                filtered.map(item => (
                                  <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                          {item.category === 'livro' ? <BookOpen className="h-4 w-4 text-green-600" />
                                            : item.category === 'regulamento' ? <FileText className="h-4 w-4 text-red-600" />
                                            : <FileText className="h-4 w-4 text-blue-600" />
                                          }
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold text-foreground truncate max-w-[300px]">{item.title}</div>
                                          {item.subcategory && (
                                            <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "font-semibold",
                                          item.category === 'livro' && "border-green-300 dark:border-green-800 text-green-600 bg-green-100 dark:bg-green-950/50",
                                          item.category === 'prova' && "border-blue-300 dark:border-blue-800 text-blue-600 bg-blue-100 dark:bg-blue-950/50",
                                          item.category === 'apostila' && "border-amber-300 dark:border-amber-800 text-amber-600 bg-amber-100 dark:bg-amber-950/50",
                                          item.category === 'exercicio' && "border-purple-300 dark:border-purple-800 text-purple-600 bg-purple-100 dark:bg-purple-950/50",
                                          item.category === 'regulamento' && "border-red-300 dark:border-red-800 text-red-600 bg-red-100 dark:bg-red-950/50",
                                          item.category === 'mapa_mental' && "border-teal-300 dark:border-teal-800 text-teal-600 bg-teal-100 dark:bg-teal-950/50",
                                        )}
                                      >
                                        {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {item.concurso || '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {item.year || '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {formatFileSize(item.file_size)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="icon" variant="ghost" className="hover:bg-muted">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Menu</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openEdit(item)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Editar
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => window.open(acervoService.getPublicUrl(item.file_path), '_blank')}
                                          >
                                            <Download className="mr-2 h-4 w-4" />
                                            Visualizar
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => handleDelete(item)}
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Deletar
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              value: 'stats',
              label: 'Estatísticas',
              icon: <BarChart3 className="h-4 w-4" />,
              content: (
                <div className="mt-4">
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                          <Library className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-blue-600">{items.length}</div>
                          <div className="text-sm text-muted-foreground">Total de Itens</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                          <BookOpen className="h-6 w-6 text-green-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-green-600">{livrosCount}</div>
                          <div className="text-sm text-muted-foreground">Livros</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                          <FileText className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-purple-600">{provasCount}</div>
                          <div className="text-sm text-muted-foreground">Provas</div>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-orange-100 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-800">
                          <Download className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-orange-600">{concursosCount}</div>
                          <div className="text-sm text-muted-foreground">Concursos</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>Altere os dados do item do acervo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={editForm.category}
                onValueChange={(v: CategoryValue) => setEditForm(f => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.category === 'prova' && (
              <>
                <div className="space-y-2">
                  <Label>Concurso</Label>
                  <Select
                    value={editForm.concurso}
                    onValueChange={v => setEditForm(f => ({ ...f, concurso: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CONCURSOS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subcategory">Subcategoria</Label>
                  <Input
                    id="edit-subcategory"
                    value={editForm.subcategory}
                    onChange={e => setEditForm(f => ({ ...f, subcategory: e.target.value }))}
                    placeholder="Ex: Banca FGR - Atual (2022+)"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-year">Ano</Label>
              <Input
                id="edit-year"
                type="number"
                value={editForm.year}
                onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                placeholder="Ex: 2025"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.title}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload de Arquivos</DialogTitle>
            <DialogDescription>Envie novos arquivos para o acervo digital.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Arquivo(s)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={e => setUploadFiles(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">PDF, JPG ou PNG. Máx. 100MB por arquivo.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-title">Título (opcional para múltiplos arquivos)</Label>
              <Input
                id="upload-title"
                value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Se vazio, usa o nome do arquivo"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={uploadForm.category}
                onValueChange={(v: CategoryValue) => setUploadForm(f => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uploadForm.category === 'prova' && (
              <>
                <div className="space-y-2">
                  <Label>Concurso</Label>
                  <Select
                    value={uploadForm.concurso}
                    onValueChange={v => setUploadForm(f => ({ ...f, concurso: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CONCURSOS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-subcategory">Subcategoria</Label>
                  <Input
                    id="upload-subcategory"
                    value={uploadForm.subcategory}
                    onChange={e => setUploadForm(f => ({ ...f, subcategory: e.target.value }))}
                    placeholder="Ex: Banca FGR - Atual (2022+)"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="upload-year">Ano</Label>
              <Input
                id="upload-year"
                type="number"
                value={uploadForm.year}
                onChange={e => setUploadForm(f => ({ ...f, year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFiles?.length}>
              {uploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
