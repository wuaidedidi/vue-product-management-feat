import { ref, computed } from 'vue'

export function useProductSku() {
  const specNames = ref(['颜色', '尺码'])
  const specValues = ref([
    ['黑色', '白色', '蓝色'],
    ['S', 'M', 'L', 'XL']
  ])
  const skuList = ref([])

  const generateSkus = () => {
    const combinations = cartesianProduct(specValues.value)
    const existingSkus = new Map(skuList.value.map(s => [s.specs.join('|'), s]))

    skuList.value = combinations.map(combo => {
      const key = combo.join('|')
      const existing = existingSkus.get(key)
      return {
        specs: combo,
        price: existing?.price || 0,
        stock: existing?.stock || 0,
        code: existing?.code || ''
      }
    })
  }

  const cartesianProduct = (arrays) => {
    return arrays.reduce((acc, curr) => {
      return acc.flatMap(a => curr.map(b => [...a, b]))
    }, [[]])
  }

  const addSpecName = (name) => {
    specNames.value.push(name)
    specValues.value.push([])
    generateSkus()
  }

  const removeSpecName = (index) => {
    specNames.value.splice(index, 1)
    specValues.value.splice(index, 1)
    generateSkus()
  }

  const addSpecValue = (specIndex, value) => {
    if (value && !specValues.value[specIndex].includes(value)) {
      specValues.value[specIndex].push(value)
      generateSkus()
    }
  }

  const removeSpecValue = (specIndex, valueIndex) => {
    specValues.value[specIndex].splice(valueIndex, 1)
    generateSkus()
  }

  const priceRange = computed(() => {
    if (skuList.value.length === 0) return '0.00'
    const prices = skuList.value.map(s => s.price).filter(p => p > 0)
    if (prices.length === 0) return '0.00'
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? min.toFixed(2) : `${min.toFixed(2)} - ${max.toFixed(2)}`
  })

  const totalStock = computed(() => {
    return skuList.value.reduce((sum, sku) => sum + (sku.stock || 0), 0)
  })

  const reset = () => {
    specNames.value = ['颜色', '尺码']
    specValues.value = [['黑色', '白色', '蓝色'], ['S', 'M', 'L', 'XL']]
    skuList.value = []
    generateSkus()
  }

  const loadFromProduct = (product) => {
    if (product.specNames) {
      specNames.value = [...product.specNames]
    } else {
      specNames.value = ['颜色', '尺码']
    }
    if (product.specValues) {
      specValues.value = product.specValues.map(v => [...v])
    } else {
      specValues.value = [['黑色', '白色', '蓝色'], ['S', 'M', 'L', 'XL']]
    }
    if (product.skuList) {
      skuList.value = product.skuList.map(s => ({ ...s }))
    } else {
      skuList.value = []
    }
    if (skuList.value.length === 0) {
      generateSkus()
    }
  }

  const exportData = () => {
    return {
      specNames: [...specNames.value],
      specValues: specValues.value.map(v => [...v]),
      skuList: skuList.value.map(s => ({ ...s }))
    }
  }

  return {
    specNames,
    specValues,
    skuList,
    generateSkus,
    addSpecName,
    removeSpecName,
    addSpecValue,
    removeSpecValue,
    priceRange,
    totalStock,
    reset,
    loadFromProduct,
    exportData
  }
}
