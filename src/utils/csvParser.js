export function parseCSV(content) {
  const lines = content.split(/\r?\n/)
  const result = []
  const errors = []

  if (lines.length < 2) {
    return { data: [], errors: [{ row: 1, message: 'CSV文件为空或格式不正确' }] }
  }

  const headers = parseCSVLine(lines[0])

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const rowNum = i + 1
    try {
      const values = parseCSVLine(line)
      if (values.length !== headers.length) {
        errors.push({ row: rowNum, message: `列数不匹配，期望${headers.length}列，实际${values.length}列` })
        continue
      }

      const row = {}
      headers.forEach((header, index) => {
        row[header.trim()] = values[index].trim()
      })
      result.push({ row: rowNum, data: row })
    } catch (e) {
      errors.push({ row: rowNum, message: '解析失败：' + e.message })
    }
  }

  return { data: result, errors }
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function toCSV(headers, data) {
  const lines = [headers.join(',')]
  data.forEach(row => {
    const line = headers.map(h => {
      const value = String(row[h] || '')
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"'
      }
      return value
    }).join(',')
    lines.push(line)
  })
  return '\uFEFF' + lines.join('\n')
}

const headerMap = {
  '商品名称': 'name',
  '商品编码': 'code',
  '分类ID': 'categoryId',
  '价格': 'price',
  '库存': 'stock',
  '描述': 'description',
  '状态(1上架0下架)': 'status'
}

export function validateProductRow(row) {
  const errors = []
  const data = {}

  Object.keys(row.data).forEach(key => {
    const englishKey = headerMap[key] || key
    data[englishKey] = row.data[key]
  })

  row.data = data

  if (!row.data.name) {
    errors.push('商品名称不能为空')
  }
  if (!row.data.code) {
    errors.push('商品编码不能为空')
  }
  if (!row.data.categoryId) {
    errors.push('分类ID不能为空')
  }
  const price = parseFloat(row.data.price)
  if (isNaN(price) || price < 0) {
    errors.push('价格必须是大于等于0的数字')
  }
  const stock = parseInt(row.data.stock)
  if (isNaN(stock) || stock < 0) {
    errors.push('库存必须是大于等于0的整数')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const productTemplateHeaders = ['name', 'code', 'categoryId', 'price', 'stock', 'description', 'status']
export const productTemplateHeadersCN = ['商品名称', '商品编码', '分类ID', '价格', '库存', '描述', '状态(1上架0下架)']
