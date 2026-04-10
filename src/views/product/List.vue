<template>
  <div class="product-list">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">商品列表</h1>
      <p class="page-desc">管理平台中的所有商品信息</p>
    </div>

    <!-- 搜索和筛选 -->
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
        v-model="searchForm.onlyStarred"
        active-text="仅看收藏"
        style="margin-left: 12px"
        @change="handleSearch"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
      <div style="flex: 1"></div>
      <el-button :icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
      <el-button :icon="Upload" @click="importDialogVisible = true">批量导入</el-button>
      <el-button type="primary" :icon="Plus" @click="openDialog()">添加商品</el-button>
    </div>

    <!-- 商品表格 -->
    <div class="table-container card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column width="50">
          <template #default="{ row }">
            <el-button
              link
              :icon="row.isStarred ? StarFilled : Star"
              :class="['star-btn', { starred: row.isStarred }]"
              @click="toggleStar(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="code" label="商品编码" width="110" />
        <el-table-column prop="categoryName" label="分类" width="90" />
        <el-table-column label="价格" width="130">
          <template #default="{ row }">
            <span class="price">{{ formatPrice(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="80">
          <template #default="{ row }">
            <span>{{ formatStock(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="70" />
        <el-table-column prop="status" label="状态" width="70">
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

      <!-- 分页 -->
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

    <!-- 添加/编辑商品弹窗 -->
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

        <!-- SKU 规格配置 -->
        <el-divider content-position="left">规格配置</el-divider>

        <div class="sku-section">
          <!-- 规格定义 -->
          <div class="spec-definitions">
            <div v-for="(spec, specIndex) in skuData.specs" :key="specIndex" class="spec-item">
              <div class="spec-header">
                <span class="spec-name">{{ spec.name }}</span>
                <el-button type="danger" link size="small" @click="removeSpec(specIndex)">
                  删除
                </el-button>
              </div>
              <div class="spec-values">
                <el-tag
                  v-for="(value, valIndex) in spec.values"
                  :key="valIndex"
                  closable
                  @close="removeSpecValue(specIndex, valIndex)"
                  class="spec-value-tag"
                >
                  {{ value }}
                </el-tag>
                <el-input
                  v-model="specValueInputs[specIndex]"
                  placeholder="输入规格值"
                  size="small"
                  style="width: 100px"
                  @keyup.enter="addSpecValue(specIndex, specValueInputs[specIndex])"
                >
                  <template #append>
                    <el-button @click="addSpecValue(specIndex, specValueInputs[specIndex])">
                      添加
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <!-- 添加规格 -->
            <div class="add-spec">
              <el-input
                v-model="newSpecName"
                placeholder="输入规格名称（如：颜色、尺码）"
                style="width: 200px"
                @keyup.enter="addSpec"
              >
                <template #append>
                  <el-button :icon="Plus" @click="addSpec">添加规格</el-button>
                </template>
              </el-input>
            </div>
          </div>

          <!-- SKU 表格 -->
          <div v-if="skuData.skus.length > 0" class="sku-table-wrapper">
            <div class="sku-batch-actions">
              <span class="batch-label">批量设置：</span>
              <el-input-number
                v-model="batchPrice"
                :min="0"
                :precision="2"
                placeholder="价格"
                size="small"
                style="width: 120px"
              />
              <el-button size="small" @click="batchSetPrice(batchPrice)">应用价格</el-button>
              <el-input-number
                v-model="batchStock"
                :min="0"
                placeholder="库存"
                size="small"
                style="width: 100px; margin-left: 8px"
              />
              <el-button size="small" @click="batchSetStock(batchStock)">应用库存</el-button>
            </div>

            <el-table :data="skuData.skus" size="small" border max-height="300">
              <el-table-column
                v-for="(spec, idx) in skuData.specs"
                :key="idx"
                :label="spec.name"
                width="100"
              >
                <template #default="{ row }">
                  {{ row.specCombo[idx] }}
                </template>
              </el-table-column>
              <el-table-column label="SKU编码" width="120">
                <template #default="{ row }">
                  <el-input v-model="row.skuCode" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="价格" width="120">
                <template #default="{ $index }">
                  <el-input-number
                    v-model="skuData.skus[$index].price"
                    :min="0"
                    :precision="2"
                    size="small"
                    style="width: 100px"
                  />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="100">
                <template #default="{ $index }">
                  <el-input-number
                    v-model="skuData.skus[$index].stock"
                    :min="0"
                    size="small"
                    style="width: 80px"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-else-if="skuData.specs.length > 0" class="sku-empty">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                请为规格添加值以生成 SKU 组合
              </template>
            </el-alert>
          </div>

          <div v-else class="sku-empty">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                添加规格（如颜色、尺码）来配置多规格 SKU
              </template>
            </el-alert>
          </div>
        </div>

        <el-divider />

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

    <!-- CSV 导入弹窗 -->
    <el-dialog
      v-model="importDialogVisible"
      title="批量导入商品"
      width="600px"
      destroy-on-close
    >
      <div class="import-section">
        <el-upload
          ref="uploadRef"
          accept=".csv"
          :auto-upload="false"
          :on-change="handleFileChange"
          :show-file-list="false"
          drag
          class="upload-area"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽 CSV 文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              请使用 <el-button link type="primary" @click.stop="handleDownloadTemplate">导入模板</el-button> 格式
            </div>
          </template>
        </el-upload>

        <!-- 导入结果 -->
        <div v-if="importResult.show" class="import-result">
          <el-alert
            :type="importResult.success ? 'success' : 'error'"
            :closable="false"
            show-icon
          >
            <template #title>
              {{ importResult.message }}
            </template>
          </el-alert>

          <!-- 错误列表 -->
          <div v-if="importResult.errors.length > 0" class="error-list">
            <div class="error-header">
              <span>错误详情（共 {{ importResult.errors.length }} 行）</span>
              <el-button type="primary" link size="small" @click="downloadErrorReport">
                下载错误报告
              </el-button>
            </div>
            <el-table :data="importResult.errors" size="small" max-height="250" border>
              <el-table-column prop="row" label="行号" width="70" />
              <el-table-column label="错误信息">
                <template #default="{ row }">
                  <div class="error-messages">
                    <el-tag
                      v-for="(err, idx) in row.errors"
                      :key="idx"
                      type="danger"
                      size="small"
                      class="error-tag"
                    >
                      {{ err }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="handleImport">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 历史记录弹窗 -->
    <el-dialog
      v-model="historyDialogVisible"
      title="操作历史"
      width="700px"
      destroy-on-close
    >
      <div v-if="currentHistory.length === 0" class="history-empty">
        <el-empty description="暂无操作记录" />
      </div>
      <el-timeline v-else class="history-timeline">
        <el-timeline-item
          v-for="record in currentHistory"
          :key="record.id"
          :type="getActionTypeStyle(record.action).type"
          :icon="getIconComponent(getActionTypeStyle(record.action).icon)"
          :timestamp="formatTime(record.timestamp)"
        >
          <div class="history-item">
            <div class="history-header">
              <el-tag :type="getActionTypeStyle(record.action).type" size="small">
                {{ record.actionName }}
              </el-tag>
              <span class="history-operator">{{ record.operator }}</span>
            </div>
            <div class="history-content">{{ record.remark }}</div>
            <div v-if="record.changes && record.changes.length > 0" class="history-changes">
              <div
                v-for="(change, idx) in record.changes"
                :key="idx"
                class="change-item"
              >
                <span class="change-field">{{ change.fieldName }}:</span>
                <span class="change-old">{{ change.oldValue }}</span>
                <el-icon class="change-arrow"><arrow-right /></el-icon>
                <span class="change-new">{{ change.newValue }}</span>
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  Plus,
  Star,
  StarFilled,
  Download,
  Upload,
  UploadFilled,
  ArrowRight,
  Edit,
  Delete,
  Switch,
  InfoFilled
} from '@element-plus/icons-vue'
import { useSku } from '@/composables/useSku'
import { useCsvImport } from '@/composables/useCsvImport'
import { useProductHistory } from '@/composables/useProductHistory'

// SKU Composable
const {
  specs: skuSpecs,
  skus: skuSkus,
  newSpecName,
  specValueInputs,
  addSpec: skuAddSpec,
  removeSpec: skuRemoveSpec,
  addSpecValue: skuAddSpecValue,
  removeSpecValue: skuRemoveSpecValue,
  batchSetPrice: skuBatchSetPrice,
  batchSetStock: skuBatchSetStock,
  validateSkus: validateSkuData,
  getSaveData: getSkuSaveData,
  loadData: loadSkuData,
  reset: resetSku
} = useSku()

// CSV Import Composable
const {
  importCsv,
  downloadTemplate,
  downloadErrorReport: downloadCsvErrorReport
} = useCsvImport()

// Product History Composable
const {
  getHistory,
  recordCreate,
  recordUpdate,
  recordStatusChange,
  recordDelete,
  recordImport,
  getActionTypeStyle
} = useProductHistory()

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const importing = ref(false)

// 搜索表单
const searchForm = reactive({
  keyword: '',
  categoryId: null,
  status: null,
  onlyStarred: false
})

// 分页
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

// 分类数据
const categories = ref([
  { id: 1, name: '电子产品' },
  { id: 2, name: '服装鞋包' },
  { id: 3, name: '食品饮料' },
  { id: 4, name: '家居用品' },
  { id: 5, name: '美妆护肤' }
])

// 表格数据
const tableData = ref([])

// 收藏数据
const starredProducts = ref([])

// 弹窗相关
const dialogVisible = ref(false)
const editingProduct = ref(null)
const formRef = ref(null)

const form = reactive({
  name: '',
  code: '',
  categoryId: null,
  description: '',
  status: 1
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

// SKU 相关数据
const skuData = reactive({
  specs: skuSpecs,
  skus: skuSkus
})

const batchPrice = ref(0)
const batchStock = ref(0)

// 导入相关
const importDialogVisible = ref(false)
const uploadRef = ref(null)
const currentImportFile = ref(null)
const importResult = reactive({
  show: false,
  success: false,
  message: '',
  errors: []
})

// 历史记录相关
const historyDialogVisible = ref(false)
const currentProduct = ref(null)
const currentHistory = ref([])

// 初始化收藏数据
const initStarredData = () => {
  const stored = localStorage.getItem('mock_starred_products')
  if (stored) {
    starredProducts.value = JSON.parse(stored)
  }
}

// 保存收藏数据
const saveStarredData = () => {
  localStorage.setItem('mock_starred_products', JSON.stringify(starredProducts.value))
}

// 切换收藏状态
const toggleStar = (product) => {
  const index = starredProducts.value.indexOf(product.id)
  if (index > -1) {
    starredProducts.value.splice(index, 1)
    product.isStarred = false
    ElMessage.success('已取消收藏')
  } else {
    starredProducts.value.push(product.id)
    product.isStarred = true
    ElMessage.success('已添加收藏')
  }
  saveStarredData()
}

// 初始化商品数据
const initProducts = () => {
  const stored = localStorage.getItem('mock_products')
  if (stored) {
    return JSON.parse(stored)
  }

  // 默认商品数据（带 SKU）
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
      specs: [],
      skus: []
    },
    {
      id: 2,
      name: '男士休闲T恤',
      code: 'TSHIRT001',
      categoryId: 2,
      categoryName: '服装鞋包',
      price: 0,
      stock: 0,
      sales: 89,
      image: '',
      description: '舒适纯棉T恤',
      status: 1,
      createTime: '2024-01-15 10:00:00',
      specs: [
        { name: '颜色', values: ['白色', '黑色', '蓝色'] },
        { name: '尺码', values: ['M', 'L', 'XL'] }
      ],
      skus: [
        { specCombo: ['白色', 'M'], price: 99, stock: 20, skuCode: 'WHITE-M' },
        { specCombo: ['白色', 'L'], price: 99, stock: 15, skuCode: 'WHITE-L' },
        { specCombo: ['白色', 'XL'], price: 99, stock: 10, skuCode: 'WHITE-XL' },
        { specCombo: ['黑色', 'M'], price: 99, stock: 25, skuCode: 'BLACK-M' },
        { specCombo: ['黑色', 'L'], price: 99, stock: 20, skuCode: 'BLACK-L' },
        { specCombo: ['黑色', 'XL'], price: 99, stock: 15, skuCode: 'BLACK-XL' },
        { specCombo: ['蓝色', 'M'], price: 109, stock: 18, skuCode: 'BLUE-M' },
        { specCombo: ['蓝色', 'L'], price: 109, stock: 12, skuCode: 'BLUE-L' },
        { specCombo: ['蓝色', 'XL'], price: 109, stock: 8, skuCode: 'BLUE-XL' }
      ]
    },
    { id: 3, name: 'MacBook Pro 14"', code: 'MBP14', categoryId: 1, categoryName: '电子产品', price: 14999, stock: 50, sales: 128, image: '', description: 'M3 Pro芯片，强劲性能', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 4, name: 'AirPods Pro 2', code: 'AIRPODSPRO2', categoryId: 1, categoryName: '电子产品', price: 1899, stock: 200, sales: 512, image: '', description: '主动降噪，空间音频', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 5, name: '女士连衣裙', code: 'DRESS001', categoryId: 2, categoryName: '服装鞋包', price: 299, stock: 80, sales: 156, image: '', description: '优雅气质，修身显瘦', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 6, name: '进口红酒礼盒', code: 'WINE001', categoryId: 3, categoryName: '食品饮料', price: 599, stock: 30, sales: 45, image: '', description: '法国原装进口', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 7, name: '有机坚果礼盒', code: 'NUTS001', categoryId: 3, categoryName: '食品饮料', price: 168, stock: 200, sales: 320, image: '', description: '精选优质坚果', status: 0, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 8, name: '北欧风格沙发', code: 'SOFA001', categoryId: 4, categoryName: '家居用品', price: 2999, stock: 20, sales: 18, image: '', description: '简约设计，舒适体验', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 9, name: '智能台灯', code: 'LAMP001', categoryId: 4, categoryName: '家居用品', price: 199, stock: 300, sales: 450, image: '', description: '护眼调光，智能控制', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] },
    { id: 10, name: '精华液套装', code: 'SERUM001', categoryId: 5, categoryName: '美妆护肤', price: 799, stock: 60, sales: 230, image: '', description: '深层补水，焕亮肌肤', status: 1, createTime: '2024-01-15 10:00:00', specs: [], skus: [] }
  ]

  localStorage.setItem('mock_products', JSON.stringify(defaultProducts))
  return defaultProducts
}

// 格式化价格显示
const formatPrice = (product) => {
  if (product.skus && product.skus.length > 0) {
    const prices = product.skus.map(s => s.price).filter(p => p > 0)
    if (prices.length === 0) return '-'
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === max) return `¥${min.toFixed(2)}`
    return `¥${min.toFixed(2)} ~ ¥${max.toFixed(2)}`
  }
  return `¥${product.price?.toFixed(2) || '0.00'}`
}

// 格式化库存显示
const formatStock = (product) => {
  if (product.skus && product.skus.length > 0) {
    return product.skus.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
  }
  return product.stock || 0
}

// 加载数据
const loadData = () => {
  loading.value = true

  setTimeout(() => {
    let products = initProducts()

    // 标记收藏状态
    products = products.map(p => ({
      ...p,
      isStarred: starredProducts.value.includes(p.id)
    }))

    // 筛选
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
    if (searchForm.onlyStarred) {
      products = products.filter(p => p.isStarred)
    }

    pagination.total = products.length

    // 分页
    const start = (pagination.page - 1) * pagination.size
    tableData.value = products.slice(start, start + pagination.size)

    loading.value = false
  }, 300)
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置搜索
const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.categoryId = null
  searchForm.status = null
  searchForm.onlyStarred = false
  handleSearch()
}

// 规格操作
const addSpec = () => {
  if (!newSpecName.value || newSpecName.value.trim() === '') {
    ElMessage.warning('请输入规格名称')
    return
  }
  if (skuSpecs.value.some(s => s.name === newSpecName.value.trim())) {
    ElMessage.warning('该规格已存在')
    return
  }
  skuAddSpec(newSpecName.value)
  newSpecName.value = ''
}

const removeSpec = (index) => {
  skuRemoveSpec(index)
}

const addSpecValue = (specIndex, value) => {
  if (!value || value.trim() === '') {
    ElMessage.warning('请输入规格值')
    return
  }
  const spec = skuSpecs.value[specIndex]
  if (spec.values.includes(value.trim())) {
    ElMessage.warning('该规格值已存在')
    return
  }
  skuAddSpecValue(specIndex, value)
}

const removeSpecValue = (specIndex, valueIndex) => {
  skuRemoveSpecValue(specIndex, valueIndex)
}

const batchSetPrice = (price) => {
  skuBatchSetPrice(price)
  ElMessage.success('批量设置价格成功')
}

const batchSetStock = (stock) => {
  skuBatchSetStock(stock)
  ElMessage.success('批量设置库存成功')
}

// 打开弹窗
const openDialog = (product = null) => {
  editingProduct.value = product
  resetSku()

  if (product) {
    Object.assign(form, {
      name: product.name,
      code: product.code,
      categoryId: product.categoryId,
      description: product.description,
      status: product.status
    })

    // 加载 SKU 数据
    if (product.specs && product.specs.length > 0) {
      loadSkuData({
        specs: product.specs,
        skus: product.skus || []
      })
    }
  } else {
    form.name = ''
    form.code = ''
    form.categoryId = null
    form.description = ''
    form.status = 1
  }
  dialogVisible.value = true
}

// 提交表单
const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  // 如果有规格，验证 SKU
  if (skuSpecs.value.length > 0) {
    const skuValidation = validateSkuData()
    if (!skuValidation.valid) {
      ElMessage.error(skuValidation.errors[0])
      return
    }
  }

  submitting.value = true

  setTimeout(() => {
    const products = initProducts()
    const category = categories.value.find(c => c.id === form.categoryId)
    const skuSaveData = getSkuSaveData()

    if (editingProduct.value) {
      // 编辑
      const index = products.findIndex(p => p.id === editingProduct.value.id)
      if (index > -1) {
        const oldProduct = { ...products[index] }
        const updatedProduct = {
          ...products[index],
          ...form,
          categoryName: category?.name || '',
          specs: skuSaveData.specs,
          skus: skuSaveData.skus
        }

        // 计算价格和库存
        if (skuSaveData.skus.length > 0) {
          const prices = skuSaveData.skus.map(s => s.price).filter(p => p > 0)
          updatedProduct.price = prices.length > 0 ? Math.min(...prices) : 0
          updatedProduct.stock = skuSaveData.skus.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
        }

        products[index] = updatedProduct

        // 记录历史
        recordUpdate(oldProduct.id, oldProduct, updatedProduct, 'admin')
      }
      ElMessage.success('商品更新成功')
    } else {
      // 新增
      const newProduct = {
        id: Date.now(),
        ...form,
        categoryName: category?.name || '',
        sales: 0,
        createTime: new Date().toLocaleString(),
        specs: skuSaveData.specs,
        skus: skuSaveData.skus
      }

      // 计算价格和库存
      if (skuSaveData.skus.length > 0) {
        const prices = skuSaveData.skus.map(s => s.price).filter(p => p > 0)
        newProduct.price = prices.length > 0 ? Math.min(...prices) : 0
        newProduct.stock = skuSaveData.skus.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
      } else {
        newProduct.price = 0
        newProduct.stock = 0
      }

      products.unshift(newProduct)

      // 记录历史
      recordCreate(newProduct.id, newProduct, 'admin')

      ElMessage.success('商品添加成功')
    }

    localStorage.setItem('mock_products', JSON.stringify(products))
    dialogVisible.value = false
    submitting.value = false
    loadData()
  }, 500)
}

// 切换状态
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
      const oldStatus = products[index].status
      const newStatus = oldStatus === 1 ? 0 : 1
      products[index].status = newStatus
      localStorage.setItem('mock_products', JSON.stringify(products))

      // 记录历史
      recordStatusChange(product.id, oldStatus, newStatus, product.name, 'admin')

      ElMessage.success(`${action}成功`)
      loadData()
    }
  }).catch(() => {})
}

