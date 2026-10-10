import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ScanSearch, Search, Sparkles } from 'lucide-react'
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
import { useProductFlow } from '../context/productFlow'
import { useAppConfig } from '../context/appConfig'
import { useSearchHistory } from '../hooks/useSearchHistory'
import {
  ACCEPTED_EXTENSIONS,
  ImageValidationError,
  createThumbnailDataUrl,
  validateImageFile,
} from '../lib/image'
import { cx } from '../lib/format'
import type { VisualMatch } from '../types/product'

const DEMO_IMAGE_URL = '/demo/sample-product.jpg'
const EXAMPLE_QUERIES = [
  'iPhone 17',
  'Nike Air Max shoes',
  'black headphones',
  'Samsung Galaxy S25',
]

function SearchDiscoverySection() {
  const flow = useProductFlow()
  const { config } = useAppConfig()
  const navigate = useNavigate()
  const { history, addEntry, removeEntry, clearHistory } = useSearchHistory()

  const [activeTab, setActiveTab] = useState<'all' | 'text' | 'image'>('all')
  const [textInput, setTextInput] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [lensMatches, setLensMatches] = useState<VisualMatch[]>([])
  const replaceInputRef = useRef<HTMLInputElement>(null)

  /** Called by VisualMatches when Google Lens results are returned (or on error with []). */
  const handleLensMatches = useCallback(
    (matches: VisualMatch[]) => {
      setLensMatches(matches)
      if (matches.length > 0 && matches[0].title) {
        if (!flow.imageQuery?.trim()) {
          flow.setImageQuery(matches[0].title)
        }
      }
    },
    [flow],
  )

  /** Called by VisualMatches when the user clicks "Use as query" on a card. */
  const handleSuggestQuery = useCallback(
    (query: string) => {
      flow.setImageQuery(query)
    },
    [flow],
  )

  const handleTabChange = (tab: 'all' | 'text' | 'image') => {
    setActiveTab(tab)
    if (tab === 'text' || tab === 'image') {
      flow.setMode(tab)
    }
  }

  // --- TEXT SEARCH FLOW ---
  const handleTextSearchSubmit = async (queryToSearch?: string) => {
    const target = (queryToSearch ?? textInput).trim()
    if (!target) return

    flow.setMode('text')
    const response = await flow.runTextSearch(target)
    if (!response) return

    addEntry({
      productName: target,
      query: response.query,
      lowestPrice: response.summary.lowest_price,
      lowestPriceFormatted: response.summary.lowest_price_formatted ?? null,
      sellerCount: response.summary.seller_count,
      productCount: response.summary.count,
      thumbnail: null,
      isDemo: response.is_demo,
    })

    navigate('/results')
  }

  // --- IMAGE SEARCH FLOW ---
  const handleImageSelect = async (file: File) => {
    flow.selectImage(file)
    flow.setMode('image')
    try {
      const analysis = await flow.analyzeImage()
      const queryName =
        analysis?.search_query?.trim() ||
        (analysis?.product_name && analysis.product_name !== 'Product not confidently identified'
          ? analysis.product_name.trim()
          : '')
      if (queryName) {
        flow.setImageQuery(queryName)
      }
    } catch {
      // OWL-ViT error is handled gracefully; VisualMatches will still supply Lens queries
    }
  }

  const handleTryDemo = async () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const response = await fetch(DEMO_IMAGE_URL)
      if (!response.ok) throw new Error('demo image unavailable')
      const blob = await response.blob()
      const file = new File([blob], 'shoplens-demo-sneaker.jpg', { type: 'image/jpeg' })
      await handleImageSelect(file)
    } catch {
      setDemoError('The demo image could not be loaded. Please choose your own photo instead.')
    } finally {
      setDemoLoading(false)
    }
  }

  const handleIdentify = async () => {
    if (!flow.imageFile) return
    flow.setMode('image')
    const analysis = await flow.analyzeImage()
    const queryName =
      analysis?.search_query?.trim() ||
      (analysis?.product_name && analysis.product_name !== 'Product not confidently identified'
        ? analysis.product_name.trim()
        : '')
    if (queryName) {
      flow.setImageQuery(queryName)
    }
  }

  const handleImageSearch = async (overrideQuery?: string | unknown) => {
    const rawOverride = typeof overrideQuery === 'string' ? overrideQuery.trim() : ''
    const candidateQuery = (
      (rawOverride || null) ??
      (flow.imageQuery?.trim() || null) ??
      (flow.analysis?.product_name && flow.analysis.product_name !== 'Product not confidently identified'
        ? flow.analysis.product_name.trim()
        : null) ??
      (flow.analysis?.search_query?.trim() && flow.analysis.search_query !== 'visually similar products'
        ? flow.analysis.search_query.trim()
        : null) ??
      (lensMatches.length > 0 && lensMatches[0].title ? lensMatches[0].title.trim() : null) ??
      (flow.searchQuery?.trim() && flow.searchQuery !== 'visually similar products'
        ? flow.searchQuery.trim()
        : null) ??
      (flow.imageFile ? flow.imageFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() : '')
    )

    const query = candidateQuery || 'product'
    flow.setImageQuery(query)
    flow.setMode('image')
    const response = await flow.runImageSearch(query)
    if (!response) return

    let thumbnail: string | null = null
    if (flow.imageFile) thumbnail = await createThumbnailDataUrl(flow.imageFile, 128)
    addEntry({
      productName: flow.analysis?.product_name ?? (query || 'Visual Search'),
      query: response.query,
      lowestPrice: response.summary.lowest_price,
      lowestPriceFormatted: response.summary.lowest_price_formatted ?? null,
      sellerCount: response.summary.seller_count,
      productCount: response.summary.count,
      thumbnail,
      isDemo: response.is_demo,
    })

    navigate('/results')
  }

  const rerunHistory = (query: string) => {
    flow.setMode('text')
    void flow.runTextSearch(query).then((response) => {
      if (response) navigate('/results')
    })
  }

  const noProductDetected = flow.analyzeError?.toLowerCase().includes('identify') ?? false

  const showText = activeTab === 'all' || activeTab === 'text'
  const showImage = activeTab === 'all' || activeTab === 'image'

  return (
    <section id="upload" className="scroll-mt-20 pb-20 sm:pb-24" aria-labelledby="discovery-heading">
      <div id="search-section" className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label">Discovery Options</p>
          <h2 id="discovery-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl text-ink-900">
            Find & Compare Any Product
          </h2>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            Choose how you want to discover products. Enter a product name directly or upload a
            photo to find visual matches and live merchant deals.
          </p>

          {/* View filter / tab switcher */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-2xl bg-ink-100 p-1.5 shadow-inner">
              <button
                type="button"
                id="search-all-tab"
                onClick={() => handleTabChange('all')}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
                  activeTab === 'all'
                    ? 'bg-white text-ink-900 shadow-[var(--shadow-soft)]'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                All Options
              </button>
              <button
                type="button"
                id="search-text-tab"
                onClick={() => handleTabChange('text')}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
                  activeTab === 'text'
                    ? 'bg-white text-ink-900 shadow-[var(--shadow-soft)]'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                <Search className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Search by Text
              </button>
              <button
                type="button"
                id="search-image-tab"
                onClick={() => handleTabChange('image')}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
                  activeTab === 'image'
                    ? 'bg-white text-ink-900 shadow-[var(--shadow-soft)]'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                <Camera className="h-4 w-4 text-purple-600" aria-hidden="true" />
                Search by Image
              </button>
            </div>
          </div>
        </div>

        {/* Dual Option Layout with Equal Visibility */}
        <div className={cx('mx-auto mt-10 max-w-6xl', activeTab === 'all' ? 'grid gap-8 lg:grid-cols-2' : '')}>
          {/* --- OPTION 1: SEARCH BY TEXT --- */}
          {showText && (
            <div id="search-text" className="animate-[var(--animate-fade-up)] flex flex-col">
              <div className="card flex-1 p-6 sm:p-8 shadow-[var(--shadow-soft)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
                        <Search className="h-3.5 w-3.5" /> Option 1: Search by Text
                      </span>
                      <h3 className="mt-3 text-xl font-bold text-ink-900">Search by Product Name</h3>
                      <p className="text-ink-500 mt-1 text-sm">
                        Enter any product name to fetch live prices and compare merchants via SerpApi Google Shopping.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleTextSearchSubmit()
                    }}
                    className="mt-6 flex flex-col gap-3"
                  >
                    <div className="relative min-w-0 flex-1">
                      <Search className="text-ink-400 pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2" />
                      <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="e.g. iPhone 17, Nike Air Max shoes, black headphones..."
                        className="field !pl-11 !py-3 !text-base w-full"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!textInput.trim() || flow.isSearching}
                      className="btn-primary btn-lg w-full shrink-0 justify-center"
                    >
                      <Search className="h-4 w-4" aria-hidden="true" />
                      {flow.isSearching && flow.mode === 'text' ? 'Searching…' : 'Search Deals'}
                    </button>
                  </form>
                </div>

                {/* Example Query Pills */}
                <div className="mt-6 border-t border-ink-100 pt-5">
                  <p className="text-ink-400 text-xs font-medium uppercase tracking-wider">
                    Popular Searches
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {EXAMPLE_QUERIES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => {
                          setTextInput(example)
                          handleTextSearchSubmit(example)
                        }}
                        className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-white hover:text-brand-600 transition cursor-pointer"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- OPTION 2: SEARCH BY IMAGE --- */}
          {showImage && (
            <div id="search-image" className="animate-[var(--animate-fade-up)] flex flex-col">
              <div className="card flex-1 p-6 sm:p-8 shadow-[var(--shadow-soft)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-semibold text-purple-700">
                        <Camera className="h-3.5 w-3.5" /> Option 2: Search by Image
                      </span>
                      <h3 className="mt-3 text-xl font-bold text-ink-900">Upload a Product Photo (Google Lens)</h3>
                      <p className="text-ink-500 mt-1 text-sm">
                        Upload or capture a product photo to find visually similar items and real-time prices.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
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
                        onSelect={handleImageSelect}
                        onTryDemo={handleTryDemo}
                        disabled={demoLoading}
                        maxSizeMb={config.max_upload_mb}
                        supportedTypes={config.supported_image_types}
                        error={demoError}
                      />
                    )}

                    {flow.isSearching && flow.mode === 'image' && (
                      <div className="mt-4">
                        <LoadingState
                          title="Searching deals with Google Lens…"
                          subtitle="Querying live merchant listings via SerpApi and calculating best prices."
                          stages={[
                            { label: 'Photo uploaded & processed', done: true },
                            { label: 'Google Lens visual search', done: true },
                            { label: 'Retrieving merchant pricing via SerpApi', done: false, active: true },
                            { label: 'Comparing store deals & discounts', done: false },
                          ]}
                        />
                      </div>
                    )}

                    {!flow.isSearching && flow.searchStatus === 'error' && flow.searchError && flow.mode === 'image' && (
                      <div className="mt-4">
                        <ErrorState
                          title="Search could not be completed"
                          message={flow.searchError}
                          onRetry={() => handleImageSearch()}
                          retryLabel="Retry search"
                        />
                      </div>
                    )}

                    {flow.imageFile && !flow.analysis && !flow.isAnalyzing && !flow.isSearching && (
                      <div className="mt-4 card p-5 bg-gradient-to-br from-brand-50/50 to-accent-50/30 border border-brand-200/60 shadow-[var(--shadow-soft)]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="label flex items-center gap-1.5 text-brand-700">
                            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                            Ready to Search
                          </p>
                          <span className="text-[11px] font-semibold text-ink-500 bg-white/80 px-2 py-0.5 rounded-full border border-ink-200/60">
                            Google Lens Ready
                          </span>
                        </div>
                        <p className="text-xs text-ink-600 mt-1">
                          Search directly for matching products or adjust the query below:
                        </p>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={flow.imageQuery || (lensMatches.length > 0 ? lensMatches[0].title : '')}
                            onChange={(e) => flow.setImageQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleImageSearch()
                            }}
                            placeholder="Enter product title or keywords..."
                            className="field !py-2 !text-sm flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageSearch()}
                            disabled={flow.isSearching}
                            className="btn-primary !px-4 text-xs font-semibold"
                          >
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                            Search Products
                          </button>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={handleIdentify}
                            className="btn-ghost !px-2 !py-1 text-xs text-brand-700 hover:text-brand-800"
                            disabled={flow.isAnalyzing}
                          >
                            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                            Re-analyze with OWL-ViT AI
                          </button>
                        </div>
                      </div>
                    )}

                    {flow.isAnalyzing && (
                      <div className="mt-4">
                        <LoadingState
                          title="Analyzing your image…"
                          subtitle="OWL-ViT model is detecting visual attributes and creating a search query."
                          stages={[
                            { label: 'Image uploaded', done: true },
                            { label: 'Identifying product attributes', done: false, active: true },
                            { label: 'Searching Google Lens', done: false },
                            { label: 'Comparing prices', done: false },
                          ]}
                        />
                      </div>
                    )}

                    {!flow.isAnalyzing && flow.analyzeStatus === 'error' && (
                      <div className="mt-4 space-y-4">
                        <ErrorState
                          title={noProductDetected ? 'No product detected' : 'Recognition note'}
                          message={flow.analyzeError ?? 'We could not confidently identify this product.'}
                          suggestions={[
                            'Use a clearer, well-lit photo',
                            'Or continue below by searching Google Lens directly',
                          ]}
                          onRetry={handleIdentify}
                          retryLabel="Retry recognition"
                          secondaryAction={
                            <button
                              type="button"
                              onClick={() => handleImageSearch()}
                              className="btn-primary"
                            >
                              Search Google Lens Directly
                            </button>
                          }
                        />

                        <div className="card p-4 bg-ink-50/60">
                          <p className="label">Manual query search</p>
                          <p className="text-ink-500 mt-1 text-xs">
                            Your photo stays selected. Enter a product name or search with Google Lens:
                          </p>
                          <div className="mt-3 flex gap-2">
                            <input
                              id="manual-search-query"
                              value={flow.imageQuery}
                              onChange={(e) => flow.setImageQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleImageSearch()
                              }}
                              placeholder="e.g. black running shoes"
                              className="field !py-2 !text-sm flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleImageSearch()}
                              disabled={flow.isSearching}
                              className="btn-primary !px-4 text-xs"
                            >
                              Search
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!flow.isAnalyzing && flow.analysis && (
                      <div className="mt-4">
                        <ProductIdentification
                          analysis={flow.analysis}
                          query={flow.imageQuery}
                          onQueryChange={flow.setImageQuery}
                          onSearch={handleImageSearch}
                          searching={flow.isSearching}
                          lensMatchCount={lensMatches.length}
                          suggestedQueries={
                            lensMatches.length > 0
                              ? lensMatches
                                  .map((m) => m.title)
                                  .filter(Boolean)
                                  .slice(0, 5)
                              : undefined
                          }
                        />
                      </div>
                    )}

                    {flow.imageFile && (
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/80 p-3 text-xs text-purple-900 shadow-xs">
                        <div className="flex items-center gap-2">
                          <ScanSearch className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="font-semibold">
                            {lensMatches.length > 0
                              ? `${lensMatches.length} Google Lens visual matches found`
                              : 'Google Lens is scanning your photo…'}
                          </span>
                        </div>
                        {lensMatches.length > 0 && (
                          <a
                            href="#google-lens-matches"
                            onClick={(e) => {
                              e.preventDefault()
                              document.getElementById('google-lens-matches')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="text-purple-700 hover:text-purple-950 font-bold underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                          >
                            View visual cards ↓
                          </a>
                        )}
                      </div>
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
                          void handleImageSelect(file)
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
                </div>

                {!flow.imageFile && (
                  <div className="mt-6 border-t border-ink-100 pt-5">
                    <p className="text-ink-500 flex items-center gap-2 text-xs">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      Google Lens visual match & CLIP similarity ranking included.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Full-width Google Lens Visual Matches Section */}
        {flow.imageFile && (
          <div className="mt-12 mx-auto max-w-6xl animate-[var(--animate-fade-up)]">
            <VisualMatches
              imageFile={flow.imageFile}
              onMatchesLoaded={handleLensMatches}
              onSuggestQuery={handleSuggestQuery}
              onSearchMatch={(query) => handleImageSearch(query)}
            />
          </div>
        )}

        <RecentSearches
          history={history}
          onRerun={(entry) => rerunHistory(entry.query)}
          onRemove={removeEntry}
          onClear={clearHistory}
          className="mx-auto mt-12 max-w-6xl"
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
      <SearchDiscoverySection />
      <Features />
      <TechSection />
      <HackathonValue />
      <FinalCTA />
    </>
  )
}
