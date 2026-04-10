import { ref, computed } from 'vue'

/**
 * SKU 规格组合管理 Composable
 * @param {Object} options - 配置选项
 * @param {Array} options.initialSpecs - 初始规格列表 [{ name: '颜色', values: ['红', '蓝'] }]
 * @param {Array} options.initialSkus - 初始 SKU 列表 [{ specCombo: ['红', 'M'], price: 100, stock: 10 }]
 */
export function useSku(options = {}) {
  const { initialSpecs = [], initialSkus = [] } = options

  // 规格定义（如：颜色、尺码）
  const specs = ref(initialSpecs)

  // SKU 列表
  const skus = ref(initialSkus)

  // 新增规格名输入
  const newSpecName = ref('')

  // 每个规格值输入（key: specIndex, value: inputValue）
  const specValueInputs = ref({})

  /**
   * 生成规格组合
   * 使用笛卡尔积算法生成所有可能的规格组合
   */
  const generateCombinations = () => {
    const validSpecs = specs.value.filter(s => s.values.length > 0)
    if (validSpecs.length === 0) return []

    const arrays = validSpecs.map(s => s.values)
    return cartesianProduct(arrays)
  }

  /**
   * 笛卡尔积计算
   * @param {Array} arrays - 二维数组
   * @returns {Array} 所有组合
   */
  const cartesianProduct = (arrays) => {
    if (arrays.length === 0) return []
    if (arrays.length === 1) return arrays[0].map(v => [v])

    return arrays.reduce((acc, curr) => {
      const result = []
      acc.forEach(a => {
        curr.forEach(c => {
          result.push([...a, c])
        })
      })
      return result
    })
  }

  /**
   * 获取 SKU 价格区间
   * @returns {Object} { min: number, max: number }
   */
  const priceRange = computed(() => {
    if (!skus.value || skus.value.length === 0) return { min: 0, max: 0 }
    const prices = skus.value.map(s => s.price).filter(p => p > 0)
    if (prices.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  })

  /**
   * 获取总库存
   * @returns {number}
   */
  const totalStock = computed(() => {
    if (!skus.value || skus.value.length === 0) return 0
    return skus.value.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
  })

  /**
   * 格式化价格显示
   * @returns {string}
   */
  const formattedPriceRange = computed(() => {
    const { min, max } = priceRange.value
    if (min === 0 && max === 0) return '-'
    if (min === max) return `¥${min.toFixed(2)}`
    return `¥${min.toFixed(2)} ~ ¥${max.toFixed(2)}`
  })

  /**
   * 添加规格
   * @param {string} name - 规格名称
   */
  const addSpec = (name) => {
    if (!name || name.trim() === '') return false
    if (specs.value.some(s => s.name === name.trim())) return false

    specs.value.push({
      name: name.trim(),
      values: []
    })
    newSpecName.value = ''
    regenerateSkus()
    return true
  }

  /**
   * 删除规格
   * @param {number} index - 规格索引
   */
  const removeSpec = (index) => {
    specs.value.splice(index, 1)
    regenerateSkus()
  }

  /**
   * 添加规格值
   * @param {number} specIndex - 规格索引
   * @param {string} value - 规格值
   */
  const addSpecValue = (specIndex, value) => {
    if (!value || value.trim() === '') return false

    const spec = specs.value[specIndex]
    if (spec.values.includes(value.trim())) return false

    spec.values.push(value.trim())
    specValueInputs.value[specIndex] = ''
    regenerateSkus()
    return true
  }

  /**
   * 删除规格值
   * @param {number} specIndex - 规格索引
   * @param {number} valueIndex - 规格值索引
   */
  const removeSpecValue = (specIndex, valueIndex) => {
    specs.value[specIndex].values.splice(valueIndex, 1)
    regenerateSkus()
  }

  /**
   * 重新生成 SKU 列表
   * 保留已有 SKU 的价格和库存数据
   */
  const regenerateSkus = () => {
    const combinations = generateCombinations()
    const newSkus = []

    combinations.forEach(combo => {
      // 查找是否已存在该组合的 SKU
      const existingSku = skus.value.find(s =>
        s.specCombo.length === combo.length &&
        s.specCombo.every((val, idx) => val === combo[idx])
      )

      if (existingSku) {
        newSkus.push({ ...existingSku })
      } else {
        newSkus.push({
          specCombo: combo,
          price: 0,
          stock: 0,
          skuCode: generateSkuCode(combo)
        })
      }
    })

    skus.value = newSkus
  }

  /**
   * 生成 SKU 编码
   * @param {Array} combo - 规格组合
   * @returns {string}
   */
  const generateSkuCode = (combo) => {
    return combo.map(v => v.toUpperCase().replace(/\s/g, '')).join('-')
  }

  /**
   * 更新 SKU 价格
   * @param {number} index - SKU 索引
   * @param {number} price - 价格
   */
  const updateSkuPrice = (index, price) => {
    if (skus.value[index]) {
      skus.value[index].price = Number(price) || 0
    }
  }

  /**
   * 更新 SKU 库存
   * @param {number} index - SKU 索引
   * @param {number} stock - 库存
   */
  const updateSkuStock = (index, stock) => {
    if (skus.value[index]) {
      skus.value[index].stock = Number(stock) || 0
    }
  }

  /**
   * 批量设置价格
   * @param {number} price - 价格
   */
  const batchSetPrice = (price) => {
    skus.value.forEach(sku => {
      sku.price = Number(price) || 0
    })
  }

  /**
   * 批量设置库存
   * @param {number} stock - 库存
   */
  const batchSetStock = (stock) => {
    skus.value.forEach(sku => {
      sku.stock = Number(stock) || 0
    })
  }

  /**
   * 验证 SKU 数据
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  const validateSkus = () => {
    const errors = []

    if (specs.value.length === 0) {
      errors.push('请至少添加一个规格')
    }

    specs.value.forEach((spec, idx) => {
      if (spec.values.length === 0) {
        errors.push(`规格「${spec.name}」至少需要有一个规格值`)
      }
    })

    if (skus.value.length === 0) {
      errors.push('请生成 SKU 组合')
    }

    skus.value.forEach((sku, idx) => {
      if (sku.price <= 0) {
        errors.push(`SKU「${sku.specCombo.join('+')}」价格必须大于0`)
      }
      if (sku.stock < 0) {
        errors.push(`SKU「${sku.specCombo.join('+')}」库存不能为负数`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取用于保存的 SKU 数据
   * @returns {Object} { specs, skus }
   */
  const getSaveData = () => {
    return {
      specs: specs.value.map(s => ({ ...s })),
      skus: skus.value.map(s => ({ ...s }))
    }
  }

  /**
   * 加载 SKU 数据
   * @param {Object} data - { specs, skus }
   */
  const loadData = (data) => {
    if (data.specs) {
      specs.value = data.specs.map(s => ({ ...s }))
    }
    if (data.skus) {
      skus.value = data.skus.map(s => ({ ...s }))
    }
  }

  /**
   * 重置所有数据
   */
  const reset = () => {
    specs.value = []
    skus.value = []
    newSpecName.value = ''
    specValueInputs.value = {}
  }

  return {
    // 状态
    specs,
    skus,
    newSpecName,
    specValueInputs,

    // 计算属性
    priceRange,
    totalStock,
    formattedPriceRange,

    // 方法
    addSpec,
    removeSpec,
    addSpecValue,
    removeSpecValue,
    updateSkuPrice,
    updateSkuStock,
    batchSetPrice,
    batchSetStock,
    validateSkus,
    getSaveData,
    loadData,
    reset,
    regenerateSkus
  }
}

export default useSku