// 删除
const handleDelete = (product) => {
  ElMessageBox.confirm(`确定要删除「${product.name}」吗？删除后不可恢复。`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    let products = initProducts()
    products = products.filter(p => p.id !== product.id)
    localStorage.setItem('mock_products', JSON.stringify(products))

    // 记录历史
    recordDelete(product.id, product.name, 'admin')

    ElMessage.success('删除成功')
    loadData()
  }).catch(() => {})
}

// CSV 导入相关
const handleDownloadTemplate = () => {
  downloadTemplate()
}

const handleFileChange = (file) => {
  currentImportFile.value = file.raw
  importResult.show = false
  importResult.errors = []
}

const handleImport = async () => {
  if (!currentImportFile.value) {
    ElMessage.warning('请先选择 CSV 文件')
    return
  }

  importing.value = true
  importResult.show = false

  const result = await importCsv(currentImportFile.value, { categories: categories.value })

  importResult.show = true
  importResult.success = result.success
  importResult.errors = result.errors

  if (result.success) {
    importResult.message = `成功导入 ${result.data.length} 条商品数据`

    // 保存导入的商品
    const products = initProducts()
    result.data.forEach(product => {
      const category = categories.value.find(c => c.id === product.categoryId)
      const newProduct = {
        id: Date.now() + Math.random(),
        ...product,
        categoryName: category?.name || '',
        sales: 0,
        createTime: new Date().toLocaleString(),
        specs: [],
        skus: []
      }
      products.unshift(newProduct)

      // 记录历史
      recordImport(newProduct.id, newProduct, 'admin')
    })
    localStorage.setItem('mock_products', JSON.stringify(products))

    // 刷新列表
    loadData()

    // 清空文件
    currentImportFile.value = null
    if (uploadRef.value) {
      uploadRef.value.clearFiles()
    }
  } else {
    importResult.message = `导入失败，发现 ${result.errors.length} 处错误`
  }

  importing.value = false
}

