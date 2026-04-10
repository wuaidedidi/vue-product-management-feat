import { ref } from 'vue'

export function useCsv() {
  const parseCSV = (content) => {
    const lines = content.split(/\r?\n/)
    if (lines.length === 0) {
      return { headers: [], rows: [], errors: [] }
    }

    const headers = parseCSVLine(lines[0])
    const rows = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === '') continue

      try {
        const values = parseCSVLine(line)
        if (values.length !== headers.length) {
          errors.push({
            row: i + 1,
            line: line,
            error: `列数不匹配，期望 ${headers.length} 列，实际 ${values.length} 列`
          })
          continue
        }

        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        rows.push({ lineNumber: i + 1, data: row, rawLine: line })
      } catch (e) {
        errors.push({
          row: i + 1,
          line: line,
          error: `解析错误: ${e.message}`
        })
      }
    }

    return { headers, rows, errors }
  }

  const parseCSVLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }

    result.push(current.trim())
    return result
  }

  const validateProductRow = (row, rowNum, categories, existingCodes) => {
    const errors = []

    if (!row['商品名称'] || row['商品名称'].trim() === '') {
      errors.push(`第 ${rowNum} 行: 商品名称不能为空`)
    } else if (row['商品名称'].length > 100) {
      errors.push(`第 ${rowNum} 行: 商品名称不能超过100个字符`)
    }

    if (!row['商品编码'] || row['商品编码'].trim() === '') {
      errors.push(`第 ${rowNum} 行: 商品编码不能为空`)
    } else if (existingCodes.has(row['商品编码'])) {
      errors.push(`第 ${rowNum} 行: 商品编码 "${row['商品编码']}" 已存在`)
    }

    const category = row['商品分类']
    if (!category || category.trim() === '') {
      errors.push(`第 ${rowNum} 行: 商品分类不能为空`)
    } else {
      const foundCategory = categories.find(c => c.name === category)
      if (!foundCategory) {
        errors.push(`第 ${rowNum} 行: 商品分类 "${category}" 不存在`)
      }
    }

    const price = parseFloat(row['价格'])
    if (isNaN(price) || price < 0) {
      errors.push(`第 ${rowNum} 行: 价格必须为非负数`)
    }

    const stock = parseInt(row['库存'])
    if (isNaN(stock) || stock < 0) {
      errors.push(`第 ${rowNum} 行: 库存必须为非负整数`)
    }

    const status = row['状态']
    if (status && status !== '上架' && status !== '下架') {
      errors.push(`第 ${rowNum} 行: 状态必须是"上架"或"下架"`)
    }

    return errors
  }

  const validateProductImport = (rows, categories, existingProducts) => {
    const validRows = []
    const invalidRows = []
    const allErrors = []
    const existingCodes = new Set(existingProducts.map(p => p.code))

    rows.forEach((row, index) => {
      const errors = validateProductRow(row.data, row.lineNumber, categories, existingCodes)
      
      if (errors.length === 0) {
        validRows.push(row)
        existingCodes.add(row.data['商品编码'])
      } else {
        invalidRows.push({
          ...row,
          errors
        })
        allErrors.push(...errors)
      }
    })

    return { validRows, invalidRows, allErrors }
  }

  const convertRowToProduct = (row, categories) => {
    const category = categories.find(c => c.name === row['商品分类'])
    
    const product = {
      id: Date.now() + Math.random(),
      name: row['商品名称'],
      code: row['商品编码'],
      categoryId: category?.id,
      categoryName: category?.name,
      price: parseFloat(row['价格']) || 0,
      stock: parseInt(row['库存']) || 0,
      sales: parseInt(row['销量']) || 0,
      image: row['图片'] || '',
      description: row['描述'] || '',
      status: row['状态'] === '下架' ? 0 : 1,
      createTime: new Date().toLocaleString(),
      skus: []
    }

    return product
  }

  const generateImportTemplate = () => {
    const headers = ['商品名称', '商品编码', '商品分类', '价格', '库存', '销量', '图片', '描述', '状态']
    const exampleRows = [
      ['示例商品', 'DEMO001', '电子产品', '99.00', '100', '0', '', '这是一个示例商品', '上架'],
      ['测试商品', 'TEST001', '服装鞋包', '199.00', '50', '10', '', '测试商品描述', '下架']
    ]

    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.map(cell => escapeCSVCell(cell)).join(','))
    ].join('\n')

    return csvContent
  }

  const escapeCSVCell = (cell) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  const exportToCSV = (products, headers) => {
    const headerRow = headers.map(h => escapeCSVCell(h.label)).join(',')
    
    const dataRows = products.map(product => {
      return headers.map(h => {
        const value = h.getValue ? h.getValue(product) : product[h.key]
        return escapeCSVCell(String(value || ''))
      }).join(',')
    })

    return [headerRow, ...dataRows].join('\n')
  }

  const downloadCSV = (content, filename) => {
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return {
    parseCSV,
    validateProductImport,
    convertRowToProduct,
    generateImportTemplate,
    exportToCSV,
    downloadCSV
  }
}
