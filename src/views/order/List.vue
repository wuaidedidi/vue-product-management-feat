<template>
  <div class="order-list">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">订单列表</h1>
      <p class="page-desc">查看和管理所有订单信息</p>
    </div>

    <!-- 搜索和筛选 -->
    <div class="search-bar">
      <el-input
        v-model="searchForm.keyword"
        placeholder="搜索订单号/收货人"
        prefix-icon="Search"
        clearable
        style="width: 220px"
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      />
      <el-select
        v-model="searchForm.status"
        placeholder="订单状态"
        clearable
        style="width: 140px"
        @change="handleSearch"
      >
        <el-option label="待付款" value="pending" />
        <el-option label="已付款" value="paid" />
        <el-option label="已发货" value="shipped" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
        <el-option label="退款中" value="refunding" />
      </el-select>
      <el-date-picker
        v-model="searchForm.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 260px"
        @change="handleSearch"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
      <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
      <el-button type="success" :icon="Download" @click="exportCSV">导出CSV</el-button>
    </div>

    <!-- 状态统计 -->
    <div class="status-tabs">
      <div
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="['status-tab', { active: searchForm.status === tab.value }]"
        @click="filterByStatus(tab.value)"
      >
        <span class="tab-count">{{ tab.count }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
    </div>

    <!-- 订单表格 -->
    <div class="table-container card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="180">
          <template #default="{ row }">
            <span class="order-no">#{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品信息" min-width="200">
          <template #default="{ row }">
            <div class="product-info">
              <span class="product-name">{{ row.productName }}</span>
              <span class="product-count">x{{ row.quantity }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="订单金额" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ row.totalAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="receiver" label="收货人" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="下单时间" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
              <el-button
                v-if="row.status === 'paid'"
                type="success"
                link
                @click="handleShip(row)"
              >
                发货
              </el-button>
              <el-button
                v-if="row.status === 'pending'"
                type="danger"
                link
                @click="handleCancel(row)"
              >
                取消
              </el-button>
              <el-button
                v-if="['paid', 'shipped'].includes(row.status)"
                type="warning"
                link
                @click="openRefundDialog(row)"
              >
                退款
              </el-button>
              <el-button
                v-if="row.status === 'refunding'"
                type="success"
                link
                @click="approveRefund(row)"
              >
                同意退款
              </el-button>
              <el-button
                v-if="row.status === 'refunding'"
                type="danger"
                link
                @click="rejectRefund(row)"
              >
                拒绝退款
              </el-button>
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

    <!-- 订单详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="订单详情"
      width="700px"
      destroy-on-close
    >
      <div v-if="currentOrder" class="order-detail">
        <!-- 订单状态时间线 -->
        <div class="detail-section">
          <h4 class="section-title">订单状态</h4>
          <el-steps :active="getActiveStep(currentOrder.status)" finish-status="success" align-center>
            <el-step title="待付款" :description="currentOrder.createTime" />
            <el-step title="已付款" :description="currentOrder.payTime || ''" />
            <el-step title="已发货" :description="currentOrder.shipTime || ''" />
            <el-step title="已完成" :description="currentOrder.completeTime || ''" />
          </el-steps>
        </div>

        <!-- 基本信息 -->
        <div class="detail-section">
          <h4 class="section-title">基本信息</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ currentOrder.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ currentOrder.createTime }}</el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ currentOrder.payMethod || '在线支付' }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="getStatusType(currentOrder.status)" size="small">
                {{ getStatusText(currentOrder.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 商品信息 -->
        <div class="detail-section">
          <h4 class="section-title">商品信息</h4>
          <div class="product-card">
            <div class="product-img">
              <el-icon :size="40"><Goods /></el-icon>
            </div>
            <div class="product-content">
              <div class="product-name">{{ currentOrder.productName }}</div>
              <div class="product-price">¥{{ currentOrder.price }} × {{ currentOrder.quantity }}</div>
            </div>
            <div class="product-total">¥{{ currentOrder.totalAmount.toFixed(2) }}</div>
          </div>
        </div>

        <!-- 收货信息 -->
        <div class="detail-section">
          <h4 class="section-title">收货信息</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="收货人">{{ currentOrder.receiver }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ currentOrder.phone }}</el-descriptions-item>
            <el-descriptions-item label="收货地址">{{ currentOrder.address }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 备注 -->
        <div v-if="currentOrder.remark" class="detail-section">
          <h4 class="section-title">订单备注</h4>
          <div class="remark-content">{{ currentOrder.remark }}</div>
        </div>

        <!-- 内部备注区 -->
        <div class="detail-section">
          <h4 class="section-title">内部运营备注</h4>
          <div class="internal-notes">
            <div v-if="currentOrder.internalNotes && currentOrder.internalNotes.length" class="notes-list">
              <div v-for="(note, index) in currentOrder.internalNotes" :key="index" class="note-item">
                <div class="note-header">
                  <span class="note-operator">{{ note.operator }}</span>
                  <span class="note-time">{{ note.createTime }}</span>
                </div>
                <div class="note-content">{{ note.content }}</div>
              </div>
            </div>
            <el-empty v-else description="暂无备注" :image-size="80" />
            <div class="note-input-area">
              <el-input
                v-model="newNoteContent"
                type="textarea"
                :rows="3"
                placeholder="输入备注内容..."
                maxlength="500"
                show-word-limit
              />
              <div class="note-actions">
                <el-button type="primary" :disabled="!newNoteContent.trim()" @click="addInternalNote">
                  添加备注
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="currentOrder?.status === 'paid'"
          type="success"
          @click="handleShip(currentOrder); detailVisible = false"
        >
          确认发货
        </el-button>
        <el-button
          v-if="['paid', 'shipped'].includes(currentOrder?.status)"
          type="warning"
          @click="openRefundDialog(currentOrder); detailVisible = false"
        >
          申请退款
        </el-button>
        <el-button
          v-if="currentOrder?.status === 'refunding'"
          type="success"
          @click="approveRefund(currentOrder); detailVisible = false"
        >
          同意退款
        </el-button>
        <el-button
          v-if="currentOrder?.status === 'refunding'"
          type="danger"
          @click="rejectRefund(currentOrder); detailVisible = false"
        >
          拒绝退款
        </el-button>
      </template>
    </el-dialog>

    <!-- 退款弹窗 -->
    <el-dialog
      v-model="refundVisible"
      title="申请退款"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="refundFormRef"
        :model="refundForm"
        label-width="100px"
        :rules="refundRules"
      >
        <el-form-item label="订单号">
          <span>#{{ refundOrder?.orderNo }}</span>
        </el-form-item>
        <el-form-item label="订单金额">
          <span>¥{{ refundOrder?.totalAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="退款金额" prop="amount">
          <el-input-number
            v-model="refundForm.amount"
            :min="0.01"
            :max="refundOrder?.totalAmount || 0"
            :precision="2"
            :step="0.01"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="退款原因" prop="reason">
          <el-input
            v-model="refundForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请填写退款原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRefund">提交退款申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Goods } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const loading = ref(false)

// 搜索表单
const searchForm = reactive({
  keyword: '',
  status: null,
  dateRange: null
})

// 分页
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

// 表格数据
const tableData = ref([])

// 详情弹窗
const detailVisible = ref(false)
const currentOrder = ref(null)

// 退款弹窗
const refundVisible = ref(false)
const refundFormRef = ref(null)
const refundOrder = ref(null)
const refundForm = reactive({
  amount: 0,
  reason: ''
})

// 用户store
const userStore = useUserStore()

// 内部备注
const newNoteContent = ref('')

// 退款表单验证规则
const refundRules = {
  amount: [
    { required: true, message: '请输入退款金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '退款金额不能小于0.01元', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value > refundOrder.value?.totalAmount) {
          callback(new Error('退款金额不能超过订单总额'))
        } else if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
          callback(new Error('金额最多保留两位小数'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  reason: [
    { required: true, message: '请填写退款原因', trigger: 'blur' },
    { min: 2, message: '退款原因至少2个字符', trigger: 'blur' }
  ]
}

// 状态配置
const getStatusType = (status) => {
  const types = {
    pending: 'warning',
    paid: 'primary',
    shipped: 'info',
    completed: 'success',
    cancelled: 'danger',
    refunding: 'warning'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
    refunding: '退款中'
  }
  return texts[status] || status
}

const getActiveStep = (status) => {
  const steps = { pending: 0, paid: 1, shipped: 2, completed: 3, cancelled: -1, refunding: 1 }
  return steps[status] ?? 0
}

// 状态统计
const statusTabs = computed(() => {
  const orders = initOrders()
  return [
    { label: '全部', value: null, count: orders.length },
    { label: '待付款', value: 'pending', count: orders.filter(o => o.status === 'pending').length },
    { label: '已付款', value: 'paid', count: orders.filter(o => o.status === 'paid').length },
    { label: '已发货', value: 'shipped', count: orders.filter(o => o.status === 'shipped').length },
    { label: '已完成', value: 'completed', count: orders.filter(o => o.status === 'completed').length },
    { label: '已取消', value: 'cancelled', count: orders.filter(o => o.status === 'cancelled').length },
    { label: '退款中', value: 'refunding', count: orders.filter(o => o.status === 'refunding').length }
  ]
})

// 初始化订单数据
const initOrders = () => {
  const stored = localStorage.getItem('mock_orders')
  if (stored) {
    return JSON.parse(stored)
  }

  const defaultOrders = [
    { id: 1, orderNo: '20240201001', productName: 'iPhone 15 Pro Max', price: 9999, quantity: 1, totalAmount: 9999, receiver: '张三', phone: '13800138001', address: '北京市朝阳区建国路88号', status: 'completed', payMethod: '微信支付', createTime: '2024-02-01 10:30:00', payTime: '2024-02-01 10:35:00', shipTime: '2024-02-02 09:00:00', completeTime: '2024-02-05 14:20:00', remark: '' },
    { id: 2, orderNo: '20240201002', productName: 'MacBook Pro 14"', price: 14999, quantity: 1, totalAmount: 14999, receiver: '李四', phone: '13800138002', address: '上海市浦东新区陆家嘴金融中心', status: 'shipped', payMethod: '支付宝', createTime: '2024-02-01 11:20:00', payTime: '2024-02-01 11:25:00', shipTime: '2024-02-02 10:00:00', completeTime: '', remark: '请尽快发货' },
    { id: 3, orderNo: '20240201003', productName: 'AirPods Pro 2', price: 1899, quantity: 2, totalAmount: 3798, receiver: '王五', phone: '13800138003', address: '广州市天河区珠江新城', status: 'paid', payMethod: '微信支付', createTime: '2024-02-01 14:15:00', payTime: '2024-02-01 14:18:00', shipTime: '', completeTime: '', remark: '' },
    { id: 4, orderNo: '20240201004', productName: 'iPad Air 5', price: 4799, quantity: 1, totalAmount: 4799, receiver: '赵六', phone: '13800138004', address: '深圳市南山区科技园', status: 'pending', payMethod: '', createTime: '2024-02-01 15:30:00', payTime: '', shipTime: '', completeTime: '', remark: '发票抬头：xxx公司' },
    { id: 5, orderNo: '20240201005', productName: 'Apple Watch S9', price: 3299, quantity: 1, totalAmount: 3299, receiver: '孙七', phone: '13800138005', address: '杭州市西湖区文三路', status: 'cancelled', payMethod: '', createTime: '2024-02-01 16:00:00', payTime: '', shipTime: '', completeTime: '', remark: '' },
    { id: 6, orderNo: '20240202001', productName: '男士休闲夹克', price: 399, quantity: 3, totalAmount: 1197, receiver: '周八', phone: '13800138006', address: '成都市锦江区春熙路', status: 'completed', payMethod: '支付宝', createTime: '2024-02-02 09:20:00', payTime: '2024-02-02 09:22:00', shipTime: '2024-02-03 08:00:00', completeTime: '2024-02-06 10:30:00', remark: '' },
    { id: 7, orderNo: '20240202002', productName: '进口红酒礼盒', price: 599, quantity: 2, totalAmount: 1198, receiver: '吴九', phone: '13800138007', address: '武汉市江汉区建设大道', status: 'paid', payMethod: '微信支付', createTime: '2024-02-02 10:45:00', payTime: '2024-02-02 10:48:00', shipTime: '', completeTime: '', remark: '礼品包装' },
    { id: 8, orderNo: '20240202003', productName: '智能台灯', price: 199, quantity: 5, totalAmount: 995, receiver: '郑十', phone: '13800138008', address: '南京市鼓楼区中山路', status: 'shipped', payMethod: '支付宝', createTime: '2024-02-02 11:30:00', payTime: '2024-02-02 11:32:00', shipTime: '2024-02-03 09:00:00', completeTime: '', remark: '' }
  ]

  localStorage.setItem('mock_orders', JSON.stringify(defaultOrders))
  return defaultOrders
}

// 加载数据
const loadData = () => {
  loading.value = true

  setTimeout(() => {
    let orders = initOrders()

    // 筛选
    if (searchForm.keyword) {
      const keyword = searchForm.keyword.toLowerCase()
      orders = orders.filter(o =>
        o.orderNo.toLowerCase().includes(keyword) ||
        o.receiver.toLowerCase().includes(keyword)
      )
    }
    if (searchForm.status) {
      orders = orders.filter(o => o.status === searchForm.status)
    }
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      const [start, end] = searchForm.dateRange
      orders = orders.filter(o => {
        const date = o.createTime.split(' ')[0]
        return date >= start && date <= end
      })
    }

    // 按时间倒序
    orders.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))

    pagination.total = orders.length

    // 分页
    const start = (pagination.page - 1) * pagination.size
    tableData.value = orders.slice(start, start + pagination.size)

    loading.value = false
  }, 300)
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置
const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.status = null
  searchForm.dateRange = null
  handleSearch()
}

// 按状态筛选
const filterByStatus = (status) => {
  searchForm.status = status
  handleSearch()
}

// 查看详情
const viewDetail = (order) => {
  currentOrder.value = order
  detailVisible.value = true
}

// 发货
const handleShip = (order) => {
  ElMessageBox.confirm(`确定要对订单「${order.orderNo}」进行发货吗？`, '确认发货', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders[index].status = 'shipped'
      orders[index].shipTime = new Date().toLocaleString()
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('发货成功')
      loadData()
    }
  }).catch(() => {})
}

// 取消订单
const handleCancel = (order) => {
  ElMessageBox.confirm(`确定要取消订单「${order.orderNo}」吗？`, '取消订单', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders[index].status = 'cancelled'
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('订单已取消')
      loadData()
    }
  }).catch(() => {})
}

