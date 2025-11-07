import axios from 'axios'

const BASE_URL = import.meta.env.VITE_FILEBUMP_URL || 'https://filebump.services.mobilon.ru'
const API_KEY = import.meta.env.VITE_FILEBUMP_API_KEY || ''

export interface FilebumpUploadResult {
  url: string
  fileId?: string | null
  originalName: string
  mimeType: string
  raw: any
}

function ensureConfigured() {
  if (!API_KEY) {
    console.warn('FILEBUMP_API_KEY is not set. Image uploads will fail until configured.')
  }
}

export async function uploadImageToFilebump(file: File): Promise<FilebumpUploadResult> {
  ensureConfigured()

  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await axios.post(`${BASE_URL}/upload`, formData, {
    headers: {
      'X-API-Key': API_KEY,
    },
  })

  const responseData = response.data?.data || response.data

  const fileId = responseData?.fileId || responseData?.id || responseData?.fileId || null
  const url =
    responseData?.downloadUrl ||
    responseData?.url ||
    responseData?.file?.downloadUrl ||
    responseData?.file?.url ||
    responseData?.data?.downloadUrl ||
    responseData?.data?.url

  if (!url) {
    throw new Error('Filebump upload succeeded but no download URL was returned')
  }

  return {
    url,
    fileId,
    originalName: file.name,
    mimeType: file.type,
    raw: response.data,
  }
}

