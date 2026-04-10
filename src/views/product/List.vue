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
        @change="handleSearch"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
      <div style="flex: 1"></div>
      <el-button :icon="Download" @click="downloadTemplate">下载导入模板</el-button>
      <el-button :icon="Upload" @click="openImportDialog">批量导入</el-button>
      <el-button type="primary" :icon="Plus" @click="openDialog()">添加商品</el-button>
    </div>

    <div class="table-container card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="收藏" width="60" align="center">
          <template #default="{ row }">
            <el-icon
              class="star-icon"
              :class="{ starred: isStarred(row.id) }"
              @click="handleToggleStar(row)"
            >
              <StarFilled v-if="isStarred(row.id)" />
              <Star v-else />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="code" label="商品编码" width="120" />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column label="价格" width="140">
          <template #default="{ row }">
            <span class="price">{{ getPriceDisplay(row) }}</span>
            <el-tag v-if="row.skus && row.skus.length > 1" size="small" type="info" style="margin-left: 4px">
              {{ row.skus.length }}规格
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">
            {{ getStockDisplay(row) }}
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
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
              <el-button type="info" link @click="openHistoryDialog(row)">历史</el-button>
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
        
        <el-divider content-position="left">SKU 规格</el-divider>
        
        <el-form-item label="规格配置">
          <div class="sku-config">
            <div class="spec-selector">
              <el-select
                v-model="selectedSpecIds"
                multiple
                placeholder="选择规格类型"
                style="width: 300px"
                @change="handleSpecChange"
              >
                <el-option
                  v-for="spec in specOptions"
                  :key="spec.id"
                  :label="spec.name"
                  :value="spec.id"
                />
              </el-select>
              <el-button
                type="primary"
                :disabled="selectedSpecIds.length === 0"
                @click="generateSkus"
              >
                生成 SKU
              </el-button>
            </div>
            
            <div v-if="selectedSpecs.length > 0" class="spec-values">
              <div v-for="spec in selectedSpecs" :key="spec.id" class="spec-value-item">
                <span class="spec-name">{{ spec.name }}:</span>
                <el-select
                  v-model="spec.selectedValues"
                  multiple
                  placeholder="选择规格值"
                  style="width: 200px"
                >
                  <el-option
                    v-for="value in spec.values"
                    :key="value"
                    :label="value"
                    :value="value"
                  />
                </el-select>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="form.skus && form.skus.length > 0" label="SKU 列表">
          <div class="sku-table-wrapper">
            <el-table :data="form.skus" border size="small" max-height="300">
              <el-table-column label="规格" min-width="120">
                <template #default="{ row }">
                  {{ formatSkuSpecs(row.specs) }}
                </template>
              </el-table-column>
              <el-table-column label="SKU编码" width="150">
                <template #default="{ row }">
                  <el-input v-model="row.code" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="价格" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.price"
                    :min="0"
                    :precision="2"
                    size="small"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="100">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.stock"
                    :min="0"
                    size="small"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row, $index }">
                  <el-button
                    type="danger"
                    link
                    size="small"
                    @click="removeSku($index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
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

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入商品"
      width="700px"
      destroy-on-close
    >
      <div class="import-container">
        <el-upload
          ref="uploadRef"
          drag
          accept=".csv"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将 CSV 文件拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              只能上传 CSV 文件，请先下载模板查看格式
            </div>
          </template>
        </el-upload>

        <div v-if="importResult" class="import-result">
          <el-alert
            :title="`解析完成：成功 ${importResult.validRows.length} 条，失败 ${importResult.invalidRows.length} 条`"
            :type="importResult.invalidRows.length > 0 ? 'warning' : 'success'"
            :closable="false"
            show-icon
          />

          <div v-if="importResult.invalidRows.length > 0" class="error-list">
            <h4>错误详情：</h4>
            <el-table :data="importResult.invalidRows" border size="small" max-height="300">
              <el-table-column prop="lineNumber" label="行号" width="80" />
              <el-table-column label="数据" min-width="200">
                <template #default="{ row }">
                  {{ row.data['商品名称'] || '-' }} / {{ row.data['商品编码'] || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="错误信息" min-width="200">
                <template #default="{ row }">
                  <ul class="error-messages">
                    <li v-for="(error, index) in row.errors" :key="index">{{ error }}</li>
                  </ul>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-if="importResult.validRows.length > 0" class="preview-list">
            <h4>待导入数据预览：</h4>
            <el-table :data="importResult.validRows.slice(0, 5)" border size="small">
              <el-table-column label="商品名称" prop="data.商品名称" min-width="120" />
              <el-table-column label="编码" prop="data.商品编码" width="100" />
              <el-table-column label="分类" prop="data.商品分类" width="100" />
              <el-table-column label="价格" prop="data.价格" width="80" />
              <el-table-column label="库存" prop="data.库存" width="80" />
            </el-table>
            <p v-if="importResult.validRows.length > 5" class="more-hint">
              还有 {{ importResult.validRows.length - 5 }} 条数据...
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!importResult || importResult.validRows.length === 0"
          @click="executeImport"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="historyDialogVisible"
      title="操作历史"
      width="600px"
      destroy-on-close
    >
      <div v-if="currentHistoryProduct" class="history-header">
        <span>商品：{{ currentHistoryProduct.name }}</span>
        <span class="code">编码：{{ currentHistoryProduct.code }}</span>
      </div>
      
      <div v-if="productHistory.length === 0" class="no-history">
        暂无操作历史
      </div>
      
      <div v-else class="history-timeline">
        <el-timeline>
          <el-timeline-item
            v-for="record in productHistory"
            :key="record.id"
            :timestamp="record.createTime"
            :type="getActionType(record.action)"
            placement="top"
          >
            <el-card shadow="hover">
              <div class="history-item">
                <div class="history-action">
                  <el-tag :type="getActionType(record.action)" size="small">
                    {{ getActionLabel(record.action) }}
                  </el-tag>
                  <span class="operator">操作人：{{ record.operatorName }}</span>
                </div>
                <div v-if="record.details" class="history-details">
                  {{ formatHistoryDetails(record) }}
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Star, StarFilled, Download, Upload, UploadFilled } from '@element-plus/icons-vue'
import { useSku } from '@/composables/useSku'
import { useCsv } from '@/composables/useCsv'
import { useHistory } from '@/composables/useHistory'
import { useStar } from '@/composables/useStar'

const {
  specOptions,
  generateSkuId,
  generateSkuCode,
  generateSkusFromSpecs,
  calculatePriceRange,
  calculateTotalStock,
  validateSkus,
  formatSkuSpecs
} = useSku()

const {
  parseCSV,
  validateProductImport,
  convertRowToProduct,
  generateImportTemplate,
  downloadCSV
} = useCsv()

const {
  addHistory,
  getProductHistory,
  getActionLabel,
  getActionType,
  formatHistoryDetails
} = useHistory()

const {
  toggleStar,
  isStarred
} = useStar()

const loading = ref(false)
const submitting = ref(false)
const importing = ref(false)

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
const editingProduct = ref(null)
const formRef = ref(null)

const selectedSpecIds = ref([])
const selectedSpecs = ref([])

const form = reactive({
  name: '',
  code: '',
  categoryId: null,
  image: '',
  description: '',
  status: 1,
  skus: []
})

const rules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 100, message: '商品名称不能超过100个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入商品编码', trigger: 'blur' }
  ],
  categoryId: [
    { required: true, message: '请选择商品分类', trigger: 'change' }
  ]
}

