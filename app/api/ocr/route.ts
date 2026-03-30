import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildOcrPrompt, parseOcrResponse } from '@/lib/ocr-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image, type = 'ekstre' } = body as { image: string; type?: 'ekstre' | 'fis' }

    if (!image) {
      return NextResponse.json({ success: false, error: 'Görsel gerekli' }, { status: 400 })
    }

    // Extract base64 data from data URL
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'Geçersiz görsel formatı' }, { status: 400 })
    }

    const base64Data = match[2]
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    let extractedText = ''
    let usedClaude = false

    // Step 1: Google Vision API for text extraction
    const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY
    if (GOOGLE_VISION_API_KEY) {
      try {
        const visionRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Data },
                // DOCUMENT_TEXT_DETECTION is better for receipts/documents
                features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
              }],
            }),
          }
        )
        const visionData = await visionRes.json()

        // Check for API-level error
        const visionError = visionData.responses?.[0]?.error
        if (visionError) {
          console.error('Google Vision API error:', JSON.stringify(visionError))
          // Fall through to Claude Vision fallback
        } else {
          extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
          console.log('Google Vision extracted text length:', extractedText.length)
        }
      } catch (visionErr: any) {
        console.error('Google Vision fetch error:', visionErr)
        // Fall through to Claude Vision fallback
      }
    }

    // Step 2: If no text extracted, use Claude Vision directly
    if (!extractedText) {
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
      if (!ANTHROPIC_API_KEY) {
        return NextResponse.json(
          { success: false, error: 'Görselde metin tespit edilemedi ve API anahtarı ayarlanmamış' },
          { status: 422 }
        )
      }

      console.log('Falling back to Claude Vision...')
      usedClaude = true
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
      const prompt = buildOcrPrompt(type)

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: prompt },
          ],
        }],
      })

      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return NextResponse.json({ success: false, error: 'API yanıt vermedi' }, { status: 422 })
      }

      try {
        const transactions = parseOcrResponse(textBlock.text)
        return NextResponse.json({ success: true, transactions, method: 'claude-vision' })
      } catch {
        return NextResponse.json(
          { success: false, error: 'Görselde işlenebilir metin bulunamadı', raw: textBlock.text },
          { status: 422 }
        )
      }
    }

    // Step 3: Claude parses the Google Vision extracted text into structured JSON
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY ayarlanmamış' }, { status: 500 })
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const prompt = buildOcrPrompt(type)

    const parseResponse = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Aşağıda bir ${type === 'fis' ? 'fiş/makbuz' : 'kredi kartı ekstresi'} görüntüsünden çıkarılan metin var. Bu metni analiz et ve işlemleri çıkar.\n\nÇıkarılan metin:\n---\n${extractedText}\n---\n\n${prompt}`,
      }],
    })

    const textBlock = parseResponse.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ success: false, error: 'Parse yanıtı alınamadı' }, { status: 422 })
    }

    try {
      const transactions = parseOcrResponse(textBlock.text)
      return NextResponse.json({ success: true, transactions, method: 'google-vision+claude' })
    } catch {
      return NextResponse.json(
        { success: false, error: 'Metin ayrıştırılamadı', raw: textBlock.text },
        { status: 422 }
      )
    }
  } catch (err: any) {
    console.error('OCR API error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Bilinmeyen hata' },
      { status: 500 }
    )
  }
}
