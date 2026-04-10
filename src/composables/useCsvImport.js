import { ref } from 'vue'

/**
 * CSV 导入解析 Composable
 * 纯手写 CSV 解析，不依赖外部库
 */
export function useCsvImport() {
  const parsing = ref(false)
  const errors = ref([])

  /**
   * 解析 CSV 文本
   * 处理引号、换行、逗号等特殊情况
   * @param {string} csvText - CSV 文本内容
   * @returns {Array} 解析后的二维数组
   */
  const parseCsv = (csvText) => {
    const lines = []
    let currentLine = []
    let currentCell = ''
    let insideQuotes = false
    let i = 0

    while (i < csvText.length) {
      const char = csvText[i]
      const nextChar = csvText[i + 1]

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // 转义的引号
            currentCell += '"'
            i += 2
            continue
          } else {
            // 结束引号
            insideQuotes = false
          }
        } else {
          currentCell += char
        }
      } else {
        if (char === '"') {
          // 开始引号
          insideQuotes = true
        } else if (char === ',') {
          // 单元格结束
          currentLine.push(currentCell.trim())
          currentCell = ''
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          // 行结束
          currentLine.push(currentCell.trim())
          if (currentLine.some(cell => cell !== '')) {
            lines.push([...currentLine])
          }
          currentLine = []
          currentCell = ''
          if (char === '\r') i++ // 跳过 \n
        } else if (char === '\r') {
          // 单独的回车符
          currentLine.push(currentCell.trim())
          if (currentLine.some(cell => cell !== '')) {
            lines.push([...currentLine])
          }
          currentLine = []
          currentCell = ''
        } else {
          currentCell += char
        }
      }
      i++
    }

    // 处理最后一行
    if (currentCell !== '' || currentLine.length > 0) {
      currentLine.push(currentCell.trim())
      if (currentLine.some(cell => cell !== '')) {
        lines.push(currentLine)
      }
    }

    return lines
  }

  /**
   * 验证商品数据
   * @param {Object} product - 商品对象
   * @param {number} rowIndex - 行号
   * @returns {Object|null} 错误对象或 null
   */
  const validateProduct = (product, rowIndex) => {
    const rowErrors = []

    if (!product.name || product.name.trim() === '') {
      rowErrors.push('商品名称不能为空')
    } else if (product.name.length > 100) {
      rowErrors.push('商品名称不能超过100个字符')
    }

    if (!product.code || product.code.trim() === '') {
      rowErrors.push('商品编码不能为空')
    }

    if (!product.categoryId) {
      rowErrors.push('分类ID不能为空')
    }

    if (product.price === undefined || product.price === null || product.price === '') {
      rowErrors.push('价格不能为空')
    } else {
      const price = Number(product.price)
      if (isNaN(price) || price < 0) {
        rowErrors.push('价格必须是非负数')
      }
    }

    if (product.stock === undefined || product.stock === null || product.stock === '') {
      rowErrors.push('库存不能为空')
    } else {
      const stock = Number(product.stock)
      if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
        rowErrors.push('库存必须是非负整数')
      }
    }

    if (rowErrors.length > 0) {
      return {
        row: rowIndex + 1,
        errors: rowErrors,
        rawData: product
      }
    }

    return null
  }

  /**
   * 导入 CSV 文件
   * @param {File} file - CSV 文件
   * @param {Object} options - 配置选项
   * @param {Array} options.categories - 可用分类列表
   * @returns {Promise<{success: boolean, data: Array, errors: Array}>}
   */
  const importCsv = (file, options = {}) => {
    return new Promise((resolve) => {
      parsing.value = true
      errors.value = []

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const csvText = e.target.result
          const lines = parseCsv(csvText)

          if (lines.length < 2) {
            errors.value.push({ row: 0, errors: ['CSV 文件格式错误：至少需要包含表头和一行数据'] })
            parsing.value = false
            resolve({ success: false, data: [], errors: errors.value })
            return
          }

          const headers = lines[0].map(h => h.trim().toLowerCase())
          const requiredHeaders = ['商品名称', '商品编码', '分类id', '价格', '库存']
          const missingHeaders = requiredHeaders.filter(h =>
            !headers.includes(h) && !headers.includes(getHeaderMapping(h))
          )

          if (missingHeaders.length > 0) {
            errors.value.push({
              row: 0,
              errors: [`缺少必需的列：${missingHeaders.join('、')}`]
            })
            parsing.value = false
            resolve({ success: false, data: [], errors: errors.value })
            return
          }

          const products = []
          const parseErrors = []

          for (let i = 1; i < lines.length; i++) {
            const row = lines[i]
            if (row.every(cell => cell === '')) continue // 跳过空行

            const product = parseRow(row, headers)
            const error = validateProduct(product, i)

            if (error) {
              parseErrors.push(error)
            } else {
              products.push(product)
            }
          }

          errors.value = parseErrors
          parsing.value = false

          resolve({
            success: parseErrors.length === 0,
            data: products,
            errors: parseErrors
          })
        } catch (err) {
          parsing.value = false
          errors.value = [{ row: 0, errors: [`解析失败：${err.message}`] }]
          resolve({ success: false, data: [], errors: errors.value })
        }
      }

      reader.onerror = () => {
        parsing.value = false
        errors.value = [{ row: 0, errors: ['文件读取失败'] }]
        resolve({ success: false, data: [], errors: errors.value })
      }

      reader.readAsText(file, 'UTF-8')
    })
  }

  /**
   * 获取表头映射（支持中英文）
   */
  const getHeaderMapping = (chinese) => {
    const mapping = {
      '商品名称': 'name',
      '商品编码': 'code',
      '分类id': 'categoryid',
      '分类ID': 'categoryid',
      '价格': 'price',
      '库存': 'stock',
      '描述': 'description',
      '状态': 'status'
    }
    return mapping[chinese] || chinese.toLowerCase()
  }

  /**
   * 解析单行数据
   */
  const parseRow = (row, headers) => {
    const product = {
      name: '',
      code: '',
      categoryId: null,
      price: 0,
      stock: 0,
      description: '',
      status: 1
    }

    headers.forEach((header, index) => {
      const value = row[index] || ''
      const key = getHeaderMapping(header)

      switch (key) {
        case 'name':
        case '商品名称':
          product.name = value
          break
        case 'code':
        case '商品编码':
          product.code = value
          break
        case 'categoryid':
        case '分类id':
          product.categoryId = parseInt(value) || null
          break
        case 'price':
        case '价格':
          product.price = parseFloat(value) || 0
          break
        case 'stock':
        case '库存':
          product.stock = parseInt(value) || 0
          break
        case 'description':
        case '描述':
          product.description = value
          break
        case 'status':
        case '状态':
          product.status = value === '0' || value === '下架' ? 0 : 1
          break
      }
    })

    return product
  }

  /**
   * 生成 CSV 模板
   * @returns {string} CSV 内容
   */
  const generateTemplate = () => {
    const headers = ['商品名称', '商品编码', '分类ID', '价格', '库存', '描述', '状态']
    const example = ['示例商品', 'CODE001', '1', '99.99', '100', '商品描述', '上架']

    // 转义包含逗号或引号的字段
    const escapeCell = (cell) => {
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    return [
      headers.map(escapeCell).join(','),
      example.map(escapeCell).join(',')
    ].join('\n')
  }

  /**
   * 下载 CSV 模板
   */
  const downloadTemplate = () => {
    const csvContent = generateTemplate()
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '商品导入模板.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  /**
   * 导出错误报告
   * @param {Array} importErrors - 导入错误列表
   */
  const downloadErrorReport = (importErrors) => {
    if (!importErrors || importErrors.length === 0) return

    const headers = ['行号', '错误信息', '原始数据']
    const rows = importErrors.map(err => [
      err.row,
      err.errors.join('; '),
      JSON.stringify(err.rawData)
    ])

    const escapeCell = (cell) => {
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map(row => row.map(escapeCell).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `导入错误报告_${new Date().toLocaleDateString()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return {
    parsing,
    errors,
    parseCsv,
    importCsv,
    generateTemplate,
    downloadTemplate,
    downloadErrorReport
  }
}

export default useCsvImport