// 打开退款弹窗
const openRefundDialog = (order) => {
  refundOrder.value = order
  refundForm.amount = order.totalAmount
  refundForm.reason = ''
  refundVisible.value = true
}

// 提交退款申请
const submitRefund = () => {
  refundFormRef.value?.validate((valid) => {
    if (valid) {
      const orders = initOrders()
      const index = orders.findIndex(o => o.id === refundOrder.value.id)
      if (index > -1) {
        orders[index].originalStatus = refundOrder.value.status
        orders[index].status = 'refunding'
        orders[index].refundInfo = {
          amount: refundForm.amount,
          reason: refundForm.reason,
          applyTime: new Date().toLocaleString()
        }
        localStorage.setItem('mock_orders', JSON.stringify(orders))
        refundVisible.value = false
        ElMessage.success('退款申请已提交，进入退款中状态')
        loadData()
      }
    }
  })
}

// 同意退款
const approveRefund = (order) => {
  ElMessageBox.confirm(`确定要同意订单「${order.orderNo}」的退款申请吗？`, '同意退款', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'success'
  }).then(() => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders[index].status = 'cancelled'
      orders[index].refundInfo = {
        ...orders[index].refundInfo,
        status: 'approved',
        handleTime: new Date().toLocaleString()
      }
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('已同意退款，订单已取消')
      loadData()
    }
  }).catch(() => {})
}

