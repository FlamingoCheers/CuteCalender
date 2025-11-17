/**
 * 日程管理应用 - 工具函数模块
 */

// 日期工具函数
const DateUtils = {
    /**
     * 格式化日期
     */
    formatDate(date, format = 'YYYY年MM月DD日') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[d.getDay()];
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('星期X', `星期${weekday}`);
    },

    /**
     * 格式化时间
     */
    formatTime(time) {
        if (!time) return '';
        return time; // HH:MM 格式直接返回
    },

    /**
     * 获取今天的日期字符串（本地化，避免时区问题）
     */
    getTodayString() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 获取本地化日期字符串（避免时区问题）
     */
    getLocalDateString(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 获取本周的开始和结束日期
     */
    getWeekRange(date = new Date()) {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        return {
            start: DateUtils.getLocalDateString(start),
            end: DateUtils.getLocalDateString(end)
        };
    },

    /**
     * 获取指定月份的开始和结束日期
     */
    getMonthRange(year, month) {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        
        return {
            start: DateUtils.getLocalDateString(start),
            end: DateUtils.getLocalDateString(end)
        };
    },

    /**
     * 获取指定日期所在月份的天数
     */
    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    /**
     * 获取指定月份的第一天是星期几
     */
    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    },

    /**
     * 比较两个日期
     */
    compareDates(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        if (d1 < d2) return -1;
        if (d1 > d2) return 1;
        return 0;
    },

    /**
     * 检查日期是否在范围内
     */
    isDateInRange(date, startDate, endDate) {
        const d = new Date(date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return d >= start && d <= end;
    },

    /**
     * 添加天数
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return DateUtils.getLocalDateString(result);
    },

    /**
     * 添加月份
     */
    addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return DateUtils.getLocalDateString(result);
    },

    /**
     * 添加年份
     */
    addYears(date, years) {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return DateUtils.getLocalDateString(result);
    }
};

// 类别工具函数
const CategoryUtils = {
    /**
     * 类别配置
     */
    categories: {
        personal: {
            name: '个人',
            color: '#DFDE6C',
            icon: '👤'
        },
        work: {
            name: '主业工作',
            color: '#ACBFEB',
            icon: '💼'
        },
        sideWork: {
            name: '副业工作',
            color: '#D1E9F4',
            icon: '💻'
        },
        social: {
            name: '社交',
            color: '#FAD354',
            icon: '🤝'
        },
        love: {
            name: '恋爱',
            color: '#FA86A9',
            icon: '💕'
        }
    },

    /**
     * 获取类别信息
     */
    getCategory(categoryKey) {
        return this.categories[categoryKey] || {
            name: '未知',
            color: '#6c757d',
            icon: '❓'
        };
    },

    /**
     * 获取所有类别
     */
    getAllCategories() {
        return Object.keys(this.categories).map(key => ({
            key,
            ...this.categories[key]
        }));
    },

    /**
     * 获取类别颜色
     */
    getCategoryColor(categoryKey) {
        return this.getCategory(categoryKey).color;
    },

    /**
     * 获取类别名称
     */
    getCategoryName(categoryKey) {
        return this.getCategory(categoryKey).name;
    }
};

// 重复类型工具函数
const RepeatUtils = {
    /**
     * 重复类型配置
     */
    repeatTypes: {
        daily: {
            name: '每天',
            interval: 1,
            unit: 'day'
        },
        weekly: {
            name: '每周',
            interval: 1,
            unit: 'week'
        },
        monthly: {
            name: '每月',
            interval: 1,
            unit: 'month'
        },
        yearly: {
            name: '每年',
            interval: 1,
            unit: 'year'
        }
    },

    /**
     * 获取重复类型信息
     */
    getRepeatType(typeKey) {
        return this.repeatTypes[typeKey] || null;
    },

    /**
     * 获取重复类型名称
     */
    getRepeatTypeName(typeKey) {
        const type = this.getRepeatType(typeKey);
        return type ? type.name : '';
    },

    /**
     * 生成重复日期
     */
    generateRepeatDates(startDate, repeatType, endDate) {
        const dates = [];
        const type = this.getRepeatType(repeatType);
        if (!type) return dates;

        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            dates.push(DateUtils.getLocalDateString(currentDate));
            
            switch (type.unit) {
                case 'day':
                    currentDate.setDate(currentDate.getDate() + type.interval);
                    break;
                case 'week':
                    currentDate.setDate(currentDate.getDate() + (type.interval * 7));
                    break;
                case 'month':
                    currentDate.setMonth(currentDate.getMonth() + type.interval);
                    break;
                case 'year':
                    currentDate.setFullYear(currentDate.getFullYear() + type.interval);
                    break;
            }
        }

        return dates;
    }
};

