'use client'
import { useState, useRef } from 'react'
import OcrReview from './OcrReview'
import type { ExtractedTransaction } from '@/lib/ocr-utils'

type Props = {
  cardId: number
  onComplete: () => void
}

function compressImage(dataUrl: string, maxWidth = 2048): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(dataUrl); return }
      const canvas = document.createElement('canvas')
      const ratio = maxWidth / img.width
      canvas.width = maxWidth
      canvas.height = img.height * ratio
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = dataUrl
  })
}

export default function OcrUpload({ cardId, onComplete }: Props) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedTransaction[] | null>(null)
  const [scanType, setScanType] = useState<'ekstre' | 'fis'>('ekstre')
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setScanning(true)

    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const compressed = await compressImage(dataUrl)

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed, type: scanType }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Tarama basarisiz')
        setScanning(false)
        return
      }

      if (!data.transactions || data.transactions.length === 0) {
        setError('Goruntude islem bulunamadi')
        setScanning(false)
        return
      }

      setResults(data.transactions)
    } catch (err: any) {
      setError(err.message || 'Baglanti hatasi')
    }

    setScanning(false)
    // Reset file inputs
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

      <div className="flex items-center gap-1.5">
        {/* Type toggle */}
        <select value={scanType} onChange={e => setScanType(e.target.value as 'ekstre' | 'fis')}
          className="text-[10px] font-medium px-1.5 py-1.5 rounded-lg appearance-none cursor-pointer"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', width: 65 }}>
          <option value="ekstre">Ekstre</option>
          <option value="fis">Fis</option>
        </select>

        {/* Camera button */}
        <button onClick={() => cameraRef.current?.click()} disabled={scanning}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', opacity: scanning ? 0.5 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
          {scanning ? 'Taraniyor...' : 'Tara'}
        </button>

        {/* Gallery button */}
        <button onClick={() => fileRef.current?.click()} disabled={scanning}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', opacity: scanning ? 0.5 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          Galeri
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-[11px] font-medium px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(229,72,77,0.06)', color: '#e5484d' }}>
          {error}
        </div>
      )}

      {/* Review modal */}
      {results && (
        <OcrReview
          cardId={cardId}
          transactions={results}
          onClose={() => setResults(null)}
          onSaved={() => { setResults(null); onComplete() }}
        />
      )}
    </>
  )
}
