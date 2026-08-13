export interface VoiceCaptureInput {
  recording: boolean
  transcribing: boolean
  text: string
  error?: string
  postProcessed: boolean
}

export interface VoiceCaptureSnapshot {
  status: 'idle' | 'recording' | 'transcribing' | 'ready' | 'error'
  transcript: string
  postProcessed: boolean
  label: string
  error?: string
}

export function mapVoiceCaptureSnapshot(input: VoiceCaptureInput): VoiceCaptureSnapshot {
  if (input.error) {
    return {
      status: 'error',
      transcript: input.text,
      postProcessed: input.postProcessed,
      label: 'Erro no ditado local',
      error: input.error,
    }
  }
  if (input.recording) {
    return {
      status: 'recording',
      transcript: input.text,
      postProcessed: input.postProcessed,
      label: 'Gravando áudio',
    }
  }
  if (input.transcribing) {
    return {
      status: 'transcribing',
      transcript: input.text,
      postProcessed: input.postProcessed,
      label: 'Transcrevendo localmente',
    }
  }
  if (input.text.trim()) {
    return {
      status: 'ready',
      transcript: input.text,
      postProcessed: input.postProcessed,
      label: 'Transcrição local',
    }
  }
  return {
    status: 'idle',
    transcript: '',
    postProcessed: input.postProcessed,
    label: 'Ditado local',
  }
}
