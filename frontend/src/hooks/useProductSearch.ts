import { useCallback, useMemo, useReducer, useRef } from 'react'
import { ApiError, api } from '../services/api'
import type { FlowStatus, SearchResponse, VisionAttributes } from '../types/product'
import { createPreviewUrl, revokePreviewUrl } from '../lib/image'

export interface ProductSearchState {
  imageFile: File | null
  imagePreview: string | null
  analysis: VisionAttributes | null
  search: SearchResponse | null
  searchQuery: string
  searchedQuery: string | null
  analyzeStatus: FlowStatus
  searchStatus: FlowStatus
  analyzeError: string | null
  searchError: string | null
}

type Action =
  | { type: 'image/selected'; file: File; preview: string }
  | { type: 'image/cleared' }
  | { type: 'analyze/start'; query?: string }
  | { type: 'analyze/success'; analysis: VisionAttributes }
  | { type: 'analyze/error'; message: string }
  | { type: 'search/start'; query: string }
  | { type: 'search/success'; response: SearchResponse }
  | { type: 'search/error'; message: string }
  | { type: 'query/changed'; query: string }
  | { type: 'flow/reset' }

const initialState: ProductSearchState = {
  imageFile: null,
  imagePreview: null,
  analysis: null,
  search: null,
  searchQuery: '',
  searchedQuery: null,
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
    case 'image/selected':
      return {
        ...initialState,
        imageFile: action.file,
        imagePreview: action.preview,
      }
    case 'image/cleared':
      return { ...initialState }
    case 'analyze/start':
      return {
        ...state,
        analyzeStatus: 'loading',
        analyzeError: null,
        search: null,
        searchStatus: 'idle',
        searchedQuery: null,
        searchQuery: action.query ?? state.searchQuery,
      }
    case 'analyze/success':
      return {
        ...state,
        analyzeStatus: 'success',
        analysis: action.analysis,
        searchQuery: action.analysis.search_query,
      }
    case 'analyze/error':
      return { ...state, analyzeStatus: 'error', analyzeError: action.message, analysis: null }
    case 'search/start':
      return {
        ...state,
        searchStatus: 'loading',
        searchError: null,
        searchedQuery: action.query,
        searchQuery: action.query,
      }
    case 'search/success':
      return { ...state, searchStatus: 'success', search: action.response }
    case 'search/error':
      return { ...state, searchStatus: 'error', searchError: action.message, search: null }
    case 'query/changed':
      return { ...state, searchQuery: action.query }
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

  const runSearch = useCallback(
    async (query: string, options: { forceRefresh?: boolean } = {}) => {
      const cleaned = query.trim()
      if (!cleaned) return null
      const requestId = ++requestRef.current
      dispatch({ type: 'search/start', query: cleaned })
      try {
        const response = await api.search({
          query: cleaned,
          force_refresh: options.forceRefresh ?? false,
        })
        if (requestId !== requestRef.current) return null
        dispatch({ type: 'search/success', response })
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
    selectImage,
    clearImage,
    analyzeImage,
    runSearch,
    setQuery,
    reset,
  }
}

export type ProductSearchController = ReturnType<typeof useProductSearch>