// 拒绝退款
const rejectRefund = (order) => {
  ElMessageBox.prompt('请输入拒绝原因', '拒绝退款', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '请填写拒绝原因'
  }).then(({ value: rejectReason }) => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === order.id)
    if (index > -1) {
      orders[index].status = orders[index].originalStatus || 'paid'
      orders[index].refundInfo = {
        ...orders[index].refundInfo,
        status: 'rejected',
        rejectReason,
        handleTime: new Date().toLocaleString()
      }
      delete orders[index].originalStatus
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('已拒绝退款，订单已恢复原状态')
      loadData()
    }
  }).catch(() => {})
}

// 导出CSV
const exportCSV = () => {
  let orders = initOrders()

  if (searchForm.keyword) {
    const keyword = searchForm.keyword.toLowerCase()
    orders = orders.filter(o =>
      o.orderNo.toLowerCase().includes(keyword) ||
      o.receiver.toLowerCase().includes(keyword)
    )
  }
  if (searchForm.status) {
    orders = orders.filter(o => o.status === searchForm.status)
  }
  if (searchForm.dateRange && searchForm.dateRange.length === 2) {
    const [start, end] = searchForm.dateRange
    orders = orders.filter(o => {
      const date = o.createTime.split(' ')[0]
      return date >= start && date <= end
    })
  }

  const headers = ['订单号', '商品名称', '数量', '订单金额', '收货人', '联系电话', '收货地址', '订单状态', '下单时间', '支付方式']
  const rows = orders.map(order => [
    order.orderNo,
    order.productName,
    order.quantity,
    order.totalAmount.toFixed(2),
    order.receiver,
    order.phone,
    order.address,
    getStatusText(order.status),
    order.createTime,
    order.payMethod || ''
  ])

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `订单_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success('导出成功')
}

// 添加内部备注
const addInternalNote = () => {
  if (!newNoteContent.value.trim()) return

  const orders = initOrders()
  const index = orders.findIndex(o => o.id === currentOrder.value.id)
  if (index > -1) {
    if (!orders[index].internalNotes) {
      orders[index].internalNotes = []
    }
    orders[index].internalNotes.unshift({
      content: newNoteContent.value.trim(),
      operator: userStore.userInfo?.nickname || userStore.userInfo?.username || '管理员',
      createTime: new Date().toLocaleString()
    })
    localStorage.setItem('mock_orders', JSON.stringify(orders))
    currentOrder.value = orders[index]
    newNoteContent.value = ''
    ElMessage.success('备注添加成功')
  }
}


onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.order-list {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.status-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  .status-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 24px;
    background: #fff;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      .tab-count,
      .tab-label {
        color: #fff;
      }
    }

    .tab-count {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
    }

    .tab-label {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
  }
}

.order-no {
  font-family: monospace;
  color: #6b7280;
}

.product-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .product-name {
    color: #1f2937;
  }

  .product-count {
    color: #9ca3af;
    font-size: 13px;
  }
}

.amount {
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

// 订单详情样式
.order-detail {
  .detail-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 12px;
      padding-left: 10px;
      border-left: 3px solid #667eea;
    }
  }

  .product-card {
    display: flex;
    align-items: center;
    padding: 16px;
    background: #f8fafc;
    border-radius: 10px;

    .product-img {
      width: 60px;
      height: 60px;
      background: #e5e7eb;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }

    .product-content {
      flex: 1;
      margin-left: 16px;

      .product-name {
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 4px;
      }

      .product-price {
        font-size: 13px;
        color: #6b7280;
      }
    }

    .product-total {
      font-size: 18px;
      font-weight: 600;
      color: #ef4444;
    }
  }

  .remark-content {
    padding: 12px;
    background: #fef3c7;
    border-radius: 8px;
    color: #92400e;
    font-size: 14px;
  }
}

:deep(.el-steps) {
  padding: 20px 0;
}

.internal-notes {
  .notes-list {
    margin-bottom: 20px;

    .note-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .note-operator {
          font-weight: 600;
          color: #667eea;
          font-size: 13px;
        }

        .note-time {
          font-size: 12px;
          color: #9ca3af;
        }
      }

      .note-content {
        color: #374151;
        font-size: 14px;
        line-height: 1.6;
      }
    }
  }

  .note-input-area {
    border-top: 1px solid #e5e7eb;
    padding-top: 16px;

    .note-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
  }
}
</style>