// 事件工具函数
const EventUtils = {
    /**
     * 验证事件数据（优化版本：日期时间为非必填）
     */
    validateEvent(eventData) {
        const errors = [];

        // 验证标题
        if (!eventData.title || eventData.title.trim() === '') {
            errors.push('标题不能为空');
        } else if (eventData.title.trim().length < 2) {
            errors.push('标题至少需要2个字符');
        } else if (eventData.title.trim().length > 100) {
            errors.push('标题不能超过100个字符');
        }

        // 验证日期（可选字段）
        if (eventData.date) {
            const date = new Date(eventData.date);
            if (isNaN(date.getTime())) {
                errors.push('日期格式无效');
            } else {
                // 检查日期是否合理（不能是1900年以前，不能是2100年以后）
                const year = date.getFullYear();
                if (year < 1900 || year > 2100) {
                    errors.push('请输入有效的日期（1900-2100年）');
                }
            }
        }

        // 验证类别
        if (!eventData.category) {
            errors.push('类别不能为空');
        } else if (!CategoryUtils.categories[eventData.category]) {
            errors.push('无效的类别');
        }

        // 验证时间（可选字段）
        if (eventData.time && !this.isValidTime(eventData.time)) {
            errors.push('时间格式无效');
        }

        return errors;
    },

    /**
     * 验证时间格式
     */
    isValidTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    },

    /**
     * 创建事件对象（优化版本：添加安排状态）
     */
    createEvent(data) {
        const event = {
            title: data.title.trim(),
            date: data.date || null,
            time: data.time || null,
            category: data.category,
            details: data.details ? data.details.trim() : '',
            completed: data.completed || false,
            repeatId: data.repeatId || 0,
            isRepeatInstance: data.isRepeatInstance || false,
            // 安排状态：如果没有日期或时间，则标记为未安排
            isScheduled: !!(data.date && data.time)
        };

        return event;
    },

    /**
     * 复制事件
     */
    cloneEvent(event) {
        return {
            ...event,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined
        };
    },

    /**
     * 比较事件（用于排序）
     */
    compareEvents(a, b) {
        // 首先按日期排序
        const dateCompare = DateUtils.compareDates(a.date, b.date);
        if (dateCompare !== 0) return dateCompare;

        // 然后按时间排序（未安排时间的排在后面）
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        
        return a.time.localeCompare(b.time);
    },

    /**
     * 过滤事件
     */
    filterEvents(events, filters) {
        return events.filter(event => {
            if (filters.category && event.category !== filters.category) return false;
            if (filters.completed !== undefined && event.completed !== filters.completed) return false;
            if (filters.date && event.date !== filters.date) return false;
            if (filters.dateRange) {
                if (!DateUtils.isDateInRange(event.date, filters.dateRange.start, filters.dateRange.end)) return false;
            }
            if (filters.search) {
                const query = filters.search.toLowerCase();
                if (!event.title.toLowerCase().includes(query) && 
                    !(event.details && event.details.toLowerCase().includes(query))) {
                    return false;
                }
            }
            return true;
        });
    }
};

// 字符串工具函数
const StringUtils = {
    /**
     * 截断字符串
     */
    truncate(str, maxLength = 50) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    },

    /**
     * 首字母大写
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// 数组工具函数
const ArrayUtils = {
    /**
     * 数组去重
     */
    unique(arr, key) {
        if (!key) return [...new Set(arr)];
        
        const seen = new Set();
        return arr.filter(item => {
            const value = item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    },

    /**
     * 分组
     */
    groupBy(arr, key) {
        return arr.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    },

    /**
     * 分页
     */
    paginate(arr, page, pageSize) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return arr.slice(start, end);
    }
};

// DOM工具函数
const DOMUtils = {
    /**
     * 创建元素
     */
    createElement(tag, className, content) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.innerHTML = content;
        return element;
    },

    /**
     * 显示/隐藏元素
     */
    toggle(element, show) {
        element.style.display = show ? 'block' : 'none';
    },

    /**
     * 添加事件监听
     */
    addEventListener(element, event, handler, options = {}) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.addEventListener(event, handler, options);
        }
    },

    /**
     * 移除事件监听
     */
    removeEventListener(element, event, handler) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.removeEventListener(event, handler);
        }
    },

    /**
     * 清空元素内容
     */
    clear(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.innerHTML = '';
        }
    }
};

// 本地存储工具函数
const StorageUtils = {
    /**
     * 设置本地存储
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('设置本地存储失败:', error);
            return false;
        }
    },

    /**
     * 获取本地存储
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('获取本地存储失败:', error);
            return defaultValue;
        }
    },

    /**
     * 删除本地存储
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('删除本地存储失败:', error);
            return false;
        }
    },

    /**
     * 清空本地存储
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空本地存储失败:', error);
            return false;
        }
    }
};

// 导出工具函数
window.DateUtils = DateUtils;
window.CategoryUtils = CategoryUtils;
window.RepeatUtils = RepeatUtils;
window.EventUtils = EventUtils;
window.StringUtils = StringUtils;
window.ArrayUtils = ArrayUtils;
window.DOMUtils = DOMUtils;
window.StorageUtils = StorageUtils;