export type SupportedLanguageCode =
  | 'en-US'
  | 'hi-IN'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'ja-JP'

export type LanguagePipeline = {
  code: SupportedLanguageCode
  label: string
  sttLanguage: string
  responseLanguage: string
  ttsLanguage: string
  fallbackChain: string[]
}

export const LANGUAGE_PIPELINE_OPTIONS: LanguagePipeline[] = [
  {
    code: 'en-US',
    label: 'English (US)',
    sttLanguage: 'en-US',
    responseLanguage: 'English',
    ttsLanguage: 'en-US',
    fallbackChain: ['en-US', 'en-GB'],
  },
  {
    code: 'hi-IN',
    label: 'Hindi (India)',
    sttLanguage: 'hi-IN',
    responseLanguage: 'Hindi',
    ttsLanguage: 'hi-IN',
    fallbackChain: ['hi-IN', 'en-IN', 'en-US'],
  },
  {
    code: 'es-ES',
    label: 'Spanish (Spain)',
    sttLanguage: 'es-ES',
    responseLanguage: 'Spanish',
    ttsLanguage: 'es-ES',
    fallbackChain: ['es-ES', 'es-MX', 'en-US'],
  },
  {
    code: 'fr-FR',
    label: 'French (France)',
    sttLanguage: 'fr-FR',
    responseLanguage: 'French',
    ttsLanguage: 'fr-FR',
    fallbackChain: ['fr-FR', 'fr-CA', 'en-US'],
  },
  {
    code: 'de-DE',
    label: 'German (Germany)',
    sttLanguage: 'de-DE',
    responseLanguage: 'German',
    ttsLanguage: 'de-DE',
    fallbackChain: ['de-DE', 'de-AT', 'en-US'],
  },
  {
    code: 'ja-JP',
    label: 'Japanese (Japan)',
    sttLanguage: 'ja-JP',
    responseLanguage: 'Japanese',
    ttsLanguage: 'ja-JP',
    fallbackChain: ['ja-JP', 'en-US'],
  },
]

const DEFAULT_PIPELINE = LANGUAGE_PIPELINE_OPTIONS[0]

function normalizeLanguageTag(tag: string): string {
  return String(tag || '').trim().toLowerCase()
}

export function resolveLanguagePipeline(code: string): LanguagePipeline {
  const found = LANGUAGE_PIPELINE_OPTIONS.find((item) => item.code === code)
  return found ?? DEFAULT_PIPELINE
}

export function chooseTtsLanguage(
  preferredLanguage: string,
  fallbackChain: string[],
  availableVoiceLanguages: string[],
): { selectedLanguage: string; usedFallback: boolean } {
  const normalizedVoices = availableVoiceLanguages.map(normalizeLanguageTag)
  const chain = [preferredLanguage, ...fallbackChain]

  for (let index = 0; index < chain.length; index += 1) {
    const candidate = chain[index]
    const normalizedCandidate = normalizeLanguageTag(candidate)
    const hasVoice = normalizedVoices.some((voiceLanguage) => {
      if (voiceLanguage === normalizedCandidate) {
        return true
      }

      const candidatePrefix = normalizedCandidate.split('-')[0]
      return candidatePrefix.length > 0 && voiceLanguage.startsWith(candidatePrefix)
    })

    if (hasVoice) {
      return {
        selectedLanguage: candidate,
        usedFallback: index > 0,
      }
    }
  }

  return {
    selectedLanguage: preferredLanguage,
    usedFallback: false,
  }
}
