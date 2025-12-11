/**
 * 游客模式存储层 - 使用 localStorage 存储数据
 * 仅用于游客模式下临时存储任务、宝物等数据
 */

const GUEST_STORAGE_PREFIX = 'guest_';

// 生成唯一 ID
const generateId = () => {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 获取表的数据
const getTableData = (tableName) => {
  try {
    const key = `${GUEST_STORAGE_PREFIX}${tableName}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading guest storage for ${tableName}:`, error);
    return [];
  }
};

// 保存表的数据
const saveTableData = (tableName, data) => {
  try {
    const key = `${GUEST_STORAGE_PREFIX}${tableName}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving guest storage for ${tableName}:`, error);
    throw error;
  }
};

export const guestStorage = {
  // 查询列表
  list(tableName, orderBy = '-created_date', limit = 1000, filters = {}) {
    let data = getTableData(tableName);
    
    // 应用过滤条件
    Object.entries(filters).forEach(([key, value]) => {
      data = data.filter(item => item[key] === value);
    });
    
    // 排序
    if (orderBy.startsWith('-')) {
      const field = orderBy.substring(1);
      data.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      });
    } else {
      data.sort((a, b) => {
        const aVal = a[orderBy] || '';
        const bVal = b[orderBy] || '';
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    }
    
    // 限制数量
    if (limit) {
      data = data.slice(0, limit);
    }
    
    return data;
  },

  // 查询单条记录
  get(tableName, id) {
    const data = getTableData(tableName);
    return data.find(item => item.id === id) || null;
  },

  // 过滤查询
  filter(tableName, filters = {}, orderBy = '-created_date', limit = null) {
    return this.list(tableName, orderBy, limit, filters);
  },

  // 创建记录
  create(tableName, data) {
    const allData = getTableData(tableName);
    const newItem = {
      ...data,
      id: data.id || generateId(),
      owner_id: 'guest',
      created_date: data.created_date || new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
    allData.push(newItem);
    saveTableData(tableName, allData);
    return newItem;
  },

  // 更新记录
  update(tableName, id, data) {
    const allData = getTableData(tableName);
    const index = allData.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Record not found: ${id}`);
    }
    allData[index] = {
      ...allData[index],
      ...data,
      updated_date: new Date().toISOString()
    };
    saveTableData(tableName, allData);
    return allData[index];
  },

  // 删除记录
  delete(tableName, id) {
    const allData = getTableData(tableName);
    const filtered = allData.filter(item => item.id !== id);
    saveTableData(tableName, filtered);
    return true;
  },

  // 清空所有游客数据（用于登录后迁移）
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(GUEST_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing guest storage:', error);
    }
  }
};


