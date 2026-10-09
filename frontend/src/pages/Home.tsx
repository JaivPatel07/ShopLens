import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Info, Sparkles } from 'lucide-react'
import { Hero } from '../components/Hero'
import { TrustStrip } from '../components/TrustStrip'
import { HowItWorks } from '../components/HowItWorks'
import { Features } from '../components/Features'
import { TechSection } from '../components/TechSection'
import { HackathonValue } from '../components/HackathonValue'
import { FinalCTA } from '../components/FinalCTA'
import { RecentSearches } from '../components/RecentSearches'
import { UploadBox } from '../components/UploadBox'
import { ImagePreview } from '../components/ImagePreview'
import { ProductIdentification } from '../components/ProductIdentification'
import { VisualMatches } from '../components/VisualMatches'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { DemoBadge } from '../components/DemoBadge'
import { useProductFlow } from '../context/productFlow'
import { useAppConfig } from '../context/appConfig'
import { useSearchHistory } from '../hooks/useSearchHistory'
import {
  ACCEPTED_EXTENSIONS,
  ImageValidationError,
  createThumbnailDataUrl,
  validateImageFile,
} from '../lib/image'

const DEMO_IMAGE_URL = '/demo/sample-product.jpg'

function UploadSection() {
  const flow = useProductFlow()
  const { config } = useAppConfig()
  const navigate = useNavigate()
  const { history, addEntry, removeEntry, clearHistory } = useSearchHistory()
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const handleTryDemo = async () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const response = await fetch(DEMO_IMAGE_URL)
      if (!response.ok) throw new Error('demo image unavailable')
      const blob = await response.blob()
      const file = new File([blob], 'snapbuy-demo-sneaker.jpg', { type: 'image/jpeg' })
      flow.selectImage(file)
    } catch {
      setDemoError('The demo image could not be loaded. Please choose your own photo instead.')
    } finally {
      setDemoLoading(false)
    }
  }

  const handleIdentify = async () => {
    if (!flow.imageFile) return
    const analysis = await flow.analyzeImage()
    if (analysis) flow.setQuery(analysis.search_query)
  }

  const handleSearch = async () => {
    const query = flow.searchQuery.trim()
    if (!query) return
    const response = await flow.runSearch(query)
    if (!response) return

    let thumbnail: string | null = null
    if (flow.imageFile) thumbnail = await createThumbnailDataUrl(flow.imageFile, 128)
    addEntry({
      productName: flow.analysis?.product_name ?? query,
      query: response.query,
      lowestPrice: response.summary.lowest_price,
      lowestPriceFormatted:
        response.summary.lowest_price_formatted ?? null,
      sellerCount: response.summary.seller_count,
      productCount: response.summary.count,
      thumbnail,
      isDemo: response.is_demo,
    })

    navigate('/results')
  }

  const rerunHistory = (query: string) => {
    flow.setQuery(query)
    void flow.runSearch(query).then((response) => {
      if (response) navigate('/results')
    })
  }

  const noProductDetected = flow.analyzeError?.toLowerCase().includes('identify') ?? false

  return (
    <section id="upload" className="scroll-mt-20 pb-20 sm:pb-24" aria-labelledby="upload-heading">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label">Try it now</p>
          <h2 id="upload-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Upload a product photo
          </h2>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            We&apos;ll identify the product, generate a search query and compare live prices through
            SerpApi. Nothing is stored on our servers — your image is only sent for recognition.
          </p>
          {config.demo_vision && (
            <p className="mt-4 inline-flex items-center gap-2">
              <DemoBadge label="Demo recognition" />
              <span className="text-ink-500 text-xs">
                No vision API key configured — sample recognition data will be used.
              </span>
            </p>
          )}
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {flow.imagePreview && flow.imageFile ? (
              <ImagePreview
                src={flow.imagePreview}
                fileName={flow.imageFile.name}
                fileSize={flow.imageFile.size}
                onRemove={flow.clearImage}
                onReplace={() => replaceInputRef.current?.click()}
                disabled={flow.isAnalyzing || flow.isSearching}
              />
            ) : (
              <UploadBox
                onSelect={flow.selectImage}
                onTryDemo={handleTryDemo}
                disabled={demoLoading}
                maxSizeMb={config.max_upload_mb}
                supportedTypes={config.supported_image_types}
                error={demoError}
              />
            )}

            {flow.imageFile && !flow.analysis && !flow.isAnalyzing && (
              <button
                type="button"
                onClick={handleIdentify}
                className="btn-primary btn-lg mt-4 w-full"
                disabled={flow.isAnalyzing}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Identify Product
              </button>
            )}

            {flow.imageFile && (
              <p className="text-ink-400 mt-3 flex items-start gap-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Recognition only — SnapBuy never uses your photo for anything else.
              </p>
            )}

            <input
              ref={replaceInputRef}
              type="file"
              className="sr-only"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  validateImageFile(file)
                  setDemoError(null)
                  flow.selectImage(file)
                } catch (error) {
                  setDemoError(
                    error instanceof ImageValidationError
                      ? error.message
                      : 'That image could not be used. Try another one.',
                  )
                }
              }}
            />
          </div>

          <div className="min-w-0 space-y-6">
            {flow.isAnalyzing && (
              <LoadingState
                title="Analyzing your image…"
                subtitle="The AI model is reading the photo and building a search query."
                stages={[
                  { label: 'Image uploaded', done: true },
                  { label: 'Identifying product', done: false, active: true },
                  { label: 'Finding matching products', done: false },
                  { label: 'Comparing prices', done: false },
                ]}
              />
            )}

            {!flow.isAnalyzing && flow.analyzeStatus === 'error' && (
              <>
                {noProductDetected ? (
                  <ErrorState
                    title="No product detected"
                    message="We couldn't confidently identify this product."
                    suggestions={[
                      'A clearer photo',
                      'A photo showing the full product',
                      'Better lighting, with the product filling the frame',
                    ]}
                    onRetry={handleIdentify}
                    retryLabel="Try again"
                    secondaryAction={
                      <button type="button" onClick={flow.clearImage} className="btn-secondary">
                        Try Another Image
                      </button>
                    }
                  />
                ) : (
                  <>
                    <ErrorState
                      title="Something went wrong while analysing"
                      message={flow.analyzeError ?? 'Please try again.'}
                      onRetry={handleIdentify}
                      retryLabel="Try again"
                    />
                    <div className="card p-5 sm:p-6">
                      <p className="label">Continue without image analysis</p>
                      <h3 className="mt-2 text-base font-semibold">Enter a product search yourself</h3>
                      <p className="text-ink-500 mt-1 text-sm">
                        Your photo stays selected. Add a product name or category and we&apos;ll search live offers.
                      </p>
                      <label htmlFor="manual-search-query" className="sr-only">
                        Product search query
                      </label>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input
                          id="manual-search-query"
                          value={flow.searchQuery}
                          onChange={(event) => flow.setQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch()
                          }}
                          placeholder="e.g. black running shoes"
                          className="field min-w-0 flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleSearch}
                          disabled={!flow.searchQuery.trim() || flow.isSearching}
                          className="btn-primary w-full sm:w-auto"
                        >
                          Search products
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {!flow.isAnalyzing && flow.analysis && (
              <ProductIdentification
                analysis={flow.analysis}
                query={flow.searchQuery}
                onQueryChange={flow.setQuery}
                onSearch={handleSearch}
                searching={flow.isSearching}
              />
            )}

            {flow.analysis && <VisualMatches imageFile={flow.imageFile} />}

            {!flow.isAnalyzing && !flow.analysis && flow.analyzeStatus !== 'error' && (
              <div className="card bg-ink-50/50 border-dashed p-6 sm:p-7">
                <p className="label flex items-center gap-2">
                  <Sparkles className="text-brand-500 h-3.5 w-3.5" aria-hidden="true" />
                  What happens next
                </p>
                <ol className="text-ink-600 mt-4 space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="bg-ink-900 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                      1
                    </span>
                    AI identifies the product and writes a search query.
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-ink-900 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                      2
                    </span>
                    You can edit that query before searching.
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-ink-900 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                      3
                    </span>
                    SerpApi returns live shopping results, and SnapBuy compares the prices.
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <RecentSearches
          history={history}
          onRerun={(entry) => rerunHistory(entry.query)}
          onRemove={removeEntry}
          onClear={clearHistory}
          className="mx-auto mt-8 max-w-6xl"
        />
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <UploadSection />
      <Features />
      <TechSection />
      <HackathonValue />
      <FinalCTA />
    </>
  )
}
