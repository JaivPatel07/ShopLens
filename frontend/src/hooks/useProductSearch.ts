import { useCallback, useMemo, useReducer, useRef } from 'react'
import { ApiError, api } from '../services/api'
import type { FlowStatus, SearchMode, SearchResponse, VisionAttributes } from '../types/product'
import { createPreviewUrl, revokePreviewUrl } from '../lib/image'

export interface ProductSearchState {
  mode: SearchMode
  // Text search query state
  textQuery: string
  // Image search state
  imageFile: File | null
  imagePreview: string | null
  imageQuery: string
  analysis: VisionAttributes | null
  analyzeStatus: FlowStatus
  analyzeError: string | null
  // Active search response state
  search: SearchResponse | null
  searchQuery: string
  searchedQuery: string | null
  searchMode: SearchMode
  searchStatus: FlowStatus
  searchError: string | null
}

type Action =
  | { type: 'mode/set'; mode: SearchMode }
  | { type: 'image/selected'; file: File; preview: string }
  | { type: 'image/cleared' }
  | { type: 'analyze/start'; query?: string }
  | { type: 'analyze/success'; analysis: VisionAttributes }
  | { type: 'analyze/error'; message: string }
  | { type: 'search/start'; query: string; mode: SearchMode }
  | { type: 'search/success'; response: SearchResponse; mode: SearchMode }
  | { type: 'search/error'; message: string }
  | { type: 'text/queryChanged'; query: string }
  | { type: 'image/queryChanged'; query: string }
  | { type: 'query/changed'; query: string }
  | { type: 'flow/reset' }

const initialState: ProductSearchState = {
  mode: 'text',
  textQuery: '',
  imageFile: null,
  imagePreview: null,
  imageQuery: '',
  analysis: null,
  search: null,
  searchQuery: '',
  searchedQuery: null,
  searchMode: 'text',
  analyzeStatus: 'idle',
  searchStatus: 'idle',
  analyzeError: null,
  searchError: null,
}

export function productSearchReducer(
  state: ProductSearchState,
  action: Action,
): ProductSearchState {
  switch (action.type) {
    case 'mode/set':
      return {
        ...state,
        mode: action.mode,
        searchQuery: action.mode === 'image' ? state.imageQuery : state.textQuery,
      }
    case 'image/selected':
      return {
        ...state,
        mode: 'image',
        imageFile: action.file,
        imagePreview: action.preview,
        imageQuery: '',
        analysis: null,
        analyzeStatus: 'idle',
        analyzeError: null,
        search: null,
        searchedQuery: null,
        searchQuery: '',
        searchStatus: 'idle',
        searchError: null,
      }
    case 'image/cleared':
      return {
        ...state,
        imageFile: null,
        imagePreview: null,
        imageQuery: '',
        analysis: null,
        analyzeStatus: 'idle',
        analyzeError: null,
        searchQuery: state.mode === 'image' ? '' : state.textQuery,
      }
    case 'analyze/start':
      return {
        ...state,
        mode: 'image',
        analyzeStatus: 'loading',
        analyzeError: null,
        search: null,
        searchStatus: 'idle',
        searchedQuery: null,
      }
    case 'analyze/success':
      return {
        ...state,
        analyzeStatus: 'success',
        analysis: action.analysis,
        imageQuery: action.analysis.search_query,
        searchQuery: state.mode === 'image' ? action.analysis.search_query : state.textQuery,
      }
    case 'analyze/error':
      return {
        ...state,
        analyzeStatus: 'error',
        analyzeError: action.message,
        analysis: null,
      }
    case 'text/queryChanged':
      return {
        ...state,
        textQuery: action.query,
        searchQuery: state.mode === 'text' ? action.query : state.searchQuery,
      }
    case 'image/queryChanged':
      return {
        ...state,
        imageQuery: action.query,
        searchQuery: state.mode === 'image' ? action.query : state.searchQuery,
      }
    case 'query/changed':
      if (state.mode === 'image') {
        return {
          ...state,
          imageQuery: action.query,
          searchQuery: action.query,
        }
      }
      return {
        ...state,
        textQuery: action.query,
        searchQuery: action.query,
      }
    case 'search/start':
      return {
        ...state,
        mode: action.mode,
        searchMode: action.mode,
        searchStatus: 'loading',
        searchError: null,
        searchedQuery: action.query,
        searchQuery: action.query,
        ...(action.mode === 'text'
          ? {
              textQuery: action.query,
              imageFile: null,
              imagePreview: null,
              analysis: null,
              analyzeStatus: 'idle' as FlowStatus,
              analyzeError: null,
            }
          : {
              imageQuery: action.query,
            }),
      }
    case 'search/success':
      return {
        ...state,
        mode: action.mode,
        searchMode: action.mode,
        searchStatus: 'success',
        search: action.response,
      }
    case 'search/error':
      return {
        ...state,
        searchStatus: 'error',
        searchError: action.message,
        search: null,
      }
    case 'flow/reset':
      return { ...initialState }
    default:
      return state
  }
}

