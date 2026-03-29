import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildOcrPrompt, parseOcrResponse } from '@/lib/ocr-utils'

export const dynamic = 'force-dynamic'

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image, type = 'ekstre' } = body as { image: string; type?: 'ekstre' | 'fis' }

    if (!image) {
      return NextResponse.json({ success: false, error: 'Gorsel gerekli' }, { status: 400 })
    }

    // Extract base64 data from data URL
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'Gecersiz gorsel formati' }, { status: 400 })
    }

    const base64Data = match[2]
    let extractedText = ''

    // Step 1: Google Vision API for text extraction
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
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              }],
            }),
          }
        )
        const visionData = await visionRes.json()
        extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''

        if (!extractedText) {
          return NextResponse.json({ success: false, error: 'Goruntude metin bulunamadi' }, { status: 422 })
        }
      } catch (visionErr: any) {
        console.error('Google Vision error:', visionErr)
        return NextResponse.json({ success: false, error: 'Google Vision hatasi: ' + visionErr.message }, { status: 500 })
      }
    } else {
      // Fallback: Claude Vision directly if no Google Vision key
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ success: false, error: 'API anahtari ayarlanmamis' }, { status: 500 })
      }
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const prompt = buildOcrPrompt(type)
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: prompt },
        ]}],
      })
      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return NextResponse.json({ success: false, error: 'API yanit vermedi' }, { status: 422 })
      }
      try {
        const transactions = parseOcrResponse(textBlock.text)
        return NextResponse.json({ success: true, transactions })
      } catch {
        return NextResponse.json({ success: false, error: 'JSON parse hatasi', raw: textBlock.text }, { status: 422 })
      }
    }

    // Step 2: Claude parses the extracted text into structured JSON
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY ayarlanmamis' }, { status: 500 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = buildOcrPrompt(type)

    const parseResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Asagida bir ${type === 'fis' ? 'fis/makbuz' : 'kredi karti ekstresi'} goruntusunden cikarilan metin var. Bu metni analiz et ve islemleri cikar.\n\nCikarilan metin:\n---\n${extractedText}\n---\n\n${prompt}`,
      }],
    })

    const textBlock = parseResponse.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ success: false, error: 'Parse yaniti alinamadi' }, { status: 422 })
    }

    try {
      const transactions = parseOcrResponse(textBlock.text)
      return NextResponse.json({ success: true, transactions })
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON parse hatasi', raw: textBlock.text },
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
