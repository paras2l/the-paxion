export type LibraryDocument = {
  id: string
  name: string
  content: string
  addedAt: string
  wordCount: number
  excerpt: string
  source: 'file' | 'paste'
}
