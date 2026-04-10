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
        <el-option label="退款中" value="refunding" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
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
      <el-button type="success" :icon="Download" @click="handleExport">导出</el-button>
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
                @click="handleRefund(row)"
              >
                退款
              </el-button>
              <el-button
                v-if="row.status === 'refunding'"
                type="primary"
                link
                @click="handleRefundAction(row)"
              >
                处理退款
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
      width="800px"
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
          <!-- 退款中状态提示 -->
          <div v-if="currentOrder.status === 'refunding'" class="refund-info">
            <el-alert
              title="退款申请中"
              type="warning"
              :description="`退款金额：¥${currentOrder.refundAmount?.toFixed(2)}，原因：${currentOrder.refundReason}`"
              show-icon
              :closable="false"
            />
          </div>
          <!-- 退款历史记录（同意或拒绝后显示） -->
          <div v-if="currentOrder.refundHistory && currentOrder.refundHistory.length > 0" class="refund-history">
            <div v-for="(record, index) in currentOrder.refundHistory" :key="index" class="refund-record">
              <el-alert
                :title="record.result === 'approved' ? '退款已同意' : '退款已拒绝'"
                :type="record.result === 'approved' ? 'success' : 'info'"
                show-icon
                :closable="false"
              >
                <template #default>
                  <div class="refund-record-detail">
                    <div>退款金额：¥{{ record.amount?.toFixed(2) }}</div>
                    <div>退款原因：{{ record.reason }}</div>
                    <div v-if="record.rejectReason">拒绝原因：{{ record.rejectReason }}</div>
                    <div>申请时间：{{ record.applyTime }}</div>
                    <div>处理时间：{{ record.handleTime }}</div>
                    <div>处理人：{{ record.handler }}</div>
                  </div>
                </template>
              </el-alert>
            </div>
          </div>
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

        <!-- 订单备注 -->
        <div v-if="currentOrder.remark" class="detail-section">
          <h4 class="section-title">订单备注</h4>
          <div class="remark-content">{{ currentOrder.remark }}</div>
        </div>

        <!-- 内部运营备注 -->
        <div class="detail-section">
          <h4 class="section-title">内部运营备注</h4>
          <div class="internal-notes">
            <div v-if="currentOrder.internalNotes && currentOrder.internalNotes.length > 0" class="notes-list">
              <div v-for="(note, index) in currentOrder.internalNotes" :key="index" class="note-item">
                <div class="note-content">{{ note.content }}</div>
                <div class="note-meta">
                  <span class="note-author">{{ note.author }}</span>
                  <span class="note-time">{{ note.createTime }}</span>
                </div>
              </div>
            </div>
            <div v-else class="no-notes">暂无运营备注</div>
            <div class="note-input-area">
              <el-input
                v-model="newNoteContent"
                type="textarea"
                :rows="2"
                placeholder="添加运营备注..."
                maxlength="500"
                show-word-limit
              />
              <el-button type="primary" @click="addInternalNote" :disabled="!newNoteContent.trim()">
                添加备注
              </el-button>
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
          @click="handleRefund(currentOrder); detailVisible = false"
        >
          申请退款
        </el-button>
      </template>
    </el-dialog>

    <!-- 退款申请弹窗 -->
    <el-dialog
      v-model="refundVisible"
      title="申请退款"
      width="500px"
      destroy-on-close
    >
      <el-form :model="refundForm" :rules="refundRules" ref="refundFormRef" label-width="100px">
        <el-form-item label="订单号">
          <span>{{ refundForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="订单金额">
          <span class="amount">¥{{ refundForm.totalAmount?.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="退款金额" prop="amount">
          <el-input-number
            v-model="refundForm.amount"
            :min="0.01"
            :max="refundForm.totalAmount"
            :precision="2"
            :step="0.01"
            style="width: 200px"
          />
          <span class="form-tip">最多可退 ¥{{ refundForm.totalAmount?.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="退款原因" prop="reason">
          <el-input
            v-model="refundForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入退款原因"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRefund">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- 退款处理弹窗 -->
    <el-dialog
      v-model="refundActionVisible"
      title="处理退款申请"
      width="500px"
      destroy-on-close
    >
      <div v-if="currentRefundOrder" class="refund-action-content">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订单号">{{ currentRefundOrder.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">¥{{ currentRefundOrder.totalAmount.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="申请退款金额">
            <span class="amount">¥{{ currentRefundOrder.refundAmount?.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="退款原因">{{ currentRefundOrder.refundReason }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ currentRefundOrder.refundApplyTime }}</el-descriptions-item>
        </el-descriptions>
        <div class="reject-reason-input">
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="2"
            placeholder="如需拒绝，请填写拒绝原因（选填）"
            maxlength="200"
            show-word-limit
          />
        </div>
        <div class="action-buttons">
          <el-button type="danger" @click="rejectRefund">拒绝退款</el-button>
          <el-button type="success" @click="approveRefund">同意退款</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Goods } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const loading = ref(false)
const userStore = useUserStore()

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
const newNoteContent = ref('')

// 退款弹窗
const refundVisible = ref(false)
const refundFormRef = ref(null)
const refundForm = reactive({
  orderId: null,
  orderNo: '',
  totalAmount: 0,
  amount: 0.01,
  reason: ''
})

// 退款处理弹窗
const refundActionVisible = ref(false)
const currentRefundOrder = ref(null)
const rejectReason = ref('')

// 退款表单校验规则
const refundRules = {
  amount: [
    { required: true, message: '请输入退款金额', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value < 0.01) {
          callback(new Error('退款金额不能小于 0.01'))
        } else if (value > refundForm.totalAmount) {
          callback(new Error(`退款金额不能超过订单总额 ¥${refundForm.totalAmount.toFixed(2)}`))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  reason: [
    { required: true, message: '请输入退款原因', trigger: 'blur' },
    { min: 1, max: 200, message: '原因长度在 1 到 200 个字符', trigger: 'blur' }
  ]
}

// 状态配置
const getStatusType = (status) => {
  const types = {
    pending: 'warning',
    paid: 'primary',
    shipped: 'info',
    refunding: 'danger',
    completed: 'success',
    cancelled: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    refunding: '退款中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const getActiveStep = (status) => {
  const steps = { pending: 0, paid: 1, shipped: 2, completed: 3, cancelled: -1, refunding: 1 }
  return steps[status] ?? 0
}

// 获取所有订单（用于统计）
const getAllOrders = () => {
  const stored = localStorage.getItem('mock_orders')
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

// 状态统计
const statusTabs = computed(() => {
  const orders = getAllOrders()
  return [
    { label: '全部', value: null, count: orders.length },
    { label: '待付款', value: 'pending', count: orders.filter(o => o.status === 'pending').length },
    { label: '已付款', value: 'paid', count: orders.filter(o => o.status === 'paid').length },
    { label: '已发货', value: 'shipped', count: orders.filter(o => o.status === 'shipped').length },
    { label: '退款中', value: 'refunding', count: orders.filter(o => o.status === 'refunding').length },
    { label: '已完成', value: 'completed', count: orders.filter(o => o.status === 'completed').length },
    { label: '已取消', value: 'cancelled', count: orders.filter(o => o.status === 'cancelled').length }
  ]
})

// 初始化订单数据
const initOrders = () => {
  const stored = localStorage.getItem('mock_orders')
  if (stored) {
    return JSON.parse(stored)
  }

  const defaultOrders = [
    { id: 1, orderNo: '20240201001', productName: 'iPhone 15 Pro Max', price: 9999, quantity: 1, totalAmount: 9999, receiver: '张三', phone: '13800138001', address: '北京市朝阳区建国路88号', status: 'completed', payMethod: '微信支付', createTime: '2024-02-01 10:30:00', payTime: '2024-02-01 10:35:00', shipTime: '2024-02-02 09:00:00', completeTime: '2024-02-05 14:20:00', remark: '', internalNotes: [] },
    { id: 2, orderNo: '20240201002', productName: 'MacBook Pro 14"', price: 14999, quantity: 1, totalAmount: 14999, receiver: '李四', phone: '13800138002', address: '上海市浦东新区陆家嘴金融中心', status: 'shipped', payMethod: '支付宝', createTime: '2024-02-01 11:20:00', payTime: '2024-02-01 11:25:00', shipTime: '2024-02-02 10:00:00', completeTime: '', remark: '请尽快发货', internalNotes: [] },
    { id: 3, orderNo: '20240201003', productName: 'AirPods Pro 2', price: 1899, quantity: 2, totalAmount: 3798, receiver: '王五', phone: '13800138003', address: '广州市天河区珠江新城', status: 'paid', payMethod: '微信支付', createTime: '2024-02-01 14:15:00', payTime: '2024-02-01 14:18:00', shipTime: '', completeTime: '', remark: '', internalNotes: [] },
    { id: 4, orderNo: '20240201004', productName: 'iPad Air 5', price: 4799, quantity: 1, totalAmount: 4799, receiver: '赵六', phone: '13800138004', address: '深圳市南山区科技园', status: 'pending', payMethod: '', createTime: '2024-02-01 15:30:00', payTime: '', shipTime: '', completeTime: '', remark: '发票抬头：xxx公司', internalNotes: [] },
    { id: 5, orderNo: '20240201005', productName: 'Apple Watch S9', price: 3299, quantity: 1, totalAmount: 3299, receiver: '孙七', phone: '13800138005', address: '杭州市西湖区文三路', status: 'cancelled', payMethod: '', createTime: '2024-02-01 16:00:00', payTime: '', shipTime: '', completeTime: '', remark: '', internalNotes: [] },
    { id: 6, orderNo: '20240202001', productName: '男士休闲夹克', price: 399, quantity: 3, totalAmount: 1197, receiver: '周八', phone: '13800138006', address: '成都市锦江区春熙路', status: 'completed', payMethod: '支付宝', createTime: '2024-02-02 09:20:00', payTime: '2024-02-02 09:22:00', shipTime: '2024-02-03 08:00:00', completeTime: '2024-02-06 10:30:00', remark: '', internalNotes: [] },
    { id: 7, orderNo: '20240202002', productName: '进口红酒礼盒', price: 599, quantity: 2, totalAmount: 1198, receiver: '吴九', phone: '13800138007', address: '武汉市江汉区建设大道', status: 'paid', payMethod: '微信支付', createTime: '2024-02-02 10:45:00', payTime: '2024-02-02 10:48:00', shipTime: '', completeTime: '', remark: '礼品包装', internalNotes: [] },
    { id: 8, orderNo: '20240202003', productName: '智能台灯', price: 199, quantity: 5, totalAmount: 995, receiver: '郑十', phone: '13800138008', address: '南京市鼓楼区中山路', status: 'shipped', payMethod: '支付宝', createTime: '2024-02-02 11:30:00', payTime: '2024-02-02 11:32:00', shipTime: '2024-02-03 09:00:00', completeTime: '', remark: '', internalNotes: [] }
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
  newNoteContent.value = ''
  detailVisible.value = true
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
    orders[index].internalNotes.push({
      content: newNoteContent.value.trim(),
      author: userStore.userInfo?.nickname || userStore.userInfo?.username || '管理员',
      createTime: new Date().toLocaleString()
    })
    localStorage.setItem('mock_orders', JSON.stringify(orders))
    currentOrder.value.internalNotes = orders[index].internalNotes
    newNoteContent.value = ''
    ElMessage.success('备注添加成功')
  }
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
const handleRefund = (order) => {
  refundForm.orderId = order.id
  refundForm.orderNo = order.orderNo
  refundForm.totalAmount = order.totalAmount
  refundForm.amount = order.totalAmount
  refundForm.reason = ''
  refundVisible.value = true
}

// 提交退款申请
const submitRefund = () => {
  refundFormRef.value.validate((valid) => {
    if (valid) {
      const orders = initOrders()
      const index = orders.findIndex(o => o.id === refundForm.orderId)
      if (index > -1) {
        // 保存原状态，用于拒绝后恢复
        orders[index].previousStatus = orders[index].status
        orders[index].status = 'refunding'
        orders[index].refundAmount = refundForm.amount
        orders[index].refundReason = refundForm.reason
        orders[index].refundApplyTime = new Date().toLocaleString()
        localStorage.setItem('mock_orders', JSON.stringify(orders))
        ElMessage.success('退款申请已提交')
        refundVisible.value = false
        loadData()
      }
    }
  })
}

// 打开退款处理弹窗
const handleRefundAction = (order) => {
  currentRefundOrder.value = order
  rejectReason.value = ''
  refundActionVisible.value = true
}

// 同意退款
const approveRefund = () => {
  ElMessageBox.confirm('确定同意该退款申请吗？退款金额将原路退回。', '确认同意退款', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === currentRefundOrder.value.id)
    if (index > -1) {
      // 保存退款记录到历史
      if (!orders[index].refundHistory) {
        orders[index].refundHistory = []
      }
      orders[index].refundHistory.push({
        result: 'approved',
        amount: orders[index].refundAmount,
        reason: orders[index].refundReason,
        applyTime: orders[index].refundApplyTime,
        handleTime: new Date().toLocaleString(),
        handler: userStore.userInfo?.nickname || userStore.userInfo?.username || '管理员'
      })

      orders[index].status = 'cancelled'
      orders[index].previousStatus = null
      orders[index].refundCompleteTime = new Date().toLocaleString()
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('退款已同意并处理')
      refundActionVisible.value = false
      loadData()
    }
  }).catch(() => {})
}

// 拒绝退款
const rejectRefund = () => {
  ElMessageBox.confirm('确定拒绝该退款申请吗？订单将恢复到原来的状态。', '确认拒绝退款', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const orders = initOrders()
    const index = orders.findIndex(o => o.id === currentRefundOrder.value.id)
    if (index > -1) {
      // 保存退款记录到历史
      if (!orders[index].refundHistory) {
        orders[index].refundHistory = []
      }
      orders[index].refundHistory.push({
        result: 'rejected',
        amount: orders[index].refundAmount,
        reason: orders[index].refundReason,
        rejectReason: rejectReason.value,
        applyTime: orders[index].refundApplyTime,
        handleTime: new Date().toLocaleString(),
        handler: userStore.userInfo?.nickname || userStore.userInfo?.username || '管理员'
      })

      // 恢复到原状态，但保留退款记录
      orders[index].status = orders[index].previousStatus || 'paid'
      orders[index].previousStatus = null
      localStorage.setItem('mock_orders', JSON.stringify(orders))
      ElMessage.success('退款申请已拒绝')
      refundActionVisible.value = false
      loadData()
    }
  }).catch(() => {})
}

// 导出CSV
const handleExport = () => {
  let orders = initOrders()

  // 应用当前筛选条件
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

  // CSV 表头
  const headers = ['订单号', '商品名称', '单价', '数量', '订单金额', '收货人', '联系电话', '收货地址', '订单状态', '支付方式', '下单时间', '付款时间', '发货时间', '完成时间', '订单备注']

  // CSV 数据行
  const rows = orders.map(order => [
    order.orderNo,
    order.productName,
    order.price,
    order.quantity,
    order.totalAmount.toFixed(2),
    order.receiver,
    order.phone,
    order.address,
    getStatusText(order.status),
    order.payMethod || '-',
    order.createTime,
    order.payTime || '-',
    order.shipTime || '-',
    order.completeTime || '-',
    order.remark || '-'
  ])

  // 构建 CSV 内容（UTF-8 with BOM）
  const BOM = '\uFEFF'
  const csvContent = BOM + [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

  // 下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `订单列表_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  ElMessage.success(`已导出 ${orders.length} 条订单数据`)
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
  flex-wrap: wrap;
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

  .refund-info {
    margin-top: 16px;
  }
}

// 内部备注样式
.internal-notes {
  .notes-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 16px;

    .note-item {
      padding: 12px;
      background: #f3f4f6;
      border-radius: 8px;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .note-content {
        color: #1f2937;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 8px;
      }

      .note-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #6b7280;

        .note-author {
          font-weight: 500;
          color: #667eea;
        }
      }
    }
  }

  .no-notes {
    text-align: center;
    padding: 24px;
    color: #9ca3af;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .note-input-area {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-button {
      align-self: flex-end;
    }
  }
}

// 退款处理弹窗样式
.refund-action-content {
  .reject-reason-input {
    margin-top: 16px;
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
}

// 退款历史记录样式
.refund-history {
  margin-top: 16px;

  .refund-record {
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    .refund-record-detail {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.8;
      color: #4b5563;
    }
  }
}

// 表单提示
.form-tip {
  margin-left: 8px;
  color: #6b7280;
  font-size: 13px;
}

:deep(.el-steps) {
  padding: 20px 0;
}
</style>
