import { ref, computed } from 'vue'

export function useSku() {
  const specOptions = ref([
    { id: 'color', name: '颜色', values: ['红色', '蓝色', '黑色', '白色', '绿色', '黄色'] },
    { id: 'size', name: '尺码', values: ['S', 'M', 'L', 'XL', 'XXL'] },
    { id: 'version', name: '版本', values: ['标准版', '豪华版', '旗舰版'] },
    { id: 'storage', name: '存储', values: ['64GB', '128GB', '256GB', '512GB'] }
  ])

  const generateSkuId = () => {
    return `sku_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const generateSkuCode = (productCode, specs) => {
    const specStr = Object.values(specs).join('-')
    return `${productCode}_${specStr}`
  }

  const generateSkusFromSpecs = (productCode, selectedSpecs) => {
    if (!selectedSpecs || selectedSpecs.length === 0) {
      return []
    }

    const specArrays = selectedSpecs.map(spec => {
      return spec.values.map(v => ({ [spec.id]: v }))
    })

    const combinations = cartesianProduct(specArrays)

    return combinations.map((combo, index) => {
      const specs = Object.assign({}, ...combo)
      return {
        id: generateSkuId(),
        code: generateSkuCode(productCode, specs),
        specs,
        price: 0,
        stock: 0,
        status: 1
      }
    })
  }

  const cartesianProduct = (arrays) => {
    if (arrays.length === 0) return [[]]
    if (arrays.length === 1) return arrays[0].map(item => [item])

    return arrays.reduce((acc, arr) => {
      return acc.flatMap(x => arr.map(y => [...x, y]))
    }, [[]])
  }

  const calculatePriceRange = (skus) => {
    if (!skus || skus.length === 0) {
      return { min: 0, max: 0, display: '¥0.00' }
    }

    const validSkus = skus.filter(sku => sku.price > 0)
    if (validSkus.length === 0) {
      return { min: 0, max: 0, display: '¥0.00' }
    }

    const prices = validSkus.map(sku => sku.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)

    if (min === max) {
      return { min, max, display: `¥${min.toFixed(2)}` }
    }

    return { min, max, display: `¥${min.toFixed(2)} - ¥${max.toFixed(2)}` }
  }

  const calculateTotalStock = (skus) => {
    if (!skus || skus.length === 0) {
      return 0
    }
    return skus.reduce((sum, sku) => sum + (sku.stock || 0), 0)
  }

  const validateSkus = (skus) => {
    const errors = []

    if (!skus || skus.length === 0) {
      errors.push('请至少添加一个 SKU 规格')
      return errors
    }

    skus.forEach((sku, index) => {
      if (!sku.code || sku.code.trim() === '') {
        errors.push(`SKU ${index + 1}: 编码不能为空`)
      }
      if (sku.price === undefined || sku.price === null || sku.price < 0) {
        errors.push(`SKU ${index + 1}: 价格必须大于等于 0`)
      }
      if (sku.stock === undefined || sku.stock === null || sku.stock < 0) {
        errors.push(`SKU ${index + 1}: 库存必须大于等于 0`)
      }
    })

    const codes = skus.map(sku => sku.code)
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index)
    if (duplicates.length > 0) {
      errors.push('存在重复的 SKU 编码')
    }

    return errors
  }

  const formatSkuSpecs = (specs) => {
    if (!specs || typeof specs !== 'object') {
      return ''
    }
    return Object.entries(specs)
      .map(([key, value]) => value)
      .join(' / ')
  }

  const getSkuSpecLabels = (specs, specDefinitions) => {
    if (!specs || typeof specs !== 'object') {
      return []
    }

    return Object.entries(specs).map(([key, value]) => {
      const specDef = specDefinitions?.find(s => s.id === key)
      return {
        key,
        label: specDef?.name || key,
        value
      }
    })
  }

  const mergeSkus = (existingSkus, newSkus) => {
    const merged = [...existingSkus]
    const existingCodes = new Set(existingSkus.map(sku => sku.code))

    newSkus.forEach(newSku => {
      if (!existingCodes.has(newSku.code)) {
        merged.push(newSku)
      }
    })

    return merged
  }

  const removeSku = (skus, skuId) => {
    return skus.filter(sku => sku.id !== skuId)
  }

  const updateSku = (skus, skuId, updates) => {
    return skus.map(sku => {
      if (sku.id === skuId) {
        return { ...sku, ...updates }
      }
      return sku
    })
  }

  const getActiveSkus = (skus) => {
    return skus.filter(sku => sku.status === 1)
  }

  const getLowStockSkus = (skus, threshold = 10) => {
    return skus.filter(sku => sku.stock <= threshold && sku.status === 1)
  }

  return {
    specOptions,
    generateSkuId,
    generateSkuCode,
    generateSkusFromSpecs,
    calculatePriceRange,
    calculateTotalStock,
    validateSkus,
    formatSkuSpecs,
    getSkuSpecLabels,
    mergeSkus,
    removeSku,
    updateSku,
    getActiveSkus,
    getLowStockSkus
  }
}
