import { ref, computed } from 'vue'

const STORAGE_KEY = 'mock_product_history'

export function useHistory() {
  const history = ref([])

  const loadHistory = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      history.value = JSON.parse(stored)
    }
    return history.value
  }

  const saveHistory = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
  }

  const addHistory = (productId, action, details, operator = 'admin') => {
    loadHistory()

    const record = {
      id: Date.now(),
      productId,
      action,
      details,
      operator,
      operatorName: getOperatorName(operator),
      createTime: new Date().toLocaleString(),
      timestamp: Date.now()
    }

    history.value.unshift(record)
    saveHistory()
    return record
  }

  const getOperatorName = (operator) => {
    const users = JSON.parse(localStorage.getItem('mock_users') || '[]')
    const user = users.find(u => u.username === operator)
    return user?.nickname || user?.username || operator
  }

  const getProductHistory = (productId) => {
    loadHistory()
    return history.value
      .filter(h => h.productId === productId)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  const getAllHistory = (limit = 100) => {
    loadHistory()
    return history.value
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  const deleteProductHistory = (productId) => {
    loadHistory()
    history.value = history.value.filter(h => h.productId !== productId)
    saveHistory()
  }

  const clearAllHistory = () => {
    history.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  const getActionLabel = (action) => {
    const labels = {
      create: '创建商品',
      update: '更新商品',
      delete: '删除商品',
      status_on: '上架商品',
      status_off: '下架商品',
      sku_add: '添加 SKU',
      sku_update: '更新 SKU',
      sku_delete: '删除 SKU',
      price_update: '价格调整',
      stock_update: '库存调整',
      import: '批量导入',
      star_add: '添加收藏',
      star_remove: '取消收藏'
    }
    return labels[action] || action
  }

  const getActionType = (action) => {
    const types = {
      create: 'success',
      update: 'primary',
      delete: 'danger',
      status_on: 'success',
      status_off: 'warning',
      sku_add: 'info',
      sku_update: 'primary',
      sku_delete: 'danger',
      price_update: 'warning',
      stock_update: 'info',
      import: 'success',
      star_add: 'warning',
      star_remove: 'info'
    }
    return types[action] || 'info'
  }

  const getActionIcon = (action) => {
    const icons = {
      create: 'CirclePlus',
      update: 'Edit',
      delete: 'Delete',
      status_on: 'Top',
      status_off: 'Bottom',
      sku_add: 'Plus',
      sku_update: 'Edit',
      sku_delete: 'Minus',
      price_update: 'PriceTag',
      stock_update: 'Box',
      import: 'Upload',
      star_add: 'StarFilled',
      star_remove: 'Star'
    }
    return icons[action] || 'Document'
  }

  const formatHistoryDetails = (record) => {
    if (!record.details) return ''

    if (typeof record.details === 'string') {
      return record.details
    }

    if (typeof record.details === 'object') {
      const changes = []
      
      if (record.details.fields) {
        record.details.fields.forEach(field => {
          changes.push(`${field.name}: "${field.oldValue || '空'}" → "${field.newValue || '空'}"`)
        })
      }

      if (record.details.skuInfo) {
        changes.push(`SKU: ${record.details.skuInfo}`)
      }

      return changes.join('；') || JSON.stringify(record.details)
    }

    return ''
  }

  return {
    history,
    loadHistory,
    addHistory,
    getProductHistory,
    getAllHistory,
    deleteProductHistory,
    clearAllHistory,
    getActionLabel,
    getActionType,
    getActionIcon,
    formatHistoryDetails
  }
}
