<template>
  <div class="product-list">
    <div class="page-header">
      <h1 class="page-title">商品列表</h1>
      <p class="page-desc">管理平台中的所有商品信息</p>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索商品名称/编码"
        prefix-icon="Search"
        clearable
        style="width: 240px"
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      />
      <el-select
        v-model="searchForm.categoryId"
        placeholder="选择分类"
        clearable
        style="width: 160px"
        @change="handleSearch"
      >
        <el-option
          v-for="cat in categories"
          :key="cat.id"
          :label="cat.name"
          :value="cat.id"
        />
      </el-select>
      <el-select
        v-model="searchForm.status"
        placeholder="商品状态"
        clearable
        style="width: 120px"
        @change="handleSearch"
      >
        <el-option label="上架" :value="1" />
        <el-option label="下架" :value="0" />
      </el-select>
      <el-switch
        v-model="searchForm.starredOnly"
        active-text="仅看收藏"
        style="margin-left: 8px"
        @change="handleSearch"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
      <div style="flex: 1"></div>
      <el-button :icon="Download" @click="downloadTemplate">下载模板</el-button>
      <el-upload
        :show-file-list="false"
        :before-upload="handleImport"
        accept=".csv"
      >
        <el-button :icon="Upload">批量导入</el-button>
      </el-upload>
      <el-button type="primary" :icon="Plus" @click="openDialog()">添加商品</el-button>
    </div>

    <el-dialog v-model="importDialogVisible" title="批量导入结果" width="800px">
      <el-alert
        v-if="importErrors.length > 0"
        :title="`共 ${importErrors.length} 行数据解析或校验失败`"
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-if="importSuccess > 0"
        :title="`成功导入 ${importSuccess} 条商品数据`"
        type="success"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-table v-if="importErrors.length > 0" :data="importErrors" stripe>
        <el-table-column prop="row" label="行号" width="80" />
        <el-table-column prop="message" label="错误信息" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <div class="table-container card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column width="50">
          <template #default="{ row }">
            <el-icon
              class="star-icon"
              :class="{ starred: row.starred }"
              @click="toggleStar(row)"
            >
              <Star />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="code" label="商品编码" width="120" />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column label="价格" width="140">
          <template #default="{ row }">
            <span class="price">¥{{ getPriceRange(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">
            {{ getTotalStock(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="80" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button type="primary" link @click="openHistoryDialog(row)">历史</el-button>
              <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
              <el-button
                :type="row.status === 1 ? 'warning' : 'success'"
                link
                @click="toggleStatus(row)"
              >
                {{ row.status === 1 ? '下架' : '上架' }}
              </el-button>
              <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSearch"
          @current-change="handleSearch"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingProduct ? '编辑商品' : '添加商品'"
      width="800px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="商品编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入商品编码" />
        </el-form-item>
        <el-form-item label="商品分类" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">规格设置</el-divider>

        <el-form-item label="规格定义">
          <div class="spec-definition">
            <div v-for="(specName, specIndex) in sku.specNames" :key="specIndex" class="spec-row">
              <span class="spec-label">{{ specName }}:</span>
              <el-tag
                v-for="(value, valueIndex) in sku.specValues[specIndex]"
                :key="valueIndex"
                class="spec-value-tag"
                closable
                @close="sku.removeSpecValue(specIndex, valueIndex)"
              >
                {{ value }}
              </el-tag>
              <el-input
                v-if="addingSpec[specIndex]"
                v-model="newSpecValues[specIndex]"
                size="small"
                style="width: 100px"
                @keyup.enter="confirmAddSpecValue(specIndex)"
                @blur="confirmAddSpecValue(specIndex)"
              />
              <el-button
                v-else
                link
                size="small"
                @click="startAddSpecValue(specIndex)"
              >
                + 添加
              </el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="SKU列表">
          <el-table :data="sku.skuList" border size="small">
            <el-table-column
              v-for="(specName, specIndex) in sku.specNames"
              :key="specIndex"
              :prop="'specs.' + specIndex"
              :label="specName"
              min-width="100"
            />
            <el-table-column label="价格" width="120">
              <template #default="{ row, $index }">
                <el-input-number
                  v-model="sku.skuList[$index].price"
                  :min="0"
                  :precision="2"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="库存" width="100">
              <template #default="{ row, $index }">
                <el-input-number
                  v-model="sku.skuList[$index].stock"
                  :min="0"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-divider content-position="left">其他信息</el-divider>

        <el-form-item label="商品描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入商品描述"
          />
        </el-form-item>
        <el-form-item label="商品状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">上架</el-radio>
            <el-radio :value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="操作历史" width="650px">
      <el-timeline>
        <el-timeline-item
          v-for="item in currentHistory"
          :key="item.id"
          :timestamp="item.createTime"
        >
          <div class="history-content">
            <div class="history-header">
              <span class="history-operator">{{ item.operator }}</span>
              <span class="history-action">{{ item.action }}</span>
            </div>
            <p class="history-detail">{{ item.detail }}</p>
            <div v-if="item.changes && item.changes.length > 0" class="history-changes">
              <div
                v-for="(change, idx) in item.changes"
                :key="idx"
                class="change-item"
              >
                <span class="change-field">{{ change.fieldName }}：</span>
                <span class="change-old">{{ change.oldValue || '(空)' }}</span>
                <el-icon class="change-arrow"><ArrowRight /></el-icon>
                <span class="change-new">{{ change.newValue || '(空)' }}</span>
              </div>
            </div>
          </div>
        </el-timeline-item>
        <el-timeline-item v-if="currentHistory.length === 0">
          暂无操作记录
        </el-timeline-item>
      </el-timeline>
      <template #footer>
        <el-button @click="historyDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Download, Upload, Star, ArrowRight } from '@element-plus/icons-vue'
import { useProductSku } from '@/composables/useProductSku'
import { parseCSV, toCSV, validateProductRow, productTemplateHeadersCN } from '@/utils/csvParser'

const loading = ref(false)
const submitting = ref(false)
const addingSpec = ref({})
const newSpecValues = ref({})

const searchForm = reactive({
  keyword: '',
  categoryId: null,
  status: null,
  starredOnly: false
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const categories = ref([
  { id: 1, name: '电子产品' },
  { id: 2, name: '服装鞋包' },
  { id: 3, name: '食品饮料' },
  { id: 4, name: '家居用品' },
  { id: 5, name: '美妆护肤' }
])

const tableData = ref([])
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const historyDialogVisible = ref(false)
const editingProduct = ref(null)
const currentHistory = ref([])
const formRef = ref(null)
const importErrors = ref([])
const importSuccess = ref(0)

const form = reactive({
  name: '',
  code: '',
  categoryId: null,
  description: '',
  status: 1
})

const sku = useProductSku()

const rules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 100, message: '商品名称不能超过100个字符', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }]
}

const getStarredProducts = () => {
  const stored = localStorage.getItem('mock_starred_products')
  return stored ? JSON.parse(stored) : []
}

const saveStarredProducts = (starred) => {
  localStorage.setItem('mock_starred_products', JSON.stringify(starred))
}

const getProductHistory = () => {
  const stored = localStorage.getItem('mock_product_history')
  return stored ? JSON.parse(stored) : {}
}

const saveProductHistory = (history) => {
  localStorage.setItem('mock_product_history', JSON.stringify(history))
}

const fieldLabels = {
  name: '商品名称',
  code: '商品编码',
  categoryId: '商品分类',
  description: '商品描述',
  status: '商品状态'
}

const getCategoryName = (id) => {
  const cat = categories.value.find(c => c.id === id)
  return cat?.name || id
}

const formatValue = (field, value) => {
  if (field === 'categoryId') return getCategoryName(value)
  if (field === 'status') return value === 1 ? '上架' : '下架'
  return String(value)
}

const compareChanges = (oldObj, newObj, fields = ['name', 'code', 'categoryId', 'description', 'status']) => {
  const changes = []
  fields.forEach(field => {
    const oldVal = oldObj[field]
    const newVal = newObj[field]
    if (oldVal !== newVal) {
      changes.push({
        field,
        fieldName: fieldLabels[field] || field,
        oldValue: formatValue(field, oldVal),
        newValue: formatValue(field, newVal)
      })
    }
  })
  return changes
}

const addHistory = (productId, action, detail, changes = []) => {
  const history = getProductHistory()
  if (!history[productId]) {
    history[productId] = []
  }
  history[productId].unshift({
    id: Date.now(),
    action,
    detail,
    changes,
    operator: '管理员',
    createTime: new Date().toLocaleString()
  })
  saveProductHistory(history)
}

const getPriceRange = (product) => {
  if (!product.skuList || product.skuList.length === 0) {
    return product.price?.toFixed(2) || '0.00'
  }
  const prices = product.skuList.map(s => s.price).filter(p => p > 0)
  if (prices.length === 0) return '0.00'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? min.toFixed(2) : `${min.toFixed(2)} - ${max.toFixed(2)}`
}

const getTotalStock = (product) => {
  if (!product.skuList || product.skuList.length === 0) {
    return product.stock || 0
  }
  return product.skuList.reduce((sum, sku) => sum + (sku.stock || 0), 0)
}

const initProducts = () => {
  const stored = localStorage.getItem('mock_products')
  if (stored) {
    const products = JSON.parse(stored)
    const starred = getStarredProducts()
    return products.map(p => ({
      ...p,
      starred: starred.includes(p.id)
    }))
  }

  const defaultProducts = [
    {
      id: 1, name: 'iPhone 15 Pro Max', code: 'IPHONE15PM', categoryId: 1, categoryName: '电子产品',
      specNames: ['颜色', '存储容量'],
      specValues: [['黑色钛金属', '白色钛金属', '蓝色钛金属'], ['256GB', '512GB', '1TB']],
      skuList: [
        { specs: ['黑色钛金属', '256GB'], price: 9999, stock: 30 },
        { specs: ['黑色钛金属', '512GB'], price: 10999, stock: 20 },
        { specs: ['黑色钛金属', '1TB'], price: 12999, stock: 10 },
        { specs: ['白色钛金属', '256GB'], price: 9999, stock: 25 },
        { specs: ['白色钛金属', '512GB'], price: 10999, stock: 15 },
        { specs: ['白色钛金属', '1TB'], price: 12999, stock: 5 },
        { specs: ['蓝色钛金属', '256GB'], price: 9999, stock: 20 },
        { specs: ['蓝色钛金属', '512GB'], price: 10999, stock: 10 },
        { specs: ['蓝色钛金属', '1TB'], price: 12999, stock: 5 }
      ],
      sales: 256, image: '', description: '苹果最新旗舰手机', status: 1, createTime: '2024-01-15 10:00:00'
    },
    {
      id: 2, name: 'MacBook Pro 14"', code: 'MBP14', categoryId: 1, categoryName: '电子产品',
      specNames: ['芯片', '内存', '存储'],
      specValues: [['M3 Pro', 'M3 Max'], ['18GB', '36GB'], ['512GB', '1TB', '2TB']],
      skuList: [
        { specs: ['M3 Pro', '18GB', '512GB'], price: 14999, stock: 15 },
        { specs: ['M3 Pro', '18GB', '1TB'], price: 16999, stock: 10 },
        { specs: ['M3 Pro', '36GB', '1TB'], price: 18999, stock: 8 },
        { specs: ['M3 Max', '36GB', '1TB'], price: 21999, stock: 5 },
        { specs: ['M3 Max', '36GB', '2TB'], price: 24999, stock: 3 }
      ],
      sales: 128, image: '', description: 'M3 Pro芯片，强劲性能', status: 1, createTime: '2024-01-15 10:00:00'
    },
    {
      id: 3, name: 'AirPods Pro 2', code: 'AIRPODSPRO2', categoryId: 1, categoryName: '电子产品',
      specNames: ['款式'],
      specValues: [['标准版', 'USB-C版']],
      skuList: [
        { specs: ['标准版'], price: 1899, stock: 100 },
        { specs: ['USB-C版'], price: 1999, stock: 100 }
      ],
      sales: 512, image: '', description: '主动降噪，空间音频', status: 1, createTime: '2024-01-15 10:00:00'
    },
    {
      id: 4, name: '男士休闲夹克', code: 'JACKET001', categoryId: 2, categoryName: '服装鞋包',
      specNames: ['颜色', '尺码'],
      specValues: [['黑色', '藏青', '卡其'], ['M', 'L', 'XL', 'XXL']],
      skuList: [
        { specs: ['黑色', 'M'], price: 399, stock: 20 },
        { specs: ['黑色', 'L'], price: 399, stock: 25 },
        { specs: ['黑色', 'XL'], price: 399, stock: 15 },
        { specs: ['黑色', 'XXL'], price: 399, stock: 10 },
        { specs: ['藏青', 'M'], price: 379, stock: 15 },
        { specs: ['藏青', 'L'], price: 379, stock: 20 },
        { specs: ['藏青', 'XL'], price: 379, stock: 15 },
        { specs: ['藏青', 'XXL'], price: 379, stock: 10 },
        { specs: ['卡其', 'M'], price: 359, stock: 10 },
        { specs: ['卡其', 'L'], price: 359, stock: 15 },
        { specs: ['卡其', 'XL'], price: 359, stock: 10 },
        { specs: ['卡其', 'XXL'], price: 359, stock: 5 }
      ],
      sales: 89, image: '', description: '时尚简约，舒适百搭', status: 1, createTime: '2024-01-15 10:00:00'
    },
    {
      id: 5, name: '女士连衣裙', code: 'DRESS001', categoryId: 2, categoryName: '服装鞋包',
      specNames: ['颜色', '尺码'],
      specValues: [['白色', '黑色', '粉色'], ['S', 'M', 'L', 'XL']],
      skuList: [
        { specs: ['白色', 'S'], price: 299, stock: 8 },
        { specs: ['白色', 'M'], price: 299, stock: 12 },
        { specs: ['白色', 'L'], price: 299, stock: 10 },
        { specs: ['白色', 'XL'], price: 299, stock: 5 },
        { specs: ['黑色', 'S'], price: 279, stock: 10 },
        { specs: ['黑色', 'M'], price: 279, stock: 15 },
        { specs: ['黑色', 'L'], price: 279, stock: 10 },
        { specs: ['黑色', 'XL'], price: 279, stock: 5 },
        { specs: ['粉色', 'S'], price: 319, stock: 5 },
        { specs: ['粉色', 'M'], price: 319, stock: 8 },
        { specs: ['粉色', 'L'], price: 319, stock: 5 },
        { specs: ['粉色', 'XL'], price: 319, stock: 3 }
      ],
      sales: 156, image: '', description: '优雅气质，修身显瘦', status: 1, createTime: '2024-01-15 10:00:00'
    },
    { id: 6, name: '进口红酒礼盒', code: 'WINE001', categoryId: 3, categoryName: '食品饮料', price: 599, stock: 30, sales: 45, image: '', description: '法国原装进口', status: 1, createTime: '2024-01-15 10:00:00' },
    { id: 7, name: '有机坚果礼盒', code: 'NUTS001', categoryId: 3, categoryName: '食品饮料', price: 168, stock: 200, sales: 320, image: '', description: '精选优质坚果', status: 0, createTime: '2024-01-15 10:00:00' },
    { id: 8, name: '北欧风格沙发', code: 'SOFA001', categoryId: 4, categoryName: '家居用品', price: 2999, stock: 20, sales: 18, image: '', description: '简约设计，舒适体验', status: 1, createTime: '2024-01-15 10:00:00' },
    { id: 9, name: '智能台灯', code: 'LAMP001', categoryId: 4, categoryName: '家居用品', price: 199, stock: 300, sales: 450, image: '', description: '护眼调光，智能控制', status: 1, createTime: '2024-01-15 10:00:00' },
    { id: 10, name: '精华液套装', code: 'SERUM001', categoryId: 5, categoryName: '美妆护肤', price: 799, stock: 60, sales: 230, image: '', description: '深层补水，焕亮肌肤', status: 1, createTime: '2024-01-15 10:00:00' }
  ]

  localStorage.setItem('mock_products', JSON.stringify(defaultProducts))
  return defaultProducts.map(p => ({ ...p, starred: false }))
}

const loadData = () => {
  loading.value = true

  setTimeout(() => {
    let products = initProducts()

    if (searchForm.keyword) {
      const keyword = searchForm.keyword.toLowerCase()
      products = products.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.code.toLowerCase().includes(keyword)
      )
    }
    if (searchForm.categoryId) {
      products = products.filter(p => p.categoryId === searchForm.categoryId)
    }
    if (searchForm.status !== null && searchForm.status !== '') {
      products = products.filter(p => p.status === searchForm.status)
    }
    if (searchForm.starredOnly) {
      products = products.filter(p => p.starred)
    }

    pagination.total = products.length

    const start = (pagination.page - 1) * pagination.size
    tableData.value = products.slice(start, start + pagination.size)

    loading.value = false
  }, 300)
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.categoryId = null
  searchForm.status = null
  searchForm.starredOnly = false
  handleSearch()
}

const toggleStar = (product) => {
  const starred = getStarredProducts()
  const index = starred.indexOf(product.id)
  if (index > -1) {
    starred.splice(index, 1)
    ElMessage.info('已取消收藏')
  } else {
    starred.push(product.id)
    ElMessage.success('已收藏')
  }
  saveStarredProducts(starred)
  loadData()
}

const startAddSpecValue = (specIndex) => {
  addingSpec.value[specIndex] = true
  newSpecValues.value[specIndex] = ''
}

const confirmAddSpecValue = (specIndex) => {
  if (newSpecValues.value[specIndex]) {
    sku.addSpecValue(specIndex, newSpecValues.value[specIndex])
  }
  addingSpec.value[specIndex] = false
  newSpecValues.value[specIndex] = ''
}

const openDialog = (product = null) => {
  editingProduct.value = product
  if (product) {
    Object.assign(form, product)
    sku.loadFromProduct(product)
  } else {
    form.name = ''
    form.code = ''
    form.categoryId = null
    form.description = ''
    form.status = 1
    sku.reset()
  }
  dialogVisible.value = true
}

const openHistoryDialog = (product) => {
  const history = getProductHistory()
  currentHistory.value = history[product.id] || []
  historyDialogVisible.value = true
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true

  setTimeout(() => {
    const products = initProducts()
    const category = categories.value.find(c => c.id === form.categoryId)
    const skuData = sku.exportData()

    if (editingProduct.value) {
      const index = products.findIndex(p => p.id === editingProduct.value.id)
      if (index > -1) {
        const oldProduct = { ...products[index] }
        const newProductData = {
          ...products[index],
          ...form,
          ...skuData,
          categoryName: category?.name || ''
        }
        products[index] = newProductData
        const basicChanges = compareChanges(oldProduct, form)
        const detail = basicChanges.length > 0
          ? `修改了商品「${form.name}」的${basicChanges.map(c => c.fieldName).join('、')}字段`
          : `修改了商品「${form.name}」的SKU信息`
        addHistory(editingProduct.value.id, '编辑商品', detail, basicChanges)
      }
      ElMessage.success('商品更新成功')
    } else {
      const newProduct = {
        id: Date.now(),
        ...form,
        ...skuData,
        categoryName: category?.name || '',
        sales: 0,
        createTime: new Date().toLocaleString()
      }
      products.unshift(newProduct)
      addHistory(newProduct.id, '新增商品', `创建了商品「${form.name}」`)
      ElMessage.success('商品添加成功')
    }

    const plainProducts = products.map(({ starred, ...rest }) => rest)
    localStorage.setItem('mock_products', JSON.stringify(plainProducts))
    dialogVisible.value = false
    submitting.value = false
    loadData()
  }, 500)
}

const toggleStatus = (product) => {
  const action = product.status === 1 ? '下架' : '上架'
  ElMessageBox.confirm(`确定要${action}「${product.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const products = initProducts()
    const index = products.findIndex(p => p.id === product.id)
    if (index > -1) {
      products[index].status = product.status === 1 ? 0 : 1
      addHistory(product.id, `${action}商品`, `将商品「${product.name}」${action}`)
      const plainProducts = products.map(({ starred, ...rest }) => rest)
      localStorage.setItem('mock_products', JSON.stringify(plainProducts))
      ElMessage.success(`${action}成功`)
      loadData()
    }
  }).catch(() => {})
}

const handleDelete = (product) => {
  ElMessageBox.confirm(`确定要删除「${product.name}」吗？删除后不可恢复。`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    let products = initProducts()
    products = products.filter(p => p.id !== product.id)
    const plainProducts = products.map(({ starred, ...rest }) => rest)
    localStorage.setItem('mock_products', JSON.stringify(plainProducts))
    ElMessage.success('删除成功')
    loadData()
  }).catch(() => {})
}

const downloadTemplate = () => {
  const sampleData = [
    { '商品名称': '示例商品A', '商品编码': 'SKU001', '分类ID': 1, '价格': 99, '库存': 100, '描述': '这是示例商品', '状态(1上架0下架)': 1 }
  ]
  const csv = toCSV(productTemplateHeadersCN, sampleData)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '商品导入模板.csv'
  link.click()
  ElMessage.success('模板下载成功')
}

const handleImport = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target.result
    const { data, errors: parseErrors } = parseCSV(content)

    importErrors.value = [...parseErrors]
    importSuccess.value = 0

    const products = initProducts()
    const category = categories.value[0]

    data.forEach(row => {
      const validation = validateProductRow(row)
      if (!validation.valid) {
        importErrors.value.push({
          row: row.row,
          message: validation.errors.join('；')
        })
        return
      }

      const newProduct = {
        id: Date.now() + Math.random(),
        name: row.data.name,
        code: row.data.code,
        categoryId: parseInt(row.data.categoryId) || 1,
        categoryName: categories.value.find(c => c.id === parseInt(row.data.categoryId))?.name || category?.name || '',
        price: parseFloat(row.data.price) || 0,
        stock: parseInt(row.data.stock) || 0,
        sales: 0,
        description: row.data.description || '',
        status: parseInt(row.data.status) === 0 ? 0 : 1,
        image: '',
        createTime: new Date().toLocaleString()
      }
      products.unshift(newProduct)
      addHistory(newProduct.id, '批量导入', `通过CSV导入创建了商品「${newProduct.name}」`)
      importSuccess.value++
    })

    const plainProducts = products.map(({ starred, ...rest }) => rest)
    localStorage.setItem('mock_products', JSON.stringify(plainProducts))
    importDialogVisible.value = true
    loadData()
  }
  reader.readAsText(file)
  return false
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.product-list {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #d1d5db;
  transition: color 0.2s;

  &.starred {
    color: #fbbf24;
    fill: #fbbf24;
  }

  &:hover {
    color: #fbbf24;
  }
}

.table-container {
  margin-top: 0;
}

.price {
  font-weight: 600;
  color: #ef4444;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 20px;
}

.table-actions {
  display: flex;
  gap: 4px;
}

.spec-definition {
  width: 100%;
}

.spec-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.spec-label {
  font-weight: 500;
  min-width: 50px;
}

.spec-value-tag {
  margin-right: 4px;
}

.history-content {
  .history-header {
    margin-bottom: 4px;
  }
  .history-operator {
    font-weight: 600;
    color: #409eff;
    margin-right: 8px;
  }
  .history-action {
    font-weight: 500;
  }
  .history-detail {
    margin: 4px 0 8px 0;
    color: #666;
    font-size: 14px;
  }
  .history-changes {
    background: #f5f7fa;
    border-radius: 4px;
    padding: 8px 12px;
  }
  .change-item {
    display: flex;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;

    & + & {
      border-top: 1px dashed #e4e7ed;
    }
  }
  .change-field {
    font-weight: 500;
    color: #606266;
    min-width: 80px;
  }
  .change-old {
    color: #909399;
    text-decoration: line-through;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .change-arrow {
    color: #409eff;
    margin: 0 8px;
    font-size: 12px;
  }
  .change-new {
    color: #67c23a;
    font-weight: 500;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.el-dialog__body) {
  padding-top: 16px;
}
</style>