const downloadErrorReport = () => {
  downloadCsvErrorReport(importResult.errors)
}

// 历史记录相关
const openHistoryDialog = (product) => {
  currentProduct.value = product
  currentHistory.value = getHistory(product.id)
  historyDialogVisible.value = true
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 获取图标组件
const getIconComponent = (iconName) => {
  const iconMap = {
    'Plus': Plus,
    'Edit': Edit,
    'Delete': Delete,
    'Switch': Switch,
    'Upload': Upload,
    'InfoFilled': InfoFilled
  }
  return iconMap[iconName] || InfoFilled
}

onMounted(() => {
  initStarredData()
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

.star-btn {
  font-size: 18px;
  color: #c0c4cc;
  transition: color 0.2s;

  &:hover {
    color: #f7ba2a;
  }

  &.starred {
    color: #f7ba2a;
  }
}

// SKU 相关样式
.sku-section {
  margin: 16px 0;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.spec-definitions {
  margin-bottom: 16px;
}

.spec-item {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  border: 1px solid #e4e7ed;
}

.spec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.spec-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.spec-value-tag {
  margin-right: 0;
}

.add-spec {
  margin-top: 12px;
}

.sku-table-wrapper {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.sku-batch-actions {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;

  .batch-label {
    font-size: 13px;
    color: #606266;
    margin-right: 8px;
  }
}

.sku-empty {
  padding: 20px;
}

// 导入相关样式
.import-section {
  .upload-area {
    width: 100%;
  }
}

.import-result {
  margin-top: 20px;
}

.error-list {
  margin-top: 16px;

  .error-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
    color: #606266;
  }

  .error-messages {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .error-tag {
    margin-right: 0;
  }
}

// 历史记录样式
.history-empty {
  padding: 40px 0;
}

.history-timeline {
  padding: 20px;
}

.history-item {
  padding: 8px 0;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.history-operator {
  font-size: 13px;
  color: #909399;
}

.history-content {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.history-changes {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;

  &:last-child {
    margin-bottom: 0;
  }
}

.change-field {
  color: #909399;
  min-width: 60px;
}

.change-old {
  color: #f56c6c;
  text-decoration: line-through;
}

.change-new {
  color: #67c23a;
  font-weight: 500;
}

.change-arrow {
  color: #c0c4cc;
  font-size: 12px;
}

:deep(.el-dialog__body) {
  padding-top: 16px;
}
</style>
