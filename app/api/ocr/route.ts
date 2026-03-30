import { NextResponse } from 'next/server'
import { buildOcrPrompt, parseOcrResponse } from '@/lib/ocr-utils'

export const dynamic = 'force-dynamic'

const GOOGLE_API_KEY = process.env.GOOGLE_VISION_API_KEY // same key for Vision + Gemini

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { image, type = 'ekstre' } = body as { image: string; type?: 'ekstre' | 'fis' }

    if (!image) {
      return NextResponse.json({ success: false, error: 'Görsel gerekli' }, { status: 400 })
    }

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ success: false, error: 'Google API anahtarı ayarlanmamış' }, { status: 500 })
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ success: false, error: 'Geçersiz görsel formatı' }, { status: 400 })
    }

    const base64Data = match[2]
    const mimeType = match[1]

    // ── STEP 1: Google Vision — metin çıkar ──────────────────────────────────
    let extractedText = ''
    try {
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Data },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            }],
          }),
        }
      )
      const visionData = await visionRes.json()
      const visionError = visionData.responses?.[0]?.error
      if (visionError) {
        console.error('Google Vision error:', JSON.stringify(visionError))
      } else {
        extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
      }
    } catch (e: any) {
      console.error('Google Vision fetch failed:', e.message)
    }

    // ── STEP 2: Gemini Flash — metni parse et (ücretsiz!) ────────────────────
    // Gemini aynı zamanda görseli direkt okuyabilir (Vision başarısız olursa)
    const label = type === 'fis' ? 'fiş/makbuz' : 'kredi kartı ekstresi'
    const prompt = extractedText
      ? `Aşağıda bir ${label} görüntüsünden çıkarılan metin var:\n---\n${extractedText}\n---\n\n${buildOcrPrompt(type)}`
      : `Bu görseli analiz et. Bu bir ${label}. ${buildOcrPrompt(type)}`

    const geminiBody = extractedText
      ? { contents: [{ parts: [{ text: prompt }] }] }
      : {
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Data } },
              { text: prompt },
            ],
          }],
        }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-latest:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    )

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      console.error('Gemini API error:', JSON.stringify(geminiData))
      return NextResponse.json(
        { success: false, error: 'Gemini API hatası: ' + (geminiData.error?.message || geminiRes.status) },
        { status: 500 }
      )
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!rawText) {
      return NextResponse.json({ success: false, error: 'Görselde işlenebilir veri bulunamadı' }, { status: 422 })
    }

    try {
      const transactions = parseOcrResponse(rawText)
      return NextResponse.json({ success: true, transactions, method: 'google-vision+gemini' })
    } catch {
      return NextResponse.json(
        { success: false, error: 'Metin ayrıştırılamadı', raw: rawText },
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
