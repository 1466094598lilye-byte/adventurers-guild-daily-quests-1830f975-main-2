// Supabase 实体 API 包装器
import { dbQuery, dbInsert, dbUpdate, dbDelete } from '@/lib/db';

// Quest 实体
export const Quest = {
  async list(orderBy = '-created_date', limit = 1000) {
    return dbQuery.list('quests', orderBy, limit);
  },

  async filter(filters = {}, orderBy = '-created_date', limit = null) {
    return dbQuery.filter('quests', filters, orderBy, limit);
  },

  async get(id) {
    return dbQuery.get('quests', id);
  },

  async create(data) {
    return dbInsert.create('quests', data);
  },

  async update(id, data) {
    return dbUpdate.update('quests', id, data);
  },

  async delete(id) {
    return dbDelete.delete('quests', id);
  }
};

// Loot 实体
export const Loot = {
  async list(orderBy = '-created_date', limit = 1000) {
    return dbQuery.list('loot', orderBy, limit);
  },

  async filter(filters = {}, orderBy = '-created_date', limit = null) {
    return dbQuery.filter('loot', filters, orderBy, limit);
  },

  async get(id) {
    return dbQuery.get('loot', id);
  },

  async create(data) {
    return dbInsert.create('loot', data);
  },

  async update(id, data) {
    return dbUpdate.update('loot', id, data);
  },

  async delete(id) {
    return dbDelete.delete('loot', id);
  }
};

// DailyChest 实体
export const DailyChest = {
  async list(orderBy = '-created_date', limit = 1000) {
    return dbQuery.list('daily_chests', orderBy, limit);
  },

  async filter(filters = {}, orderBy = '-created_date', limit = null) {
    return dbQuery.filter('daily_chests', filters, orderBy, limit);
  },

  async get(id) {
    return dbQuery.get('daily_chests', id);
  },

  async create(data) {
    return dbInsert.create('daily_chests', data);
  },

  async update(id, data) {
    return dbUpdate.update('daily_chests', id, data);
  },

  async delete(id) {
    return dbDelete.delete('daily_chests', id);
  }
};

// LongTermProject 实体
export const LongTermProject = {
  async list(orderBy = '-created_date', limit = 1000) {
    return dbQuery.list('long_term_projects', orderBy, limit);
  },

  async filter(filters = {}, orderBy = '-created_date', limit = null) {
    return dbQuery.filter('long_term_projects', filters, orderBy, limit);
  },

  async get(id) {
    return dbQuery.get('long_term_projects', id);
  },

  async create(data) {
    return dbInsert.create('long_term_projects', data);
  },

  async update(id, data) {
    return dbUpdate.update('long_term_projects', id, data);
  },

  async delete(id) {
    return dbDelete.delete('long_term_projects', id);
  }
};

// 保持向后兼容
export const Query = null; // Base44 的 Query 不再需要

// 导出 User（认证 API）
export { auth as User } from './auth';

