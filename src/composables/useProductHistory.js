import { ref } from 'vue'

/**
 * 商品操作历史记录 Composable
 */
export function useProductHistory() {
  const STORAGE_KEY = 'mock_product_history'

  /**
   * 获取商品的历史记录
   * @param {number} productId - 商品ID
   * @returns {Array} 历史记录列表
   */
  const getHistory = (productId) => {
    const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return allHistory[productId] || []
  }

  /**
   * 添加历史记录
   * @param {number} productId - 商品ID
   * @param {Object} record - 记录对象
   * @param {string} record.action - 操作类型：create/update/delete/status_change/etc
   * @param {string} record.field - 修改的字段（可选）
   * @param {any} record.oldValue - 旧值（可选）
   * @param {any} record.newValue - 新值（可选）
   * @param {string} record.operator - 操作人
   * @param {string} record.remark - 备注（可选）
   */
  const addRecord = (productId, record) => {
    const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')

    if (!allHistory[productId]) {
      allHistory[productId] = []
    }

    const newRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...record
    }

    allHistory[productId].unshift(newRecord)

    // 限制每个商品最多保留 100 条记录
    if (allHistory[productId].length > 100) {
      allHistory[productId] = allHistory[productId].slice(0, 100)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory))
    return newRecord
  }

  /**
   * 记录商品创建
   * @param {number} productId - 商品ID
   * @param {Object} product - 商品数据
   * @param {string} operator - 操作人
   */
  const recordCreate = (productId, product, operator = 'admin') => {
    return addRecord(productId, {
      action: 'create',
      actionName: '创建商品',
      operator,
      remark: `创建了商品「${product.name}」`
    })
  }

  /**
   * 记录商品更新
   * @param {number} productId - 商品ID
   * @param {Object} oldProduct - 旧商品数据
   * @param {Object} newProduct - 新商品数据
   * @param {string} operator - 操作人
   */
  const recordUpdate = (productId, oldProduct, newProduct, operator = 'admin') => {
    const changes = []
    const fieldNames = {
      name: '商品名称',
      code: '商品编码',
      categoryId: '商品分类',
      price: '价格',
      stock: '库存',
      description: '商品描述',
      status: '商品状态',
      specs: '商品规格',
      skus: 'SKU配置'
    }

    Object.keys(fieldNames).forEach(key => {
      const oldVal = oldProduct[key]
      const newVal = newProduct[key]

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          fieldName: fieldNames[key],
          oldValue: formatValue(oldVal, key),
          newValue: formatValue(newVal, key)
        })
      }
    })

    if (changes.length === 0) return null

    return addRecord(productId, {
      action: 'update',
      actionName: '修改商品',
      operator,
      changes,
      remark: `修改了 ${changes.map(c => c.fieldName).join('、')}`
    })
  }

  /**
   * 记录状态变更
   * @param {number} productId - 商品ID
   * @param {number} oldStatus - 旧状态
   * @param {number} newStatus - 新状态
   * @param {string} productName - 商品名称
   * @param {string} operator - 操作人
   */
  const recordStatusChange = (productId, oldStatus, newStatus, productName, operator = 'admin') => {
    const statusMap = { 0: '下架', 1: '上架' }
    return addRecord(productId, {
      action: 'status_change',
      actionName: '状态变更',
      operator,
      changes: [{
        field: 'status',
        fieldName: '商品状态',
        oldValue: statusMap[oldStatus],
        newValue: statusMap[newStatus]
      }],
      remark: `将商品「${productName}」${statusMap[newStatus === 1 ? 0 : 1]}改为${statusMap[newStatus]}`
    })
  }

  /**
   * 记录删除操作
   * @param {number} productId - 商品ID
   * @param {string} productName - 商品名称
   * @param {string} operator - 操作人
   */
  const recordDelete = (productId, productName, operator = 'admin') => {
    return addRecord(productId, {
      action: 'delete',
      actionName: '删除商品',
      operator,
      remark: `删除了商品「${productName}」`
    })
  }

  /**
   * 记录批量导入
   * @param {number} productId - 商品ID
   * @param {Object} product - 商品数据
   * @param {string} operator - 操作人
   */
  const recordImport = (productId, product, operator = 'admin') => {
    return addRecord(productId, {
      action: 'import',
      actionName: '批量导入',
      operator,
      remark: `通过 CSV 导入商品「${product.name}」`
    })
  }

  /**
   * 格式化值显示
   */
  const formatValue = (value, key) => {
    if (value === undefined || value === null) return '-'

    if (key === 'status') {
      return value === 1 ? '上架' : '下架'
    }

    if (key === 'categoryId') {
      // 分类名称会在组件中处理
      return value
    }

    if (key === 'specs' || key === 'skus') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  /**
   * 获取操作类型样式
   */
  const getActionTypeStyle = (action) => {
    const styles = {
      create: { type: 'success', icon: 'Plus' },
      update: { type: 'primary', icon: 'Edit' },
      delete: { type: 'danger', icon: 'Delete' },
      status_change: { type: 'warning', icon: 'Switch' },
      import: { type: 'info', icon: 'Upload' }
    }
    return styles[action] || { type: 'info', icon: 'InfoFilled' }
  }

  /**
   * 清除商品历史记录
   * @param {number} productId - 商品ID
   */
  const clearHistory = (productId) => {
    const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    delete allHistory[productId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allHistory))
  }

  return {
    getHistory,
    addRecord,
    recordCreate,
    recordUpdate,
    recordStatusChange,
    recordDelete,
    recordImport,
    getActionTypeStyle,
    clearHistory
  }
}

export default useProductHistory
