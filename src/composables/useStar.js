import { ref, computed } from 'vue'

const STORAGE_KEY = 'mock_product_stars'

export function useStar() {
  const starredIds = ref(new Set())

  const loadStars = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      starredIds.value = new Set(JSON.parse(stored))
    }
    return starredIds.value
  }

  const saveStars = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...starredIds.value]))
  }

  const toggleStar = (productId) => {
    loadStars()
    
    if (starredIds.value.has(productId)) {
      starredIds.value.delete(productId)
      saveStars()
      return false
    } else {
      starredIds.value.add(productId)
      saveStars()
      return true
    }
  }

  const isStarred = (productId) => {
    loadStars()
    return starredIds.value.has(productId)
  }

  const getStarredIds = () => {
    loadStars()
    return [...starredIds.value]
  }

  const getStarredCount = () => {
    loadStars()
    return starredIds.value.size
  }

  const clearAllStars = () => {
    starredIds.value = new Set()
    localStorage.removeItem(STORAGE_KEY)
  }

  const filterStarredProducts = (products) => {
    loadStars()
    return products.filter(p => starredIds.value.has(p.id))
  }

  return {
    starredIds,
    loadStars,
    saveStars,
    toggleStar,
    isStarred,
    getStarredIds,
    getStarredCount,
    clearAllStars,
    filterStarredProducts
  }
}
