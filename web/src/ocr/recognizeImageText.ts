import type { Worker } from 'tesseract.js'
import { isNativeIosClient, recognizeTextNative } from './recognizeImageTextNative'

interface OcrProgress {
  progress: number
  status: string
}

let workerPromise: Promise<Worker> | null = null
let progressListener: ((progress: OcrProgress) => void) | null = null

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker(['chi_sim', 'eng'], 1, {
          logger: (message) => {
            progressListener?.({
              progress:
                typeof message.progress === 'number' ? message.progress : 0,
              status: message.status || '正在准备 OCR',
            })
          },
        }),
      )
      .catch((error) => {
        workerPromise = null
        throw error
      })
  }
  return workerPromise
}

export async function recognizeImageText(
  image: File | string,
  onProgress?: (progress: OcrProgress) => void,
) {
  // Inside the native shell, recognise on-device instead: the tesseract path
  // below pulls its worker, wasm core and both language models from a CDN at
  // runtime, so it can never work offline under the capacitor:// scheme.
  if (isNativeIosClient()) {
    return recognizeTextNative(image)
  }

  progressListener = onProgress || null
  try {
    const worker = await getWorker()
    const result = await worker.recognize(image)
    return result.data.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim()
  } finally {
    progressListener = null
  }
}
