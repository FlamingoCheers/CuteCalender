/**
 * 日程管理应用 - 数据库模块
 * 使用IndexedDB实现本地数据存储
 */

class ScheduleDatabase {
    constructor() {
        this.dbName = 'ScheduleDB';
        this.dbVersion = 1;
        this.db = null;
        this.events = [];
        this.listeners = new Map(); // 事件监听器
        this.init();
    }

    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            try {
                // 检查浏览器是否支持IndexedDB
                if (!window.indexedDB) {
                    reject(new Error('您的浏览器不支持IndexedDB，请使用现代浏览器'));
                    return;
                }

                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('数据库打开失败:', request.error);
                    reject(new Error('数据库打开失败：' + request.error));
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    console.log('数据库连接成功');
                    this.loadEvents().then(resolve).catch(reject);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    console.log('数据库升级');

                    // 创建事件表
                    if (!db.objectStoreNames.contains('events')) {
                        const eventsStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                        eventsStore.createIndex('date', 'date', { unique: false });
                        eventsStore.createIndex('repeatId', 'repeatId', { unique: false });
                        eventsStore.createIndex('category', 'category', { unique: false });
                        eventsStore.createIndex('completed', 'completed', { unique: false });
                    }

                    // 创建设置表
                    if (!db.objectStoreNames.contains('settings')) {
                        const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                        settingsStore.put({ key: 'lastRepeatId', value: 0 });
                    }
                };
            } catch (error) {
                console.error('数据库初始化失败:', error);
                reject(new Error('数据库初始化失败：' + error.message));
            }
        });
    }

    /**
     * 加载所有事件
     */
    async loadEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => {
                this.events = request.result;
                console.log(`加载了 ${this.events.length} 个事件`);
                resolve(this.events);
            };

            request.onerror = () => {
                console.error('加载事件失败:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 添加事件监听器
     */
    addEventListener(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    /**
     * 移除事件监听器
     */
    removeEventListener(eventType, callback) {
        if (this.listeners.has(eventType)) {
            const callbacks = this.listeners.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    emit(eventType, data) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件监听器错误 (${eventType}):`, error);
                }
            });
        }
    }

    /**
     * 添加事件
     */
    async addEvent(eventData) {
        return new Promise((resolve, reject) => {
            // 添加数据验证
            if (!eventData.title || eventData.title.trim() === '') {
                reject(new Error('事件标题不能为空'));
                return;
            }

            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');

            // 创建事件对象，如果id是undefined则不包含id属性
            const event = {
                ...eventData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 如果id是undefined，删除id属性让数据库自动生成
            if (event.id === undefined) {
                delete event.id;
            }

            const request = store.add(event);

            request.onsuccess = () => {
                event.id = request.result;
                this.events.push(event);
                console.log('事件添加成功:', event);
                this.emit('eventAdded', event); // 触发事件添加通知
                resolve(event);
            };

            request.onerror = () => {
                console.error('添加事件失败:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 更新事件
     */
    async updateEvent(id, updates) {
        return new Promise((resolve, reject) => {
            // 如果更新包含标题，验证标题
            if (updates.title !== undefined && (!updates.title || updates.title.trim() === '')) {
                reject(new Error('事件标题不能为空'));
                return;
            }

            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');

            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const event = getRequest.result;
                if (!event) {
                    reject(new Error('事件不存在'));
                    return;
                }

                const updatedEvent = {
                    ...event,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };

                const updateRequest = store.put(updatedEvent);

                updateRequest.onsuccess = () => {
                    const index = this.events.findIndex(e => e.id === id);
                    if (index !== -1) {
                        this.events[index] = updatedEvent;
                    }
                    console.log('事件更新成功:', updatedEvent);
                    this.emit('eventUpdated', { id, updates: updatedEvent }); // 触发事件更新通知
                    resolve(updatedEvent);
                };

                updateRequest.onerror = () => {
                    console.error('更新事件失败:', updateRequest.error);
                    reject(updateRequest.error);
                };
            };

            getRequest.onerror = () => {
                console.error('获取事件失败:', getRequest.error);
                reject(getRequest.error);
            };
        });
    }

    /**
     * 删除事件
     */
    async deleteEvent(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');

            const request = store.delete(id);

            request.onsuccess = () => {
                this.events = this.events.filter(e => e.id !== id);
                console.log('事件删除成功:', id);
                this.emit('eventDeleted', { id }); // 触发事件删除通知
                resolve(id);
            };

            request.onerror = () => {
                console.error('删除事件失败:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 批量删除事件（用于重复事项）
     */
    async deleteEventsByRepeatId(repeatId, fromDate = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const index = store.index('repeatId');

            const range = IDBKeyRange.only(repeatId);
            const request = index.openCursor(range);

            let deletedCount = 0;
            const deletedIds = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const eventData = cursor.value;
                    if (!fromDate || eventData.date >= fromDate) {
                        cursor.delete();
                        deletedCount++;
                        deletedIds.push(eventData.id);
                    }
                    cursor.continue();
                } else {
                    this.events = this.events.filter(e => !deletedIds.includes(e.id));
                    console.log(`批量删除完成，删除了 ${deletedCount} 个事件`);
                    this.emit('eventsBatchDeleted', { repeatId, deletedCount, deletedIds, fromDate }); // 触发批量删除通知
                    resolve({ deletedCount, deletedIds });
                }
            };

            request.onerror = () => {
                console.error('批量删除失败:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 获取指定日期的事件
     */
    getEventsByDate(date) {
        return this.events.filter(event => event.date === date);
    }

    /**
     * 获取指定日期范围的事件
     */
    getEventsByDateRange(startDate, endDate) {
        return this.events.filter(event => {
            return event.date >= startDate && event.date <= endDate;
        });
    }

    /**
     * 获取指定类别的事件
     */
    getEventsByCategory(category) {
        return this.events.filter(event => event.category === category);
    }

    /**
     * 获取未安排时间的事件
     */
    getUnscheduledEvents() {
        return this.events.filter(event => !event.time);
    }

    /**
     * 获取已完成的事件
     */
    getCompletedEvents() {
        return this.events.filter(event => event.completed);
    }

    /**
     * 获取未完成的事件
     */
    getPendingEvents() {
        return this.events.filter(event => !event.completed);
    }

    /**
     * 获取重复事项
     */
    getRepeatEvents() {
        return this.events.filter(event => event.repeatId > 0);
    }

    /**
     * 获取下一个重复ID
     */
    async getNextRepeatId() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const request = store.get('lastRepeatId');

            request.onsuccess = () => {
                const setting = request.result;
                const nextId = (setting?.value || 0) + 1;
                
                store.put({ key: 'lastRepeatId', value: nextId });
                resolve(nextId);
            };

            request.onerror = () => {
                console.error('获取重复ID失败:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 创建重复事件
     */
    async createRepeatEvents(baseEvent, repeatType, endDate) {
        const repeatId = await this.getNextRepeatId();
        const events = [];
        
        let currentDate = new Date(baseEvent.date);
        
        // 如果没有指定结束日期，默认创建未来1年的事件（避免无限循环）
        let end;
        if (!endDate) {
            end = new Date();
            end.setFullYear(end.getFullYear() + 1); // 默认1年
        } else {
            end = new Date(endDate);
        }
        
        // 限制最大事件数量，避免性能问题
        const maxEvents = 1000;
        let eventCount = 0;
        
        while (currentDate <= end && eventCount < maxEvents) {
            // 创建新事件对象，删除id属性让数据库自动生成
            const event = {
                ...baseEvent,
                id: undefined, // 明确设置为undefined，让数据库自动生成
                date: DateUtils.getLocalDateString(currentDate), // 使用本地日期字符串
                repeatId: repeatId,
                repeatType: repeatType, // 保存重复类型信息
                isRepeatInstance: true
            };
            
            events.push(event);
            eventCount++;
            
            // 根据重复类型增加日期 - 使用新的日期对象避免引用问题
            const nextDate = new Date(currentDate);
            switch (repeatType) {
                case 'daily':
                    nextDate.setDate(nextDate.getDate() + 1);
                    break;
                case 'weekly':
                    nextDate.setDate(nextDate.getDate() + 7);
                    break;
                case 'monthly':
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    break;
                case 'yearly':
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                    break;
            }
            currentDate = nextDate;
        }
        
        // 批量添加事件
        for (const event of events) {
            await this.addEvent(event);
        }
        
        this.emit('repeatEventsCreated', { repeatId, events, repeatType, endDate }); // 触发重复事件创建通知
        return events;
    }

    /**
     * 获取统计数据
     */
    getStats() {
        const total = this.events.length;
        const completed = this.events.filter(e => e.completed).length;
        const pending = total - completed;
        const unscheduled = this.getUnscheduledEvents().length;
        const repeat = this.getRepeatEvents().length;
        
        return {
            total,
            completed,
            pending,
            unscheduled,
            repeat,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    /**
     * 导出数据
     */
    exportData() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            events: this.events,
            stats: this.getStats()
        };
    }

    /**
     * 导入数据
     */
    async importData(data) {
        try {
            // 验证数据格式
            if (!data.events || !Array.isArray(data.events)) {
                throw new Error('无效的数据格式');
            }
            
            // 检查冲突
            const conflicts = [];
            const eventsToImport = [];
            
            for (const event of data.events) {
                const existingEvent = this.events.find(e => 
                    e.date === event.date && 
                    e.title === event.title && 
                    e.time === event.time
                );
                
                if (existingEvent) {
                    conflicts.push({
                        imported: event,
                        existing: existingEvent
                    });
                } else {
                    eventsToImport.push(event);
                }
            }
            
            return {
                eventsToImport,
                conflicts,
                total: data.events.length
            };
        } catch (error) {
            console.error('导入数据失败:', error);
            throw error;
        }
    }

    /**
     * 执行导入（解决冲突后）
     */
    async executeImport(events, options = {}) {
        const imported = [];
        const skipped = [];
        
        for (const event of events) {
            try {
                // 清理ID，让数据库自动生成
                const eventToImport = { ...event };
                delete eventToImport.id;
                
                const importedEvent = await this.addEvent(eventToImport);
                imported.push(importedEvent);
            } catch (error) {
                console.error('导入事件失败:', error);
                skipped.push({ event, error: error.message });
            }
        }
        
        return { imported, skipped };
    }

    /**
     * 搜索事件
     */
    searchEvents(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.events.filter(event => 
            event.title.toLowerCase().includes(lowercaseQuery) ||
            (event.details && event.details.toLowerCase().includes(lowercaseQuery))
        );
    }

    /**
     * 获取今日事件
     */
    getTodayEvents() {
        const today = DateUtils.getLocalDateString(new Date());
        return this.getEventsByDate(today);
    }

    /**
     * 获取本周事件
     */
    getWeekEvents() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        return this.getEventsByDateRange(
            DateUtils.getLocalDateString(startOfWeek),
            DateUtils.getLocalDateString(endOfWeek)
        );
    }

    /**
     * 获取本月事件
     */
    getMonthEvents() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        return this.getEventsByDateRange(
            DateUtils.getLocalDateString(startOfMonth),
            DateUtils.getLocalDateString(endOfMonth)
        );
    }
}

// 创建全局数据库实例
window.scheduleDB = new ScheduleDatabase();