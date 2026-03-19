export type PluginCard = {
  id: string
  name: string
  category: 'automation' | 'content' | 'research' | 'media'
  enabled: boolean
  description: string
}

export const defaultPluginRegistry: PluginCard[] = [
  {
    id: 'plugin-whatsapp-workflows',
    name: 'WhatsApp Workflow Pack',
    category: 'automation',
    enabled: true,
    description: 'Message send/reply follow-up flows with approval checkpoints.',
  },
  {
    id: 'plugin-social-campaign',
    name: 'Social Campaign Builder',
    category: 'content',
    enabled: true,
    description: 'Generates and schedules social posts with tone variants.',
  },
  {
    id: 'plugin-research-mapper',
    name: 'Research Mapper',
    category: 'research',
    enabled: true,
    description: 'Web and document research with source-linked summaries.',
  },
  {
    id: 'plugin-media-lab',
    name: 'Media Lab',
    category: 'media',
    enabled: true,
    description: 'Image, audio, and video generation orchestration.',
  },
]
