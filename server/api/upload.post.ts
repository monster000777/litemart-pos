import { promises as fs } from 'node:fs'
import path from 'node:path'
import { H3Error } from 'h3'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

export default defineEventHandler(async (event) => {
  try {
    const files = await readMultipartFormData(event)
    const imageFile = files?.find((item) => item.name === 'file')

    if (!imageFile?.data || !imageFile.type) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '请上传图片文件'
      })
    }

    const ext = MIME_EXT_MAP[imageFile.type]
    if (!ext) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '仅支持 jpg、png、webp、gif 格式'
      })
    }

    const buffer = Buffer.from(imageFile.data)
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '图片大小不能超过 5MB'
      })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const filename = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext}`
    const outputPath = path.join(uploadDir, filename)

    await fs.writeFile(outputPath, buffer)

    return {
      path: `/uploads/${filename}`
    }
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: '图片上传失败'
    })
  }
})