const importDialogVisible = ref(false)
const uploadRef = ref(null)
const importResult = ref(null)

const historyDialogVisible = ref(false)
const currentHistoryProduct = ref(null)
const productHistory = ref([])

const initProducts = () => {
  const stored = localStorage.getItem('mock_products')
  if (stored) {
    return JSON.parse(stored)
  }

  const defaultProducts = [
    { 
      id: 1, 
      name: 'iPhone 15 Pro Max', 
      code: 'IPHONE15PM', 
      categoryId: 1, 
      categoryName: '电子产品', 
      price: 9999, 
      stock: 100, 
      sales: 256, 
      image: '', 
      description: '苹果最新旗舰手机', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: [
        { id: 'sku_1', code: 'IPHONE15PM_黑色_256GB', specs: { color: '黑色', storage: '256GB' }, price: 9999, stock: 50, status: 1 },
        { id: 'sku_2', code: 'IPHONE15PM_白色_256GB', specs: { color: '白色', storage: '256GB' }, price: 9999, stock: 30, status: 1 },
        { id: 'sku_3', code: 'IPHONE15PM_黑色_512GB', specs: { color: '黑色', storage: '512GB' }, price: 11999, stock: 20, status: 1 }
      ]
    },
    { 
      id: 2, 
      name: 'MacBook Pro 14"', 
      code: 'MBP14', 
      categoryId: 1, 
      categoryName: '电子产品', 
      price: 14999, 
      stock: 50, 
      sales: 128, 
      image: '', 
      description: 'M3 Pro芯片，强劲性能', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 3, 
      name: 'AirPods Pro 2', 
      code: 'AIRPODSPRO2', 
      categoryId: 1, 
      categoryName: '电子产品', 
      price: 1899, 
      stock: 200, 
      sales: 512, 
      image: '', 
      description: '主动降噪，空间音频', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 4, 
      name: '男士休闲夹克', 
      code: 'JACKET001', 
      categoryId: 2, 
      categoryName: '服装鞋包', 
      price: 399, 
      stock: 150, 
      sales: 89, 
      image: '', 
      description: '时尚简约，舒适百搭', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: [
        { id: 'sku_4', code: 'JACKET001_黑色_M', specs: { color: '黑色', size: 'M' }, price: 399, stock: 50, status: 1 },
        { id: 'sku_5', code: 'JACKET001_黑色_L', specs: { color: '黑色', size: 'L' }, price: 399, stock: 40, status: 1 },
        { id: 'sku_6', code: 'JACKET001_蓝色_M', specs: { color: '蓝色', size: 'M' }, price: 399, stock: 30, status: 1 },
        { id: 'sku_7', code: 'JACKET001_蓝色_L', specs: { color: '蓝色', size: 'L' }, price: 399, stock: 30, status: 1 }
      ]
    },
    { 
      id: 5, 
      name: '女士连衣裙', 
      code: 'DRESS001', 
      categoryId: 2, 
      categoryName: '服装鞋包', 
      price: 299, 
      stock: 80, 
      sales: 156, 
      image: '', 
      description: '优雅气质，修身显瘦', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 6, 
      name: '进口红酒礼盒', 
      code: 'WINE001', 
      categoryId: 3, 
      categoryName: '食品饮料', 
      price: 599, 
      stock: 30, 
      sales: 45, 
      image: '', 
      description: '法国原装进口', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 7, 
      name: '有机坚果礼盒', 
      code: 'NUTS001', 
      categoryId: 3, 
      categoryName: '食品饮料', 
      price: 168, 
      stock: 200, 
      sales: 320, 
      image: '', 
      description: '精选优质坚果', 
      status: 0, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 8, 
      name: '北欧风格沙发', 
      code: 'SOFA001', 
      categoryId: 4, 
      categoryName: '家居用品', 
      price: 2999, 
      stock: 20, 
      sales: 18, 
      image: '', 
      description: '简约设计，舒适体验', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 9, 
      name: '智能台灯', 
      code: 'LAMP001', 
      categoryId: 4, 
      categoryName: '家居用品', 
      price: 199, 
      stock: 300, 
      sales: 450, 
      image: '', 
      description: '护眼调光，智能控制', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    },
    { 
      id: 10, 
      name: '精华液套装', 
      code: 'SERUM001', 
      categoryId: 5, 
      categoryName: '美妆护肤', 
      price: 799, 
      stock: 60, 
      sales: 230, 
      image: '', 
      description: '深层补水，焕亮肌肤', 
      status: 1, 
      createTime: '2024-01-15 10:00:00',
      skus: []
    }
  ]

  localStorage.setItem('mock_products', JSON.stringify(defaultProducts))
  return defaultProducts
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
      const starredIds = new Set(JSON.parse(localStorage.getItem('mock_product_stars') || '[]'))
      products = products.filter(p => starredIds.has(p.id))
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

const openDialog = (product = null) => {
  editingProduct.value = product
  selectedSpecIds.value = []
  selectedSpecs.value = []
  
  if (product) {
    Object.assign(form, {
      name: product.name,
      code: product.code,
      categoryId: product.categoryId,
      image: product.image || '',
      description: product.description || '',
      status: product.status,
      skus: product.skus ? JSON.parse(JSON.stringify(product.skus)) : []
    })
    
    if (product.skus && product.skus.length > 0) {
      const specMap = {}
      product.skus.forEach(sku => {
        if (sku.specs) {
          Object.entries(sku.specs).forEach(([key, value]) => {
            if (!specMap[key]) {
              specMap[key] = new Set()
            }
            specMap[key].add(value)
          })
        }
      })
      
      selectedSpecIds.value = Object.keys(specMap)
      selectedSpecs.value = selectedSpecIds.value.map(specId => {
        const specDef = specOptions.value.find(s => s.id === specId)
        return {
          ...specDef,
          selectedValues: [...specMap[specId]]
        }
      })
    }
  } else {
    Object.assign(form, {
      name: '',
      code: '',
      categoryId: null,
      image: '',
      description: '',
      status: 1,
      skus: []
    })
  }
  dialogVisible.value = true
}

const handleSpecChange = (specIds) => {
  selectedSpecs.value = specIds.map(specId => {
    const spec = specOptions.value.find(s => s.id === specId)
    const existing = selectedSpecs.value.find(s => s.id === specId)
    return {
      ...spec,
      selectedValues: existing?.selectedValues || []
    }
  })
}

const generateSkus = () => {
  const validSpecs = selectedSpecs.value.filter(s => s.selectedValues && s.selectedValues.length > 0)
  
  if (validSpecs.length === 0) {
    ElMessage.warning('请先选择规格值')
    return
  }

  const specsForGeneration = validSpecs.map(s => ({
    id: s.id,
    values: s.selectedValues
  }))

  const newSkus = generateSkusFromSpecs(form.code, specsForGeneration)
  
  const existingCodes = new Set(form.skus.map(s => s.code))
  newSkus.forEach(sku => {
    if (!existingCodes.has(sku.code)) {
      form.skus.push(sku)
    }
  })
  
  ElMessage.success(`生成了 ${newSkus.length} 个 SKU`)
}

const removeSku = (index) => {
  form.skus.splice(index, 1)
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (form.skus && form.skus.length > 0) {
    const skuErrors = validateSkus(form.skus)
    if (skuErrors.length > 0) {
      ElMessage.error(skuErrors[0])
      return
    }
  }

  submitting.value = true

  setTimeout(() => {
    const products = initProducts()
    const category = categories.value.find(c => c.id === form.categoryId)

    if (editingProduct.value) {
      const index = products.findIndex(p => p.id === editingProduct.value.id)
      if (index > -1) {
        const oldProduct = products[index]
        const changes = []
        
        if (oldProduct.name !== form.name) {
          changes.push({ name: '商品名称', oldValue: oldProduct.name, newValue: form.name })
        }
        if (oldProduct.code !== form.code) {
          changes.push({ name: '商品编码', oldValue: oldProduct.code, newValue: form.code })
        }
        if (oldProduct.categoryId !== form.categoryId) {
          changes.push({ name: '商品分类', oldValue: oldProduct.categoryName, newValue: category?.name })
        }
        if (oldProduct.status !== form.status) {
          changes.push({ name: '状态', oldValue: oldProduct.status === 1 ? '上架' : '下架', newValue: form.status === 1 ? '上架' : '下架' })
        }
        
        products[index] = {
          ...products[index],
          ...form,
          categoryName: category?.name || '',
          skus: form.skus
        }
        
        if (changes.length > 0) {
          addHistory(editingProduct.value.id, 'update', { fields: changes })
        }
      }
      ElMessage.success('商品更新成功')
    } else {
      const newProduct = {
        id: Date.now(),
        ...form,
        categoryName: category?.name || '',
        sales: 0,
        createTime: new Date().toLocaleString(),
        skus: form.skus
      }
      products.unshift(newProduct)
      addHistory(newProduct.id, 'create', `创建商品：${newProduct.name}`)
      ElMessage.success('商品添加成功')
    }

    localStorage.setItem('mock_products', JSON.stringify(products))
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
      localStorage.setItem('mock_products', JSON.stringify(products))
      addHistory(product.id, product.status === 1 ? 'status_off' : 'status_on', `${action}商品`)
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
    localStorage.setItem('mock_products', JSON.stringify(products))
    addHistory(product.id, 'delete', `删除商品：${product.name}`)
    ElMessage.success('删除成功')
    loadData()
  }).catch(() => {})
}

const handleToggleStar = (product) => {
  const isNowStarred = toggleStar(product.id)
  addHistory(product.id, isNowStarred ? 'star_add' : 'star_remove', isNowStarred ? '添加收藏' : '取消收藏')
  ElMessage.success(isNowStarred ? '已添加收藏' : '已取消收藏')
}

const getPriceDisplay = (product) => {
  if (product.skus && product.skus.length > 0) {
    const priceRange = calculatePriceRange(product.skus)
    return priceRange.display
  }
  return `¥${(product.price || 0).toFixed(2)}`
}

const getStockDisplay = (product) => {
  if (product.skus && product.skus.length > 0) {
    return calculateTotalStock(product.skus)
  }
  return product.stock || 0
}

const downloadTemplate = () => {
  const content = generateImportTemplate()
  downloadCSV(content, '商品导入模板.csv')
  ElMessage.success('模板下载成功')
}

const openImportDialog = () => {
  importResult.value = null
  importDialogVisible.value = true
}

const handleFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      const { headers, rows, errors } = parseCSV(content)
      
      if (errors.length > 0) {
        ElMessage.error(`CSV 解析错误：${errors[0].error}`)
        return
      }

      const products = initProducts()
      const result = validateProductImport(rows, categories.value, products)
      importResult.value = result
      
      if (result.validRows.length === 0) {
        ElMessage.warning('没有有效的数据可以导入')
      }
    } catch (error) {
      ElMessage.error('文件解析失败：' + error.message)
    }
  }
  reader.readAsText(file.raw)
}