export function useProductSearch() {
  const [state, dispatch] = useReducer(productSearchReducer, initialState)
  const previewRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  const setMode = useCallback((mode: SearchMode) => {
    dispatch({ type: 'mode/set', mode })
  }, [])

  const setTextQuery = useCallback((query: string) => {
    dispatch({ type: 'text/queryChanged', query })
  }, [])

  const setImageQuery = useCallback((query: string) => {
    dispatch({ type: 'image/queryChanged', query })
  }, [])

  const selectImage = useCallback((file: File) => {
    revokePreviewUrl(previewRef.current)
    const preview = createPreviewUrl(file)
    previewRef.current = preview
    dispatch({ type: 'image/selected', file, preview })
    return preview
  }, [])

  const clearImage = useCallback(() => {
    revokePreviewUrl(previewRef.current)
    previewRef.current = null
    dispatch({ type: 'image/cleared' })
  }, [])

  const analyzeImage = useCallback(
    async (file?: File) => {
      const target = file ?? state.imageFile
      if (!target) return null
      const requestId = ++requestRef.current
      dispatch({ type: 'analyze/start' })
      try {
        const analysis = await api.analyzeImage(target)
        if (requestId !== requestRef.current) return null
        dispatch({ type: 'analyze/success', analysis })
        return analysis
      } catch (error) {
        if (requestId !== requestRef.current) return null
        const message =
          error instanceof ApiError ? error.message : 'We could not analyse that image.'
        dispatch({ type: 'analyze/error', message })
        return null
      }
    },
    [state.imageFile],
  )

  const runTextSearch = useCallback(
    async (query: string, options: { forceRefresh?: boolean } = {}) => {
      const cleaned = query.trim()
      if (!cleaned) return null
      revokePreviewUrl(previewRef.current)
      previewRef.current = null
      const requestId = ++requestRef.current
      dispatch({ type: 'search/start', query: cleaned, mode: 'text' })
      try {
        const payload = { query: cleaned, force_refresh: options.forceRefresh ?? false }
        const response = await api.search(payload)
        if (requestId !== requestRef.current) return null
        dispatch({ type: 'search/success', response, mode: 'text' })
        return response
      } catch (error) {
        if (requestId !== requestRef.current) return null
        const message =
          error instanceof ApiError ? error.message : 'Something went wrong while searching.'
        dispatch({ type: 'search/error', message })
        return null
      }
    },
    [],
  )

  const runImageSearch = useCallback(
    async (query?: string, options: { forceRefresh?: boolean } = {}) => {
      const targetQuery = (query ?? state.imageQuery ?? state.analysis?.search_query ?? '').trim()
      const requestId = ++requestRef.current
      dispatch({ type: 'search/start', query: targetQuery, mode: 'image' })
      try {
        const payload = { query: targetQuery, force_refresh: options.forceRefresh ?? false }
        let response: SearchResponse
        if (state.imageFile && typeof api.searchWithImage === 'function') {
          try {
            response = await api.searchWithImage(state.imageFile, payload)
          } catch (imgErr) {
            if (targetQuery) {
              response = await api.search(payload)
            } else {
              throw imgErr
            }
          }
        } else {
          response = await api.search(payload)
        }
        if (requestId !== requestRef.current) return null
        dispatch({ type: 'search/success', response, mode: 'image' })
        return response
      } catch (error) {
        if (requestId !== requestRef.current) return null
        const message =
          error instanceof ApiError ? error.message : 'Something went wrong while searching.'
        dispatch({ type: 'search/error', message })
        return null
      }
    },
    [state.imageFile, state.imageQuery, state.analysis],
  )

  const runSearch = useCallback(
    async (query: string, options: { forceRefresh?: boolean } = {}) => {
      const cleaned = query.trim()
      if (!cleaned) return null
      if (state.mode === 'image' && state.imageFile) {
        return runImageSearch(cleaned, options)
      }
      return runTextSearch(cleaned, options)
    },
    [state.mode, state.imageFile, runImageSearch, runTextSearch],
  )

  const setQuery = useCallback((query: string) => dispatch({ type: 'query/changed', query }), [])

  const reset = useCallback(() => {
    revokePreviewUrl(previewRef.current)
    previewRef.current = null
    requestRef.current += 1
    dispatch({ type: 'flow/reset' })
  }, [])

  const stages = useMemo(
    () => ({
      uploaded: Boolean(state.imageFile),
      identified: state.analyzeStatus === 'success' || state.searchStatus === 'success',
      searching: state.searchStatus === 'success' || state.searchStatus === 'error',
      comparing: state.searchStatus === 'success',
    }),
    [state.imageFile, state.analyzeStatus, state.searchStatus],
  )

  return {
    ...state,
    stages,
    hasImage: Boolean(state.imageFile),
    isAnalyzing: state.analyzeStatus === 'loading',
    isSearching: state.searchStatus === 'loading',
    setMode,
    setTextQuery,
    setImageQuery,
    selectImage,
    clearImage,
    analyzeImage,
    runTextSearch,
    runImageSearch,
    runSearch,
    setQuery,
    reset,
  }
}

export type ProductSearchController = ReturnType<typeof useProductSearch>