const executeImport = () => {
  if (!importResult.value || importResult.value.validRows.length === 0) return

  importing.value = true

  setTimeout(() => {
    const products = initProducts()
    
    importResult.value.validRows.forEach(row => {
      const product = convertRowToProduct(row.data, categories.value)
      products.unshift(product)
      addHistory(product.id, 'import', `批量导入：${product.name}`)
    })

    localStorage.setItem('mock_products', JSON.stringify(products))
    importing.value = false
    importDialogVisible.value = false
    ElMessage.success(`成功导入 ${importResult.value.validRows.length} 条商品`)
    loadData()
  }, 500)
}

const openHistoryDialog = (product) => {
  currentHistoryProduct.value = product
  productHistory.value = getProductHistory(product.id)
  historyDialogVisible.value = true
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

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #c0c4cc;
  transition: all 0.3s;

  &:hover {
    color: #f7ba2a;
    transform: scale(1.2);
  }

  &.starred {
    color: #f7ba2a;
  }
}

.sku-config {
  width: 100%;

  .spec-selector {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .spec-values {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .spec-value-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .spec-name {
        font-weight: 500;
        color: #606266;
      }
    }
  }
}

.sku-table-wrapper {
  width: 100%;
}

.import-container {
  .import-result {
    margin-top: 20px;

    .error-list,
    .preview-list {
      margin-top: 16px;

      h4 {
        margin-bottom: 12px;
        font-weight: 500;
      }
    }

    .error-messages {
      margin: 0;
      padding-left: 16px;
      color: #f56c6c;
      font-size: 12px;
    }

    .more-hint {
      margin-top: 8px;
      color: #909399;
      font-size: 12px;
    }
  }
}

.history-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;

  .code {
    color: #909399;
  }
}

.no-history {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}

.history-timeline {
  max-height: 500px;
  overflow-y: auto;
}

.history-item {
  .history-action {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;

    .operator {
      color: #909399;
      font-size: 12px;
    }
  }

  .history-details {
    color: #606266;
    font-size: 13px;
    line-height: 1.6;
  }
}

:deep(.el-dialog__body) {
  padding-top: 16px;
}
</style>
