/**
 * 日程管理应用 - 主应用逻辑
 */

class ScheduleApp {
    constructor() {
        this.currentView = 'workbench';
        this.currentDate = new Date();
        this.selectedEvent = null;
        this.editingRepeatEvent = null;
        this.isLoading = false;
        
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            // 等待数据库初始化
            await scheduleDB.init();
            
            // 初始化UI
            this.initUI();
            
            // 绑定事件
            this.bindEvents();
            
            // 更新导航栏日期
            this.updateNavDate();
            
            // 设置自动刷新机制
            this.setupAutoRefresh();
            
            // 渲染当前视图
            this.renderCurrentView();
            
            // 定时更新日期
            setInterval(() => this.updateNavDate(), 60000);
            
            console.log('应用初始化完成');
            
            // 显示欢迎消息
            this.showToast('欢迎使用日程管理应用！', 'success');
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showError('应用初始化失败：' + error.message);
            this.showToast('应用初始化失败，请刷新页面重试', 'error');
        }
    }

    /**
     * 设置自动刷新机制
     */
    setupAutoRefresh() {
        // 初始化刷新相关属性
        this.lastUpdateTime = Date.now();
        this.refreshTimeout = null;
        this.isLoading = false;

        // 监听数据库事件变化
        scheduleDB.addEventListener('eventAdded', (event) => {
            console.log('检测到事件添加，自动刷新界面');
            this.smartRefresh('single_add', event);
        });

        scheduleDB.addEventListener('eventUpdated', (data) => {
            console.log('检测到事件更新，自动刷新界面');
            this.smartRefresh('single_update', data.updates);
        });

        scheduleDB.addEventListener('eventDeleted', (data) => {
            console.log('检测到事件删除，自动刷新界面');
            this.smartRefresh('single_delete', data);
        });

        scheduleDB.addEventListener('eventsBatchDeleted', (data) => {
            console.log('检测到批量事件删除，自动刷新界面');
            this.smartRefresh('batch_delete', data);
        });

        scheduleDB.addEventListener('repeatEventsCreated', (data) => {
            console.log('检测到重复事件创建，自动刷新界面');
            this.smartRefresh('repeat_create', data);
        });

        // 添加窗口焦点事件监听，当用户回到页面时刷新数据
        window.addEventListener('focus', () => {
            console.log('窗口获得焦点，刷新当前视图');
            this.renderCurrentView();
        });

        // 添加可见性变化监听，当页面从后台返回时刷新
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('页面变为可见，刷新当前视图');
                this.renderCurrentView();
            }
        });

        // 添加定期刷新机制（每30秒检查一次数据变化）
        setInterval(() => {
            if (!document.hidden && !this.isLoading) {
                console.log('定期刷新检查');
                this.renderCurrentView();
            }
        }, 30000); // 30秒刷新一次

        // 添加本地存储变化监听，用于多标签页同步
        window.addEventListener('storage', (e) => {
            if (e.key === 'calendar_last_update' && e.newValue) {
                const lastUpdate = parseInt(e.newValue);
                if (lastUpdate > this.lastUpdateTime) {
                    console.log('检测到其他标签页的数据更新，刷新当前视图');
                    this.renderCurrentView();
                }
            }
        });
    }

    /**
     * 刷新受影响的视图
     */
    refreshAffectedViews(eventDate) {
        if (!eventDate) {
            this.renderCurrentView();
            return;
        }

        const eventDateObj = new Date(eventDate);
        
        // 检查事件日期是否在当前视图的显示范围内
        switch (this.currentView) {
            case 'workbench':
                // 工作台显示本周事件
                const weekRange = DateUtils.getWeekRange(this.currentDate);
                if (eventDate >= weekRange.start && eventDate <= weekRange.end) {
                    this.renderWorkbench();
                }
                break;
                
            case 'calendar':
                // 日历视图显示当天事件
                const todayStr = DateUtils.getLocalDateString(this.currentDate);
                if (eventDate === todayStr) {
                    this.renderCalendar();
                }
                break;
                
            case 'month':
                // 月历视图显示当月事件
                const monthRange = DateUtils.getMonthRange(this.currentDate.getFullYear(), this.currentDate.getMonth());
                if (eventDate >= monthRange.start && eventDate <= monthRange.end) {
                    this.renderMonth();
                }
                break;
        }
    }

    /**
     * 智能刷新 - 根据操作类型和数据变化决定刷新范围
     */
    smartRefresh(operationType, data) {
        console.log(`执行智能刷新 - 操作类型: ${operationType}`, data);
        
        // 记录最后更新时间，用于数据一致性检查
        this.lastUpdateTime = Date.now();
        
        // 通知其他标签页数据已更新
        try {
            localStorage.setItem('calendar_last_update', this.lastUpdateTime.toString());
        } catch (e) {
            console.warn('无法更新本地存储:', e);
        }
        
        // 防抖处理，避免短时间内多次刷新
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.refreshTimeout = setTimeout(() => {
            switch (operationType) {
                case 'single_add':
                case 'single_update':
                    // 单个事件添加/更新，只刷新相关日期范围
                    if (data.date) {
                        this.refreshAffectedViews(data.date);
                    } else {
                        this.renderCurrentView();
                    }
                    break;
                    
                case 'single_delete':
                case 'batch_delete':
                case 'repeat_create':
                case 'import':
                    // 删除、批量操作、重复事项创建、导入，刷新整个视图
                    this.renderCurrentView();
                    break;
                    
                case 'repeat_edit':
                    // 重复事项编辑，可能需要刷新更大范围
                    this.renderCurrentView();
                    break;
                    
                default:
                    // 默认刷新整个视图
                    this.renderCurrentView();
                    break;
            }
        }, 100); // 100ms 防抖延迟
    }

    /**
     * 初始化UI元素
     */
    initUI() {
        // 导航元素
        this.navDate = document.getElementById('currentDate');
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.importBtn = document.getElementById('importBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.addSingleBtn = document.getElementById('addSingleBtn');

        // 视图元素
        this.views = {
            workbench: document.getElementById('workbenchView'),
            calendar: document.getElementById('calendarView'),
            month: document.getElementById('monthView')
        };

        // 工作台元素
        this.weekSchedule = document.getElementById('weekSchedule');
        this.todoList = document.getElementById('todoList');

        // 日历元素
        this.dayNumber = document.getElementById('dayNumber');
        this.monthYear = document.getElementById('monthYear');
        this.weekday = document.getElementById('weekday');
        this.todoStats = document.getElementById('todoStats');
        this.dayEvents = document.getElementById('dayEvents');

        // 月历元素
        this.monthTitle = document.getElementById('monthTitle');
        this.monthGrid = document.getElementById('monthGrid');
        this.prevMonthBtn = document.getElementById('prevMonth');
        this.nextMonthBtn = document.getElementById('nextMonth');

        // 模态框元素
        this.eventModal = document.getElementById('eventModal');
        this.eventForm = document.getElementById('eventForm');
        this.modalTitle = document.getElementById('modalTitle');
        this.closeModalBtn = document.getElementById('closeModal');
        this.cancelBtn = document.getElementById('cancelBtn');

        // 重复事项模态框
        this.repeatEditModal = document.getElementById('repeatEditModal');
        this.cancelRepeatEditBtn = document.getElementById('cancelRepeatEdit');
        this.confirmRepeatEditBtn = document.getElementById('confirmRepeatEdit');

        // 删除确认模态框
        this.deleteConfirmModal = document.getElementById('deleteConfirmModal');
        this.deleteConfirmText = document.getElementById('deleteConfirmText');// 删除确认模态框
        this.cancelDeleteBtn = document.getElementById('cancelDelete');
        this.confirmDeleteBtn = document.getElementById('confirmDelete');

        // 重复事项删除选项模态框
        this.repeatDeleteModal = document.getElementById('repeatDeleteModal');
        this.cancelRepeatDeleteBtn = document.getElementById('cancelRepeatDelete');
        this.confirmRepeatDeleteBtn = document.getElementById('confirmRepeatDelete');

        // 导入模态框
        this.importModal = document.getElementById('importModal');
        this.importFile = document.getElementById('importFile');
        this.importPreview = document.getElementById('importPreview');
        this.importStats = document.getElementById('importStats');
        this.importConflicts = document.getElementById('importConflicts');
        this.closeImportModalBtn = document.getElementById('closeImportModal');
        this.cancelImportBtn = document.getElementById('cancelImport');
        this.confirmImportBtn = document.getElementById('confirmImport');

        // 重复事项选项
        this.isRepeatCheckbox = document.getElementById('isRepeat');
        this.repeatOptions = document.getElementById('repeatOptions');
        this.repeatTypeSelect = document.getElementById('repeatType');
        this.repeatEndInput = document.getElementById('repeatEnd');
        this.neverEndCheckbox = document.getElementById('neverEnd');
        this.endDateGroup = document.getElementById('endDateGroup');

        // 暂不安排选项
        this.noScheduleCheckbox = document.getElementById('noSchedule');
        this.dateTimeGroup = document.getElementById('dateTimeGroup');

        // 提示消息
        this.toast = document.getElementById('toast');
        this.toastTimeout = null; // 添加toast定时器引用
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 导航按钮
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // 操作按钮
        this.importBtn.addEventListener('click', () => this.showImportModal());
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.addSingleBtn.addEventListener('click', () => this.showEventModal());

        // 模态框事件
        this.closeModalBtn.addEventListener('click', () => this.hideEventModal());
        this.cancelBtn.addEventListener('click', () => this.hideEventModal());
        this.eventForm.addEventListener('submit', (e) => this.handleEventSubmit(e));

        // 实时验证
        this.setupRealtimeValidation();

        // 重复事项选项
        this.isRepeatCheckbox.addEventListener('change', (e) => {
            this.toggleRepeatOptions(e.target.checked);
        });

        // 永不结束复选框
        this.neverEndCheckbox.addEventListener('change', (e) => {
            this.toggleEndDateInput(!e.target.checked);
        });

        // 暂不安排复选框
        this.noScheduleCheckbox.addEventListener('change', (e) => {
            this.toggleDateTimeInputs(!e.target.checked);
        });

        // 重复编辑模态框
        this.cancelRepeatEditBtn.addEventListener('click', () => this.hideRepeatEditModal());
        this.confirmRepeatEditBtn.addEventListener('click', () => this.handleRepeatEditConfirm());

        // 删除确认模态框
        this.cancelDeleteBtn.addEventListener('click', () => this.hideDeleteConfirmModal());
        this.confirmDeleteBtn.addEventListener('click', () => this.handleDeleteConfirm());

        // 重复事项删除选项模态框
        this.cancelRepeatDeleteBtn.addEventListener('click', () => this.hideRepeatDeleteModal());
        this.confirmRepeatDeleteBtn.addEventListener('click', () => this.handleRepeatDeleteConfirm());

        // 导入模态框
        this.closeImportModalBtn.addEventListener('click', () => this.hideImportModal());
        this.cancelImportBtn.addEventListener('click', () => this.hideImportModal());
        this.importFile.addEventListener('change', (e) => this.handleImportFile(e));
        this.confirmImportBtn.addEventListener('click', () => this.handleImportConfirm());

        // 月历导航
        this.prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
        this.nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));

        // 点击模态框外部关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    /**
     * 设置实时验证
     */
    setupRealtimeValidation() {
        // 标题验证
        const titleInput = document.getElementById('eventTitle');
        const dateInput = document.getElementById('eventDate');
        const categoryInput = document.getElementById('eventCategory');

        const validateField = (input, validator, errorMsg) => {
            const value = input.value.trim();
            const isValid = validator(value);
            
            if (isValid) {
                input.classList.remove('error');
                input.classList.add('valid');
            } else {
                input.classList.add('error');
                input.classList.remove('valid');
            }
            
            return isValid;
        };

        // 标题实时验证
        titleInput.addEventListener('blur', () => {
            validateField(titleInput, 
                value => value.length >= 2 && value.length <= 100,
                '标题需要2-100个字符'
            );
        });

        titleInput.addEventListener('input', () => {
            const value = titleInput.value.trim();
            if (value.length >= 2) {
                titleInput.classList.remove('error');
                titleInput.classList.add('valid');
            }
        });

        // 日期实时验证
        dateInput.addEventListener('blur', () => {
            validateField(dateInput,
                value => {
                    if (!value) return false;
                    const date = new Date(value);
                    if (isNaN(date.getTime())) return false;
                    const year = date.getFullYear();
                    return year >= 1900 && year <= 2100;
                },
                '请输入有效的日期（1900-2100年）'
            );
        });

        dateInput.addEventListener('change', () => {
            if (dateInput.value) {
                dateInput.classList.remove('error');
                dateInput.classList.add('valid');
            }
        });

        // 类别实时验证
        categoryInput.addEventListener('change', () => {
            if (categoryInput.value) {
                categoryInput.classList.remove('error');
                categoryInput.classList.add('valid');
            }
        });
    }

    /**
     * 更新导航栏日期
     */
    updateNavDate() {
        const today = new Date();
        const dateStr = DateUtils.formatDate(today, 'YYYY年MM月DD日 星期X');
        this.navDate.textContent = dateStr;
    }

    /**
     * 切换视图
     */
    switchView(view) {
        if (this.currentView === view) return;

        // 更新导航按钮状态
        this.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // 隐藏当前视图
        if (this.views[this.currentView]) {
            this.views[this.currentView].classList.remove('active');
        }

        // 显示新视图
        this.currentView = view;
        if (this.views[view]) {
            this.views[view].classList.add('active');
        }

        // 渲染新视图
        this.renderCurrentView();
    }

    /**
     * 渲染当前视图
     */
    renderCurrentView() {
        switch (this.currentView) {
            case 'workbench':
                this.renderWorkbench();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'month':
                this.renderMonth();
                break;
        }
    }

    /**
     * 渲染工作台视图
     */
    renderWorkbench() {
        this.renderWeekSchedule();
        this.renderTodoList();
    }

    /**
     * 渲染周历
     */
    renderWeekSchedule() {
        const weekRange = DateUtils.getWeekRange(this.currentDate);
        const weekEvents = scheduleDB.getEventsByDateRange(weekRange.start, weekRange.end);
        
        // 按日期分组
        const eventsByDate = ArrayUtils.groupBy(weekEvents, 'date');
        
        // 生成周历HTML - 纵向排列布局
        let html = '';
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const today = new Date();
        
        // 使用本地日期格式，避免UTC时区问题
        const todayYear = today.getFullYear();
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        const todayDay = String(today.getDate()).padStart(2, '0');
        const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
        
        // 确保从星期日开始，调整日期顺序
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekRange.start);
            date.setDate(date.getDate() + i);
            
            // 使用本地日期格式
            const dateYear = date.getFullYear();
            const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
            const dateDay = String(date.getDate()).padStart(2, '0');
            const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;
            
            const weekday = weekdays[date.getDay()];
            const dayEvents = eventsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            
            // 按时间排序
            dayEvents.sort(EventUtils.compareEvents);
            
            html += `
                <div class="week-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    <h4>${date.getMonth() + 1}月${date.getDate()}日 星期${weekday}</h4>
                    <div class="week-day-content">
                        ${dayEvents.length > 0 ? this.renderDayEvents(dayEvents) : '<p style="color: #6c757d; text-align: center; padding: 20px;">暂无安排</p>'}
                    </div>
                </div>
            `;
        }
        
        this.weekSchedule.innerHTML = html;
    }

    /**
     * 渲染某天的日程
     */
    renderDayEvents(events) {
        return events.map(event => `
            <div class="day-event ${!event.time ? 'unscheduled' : ''} ${event.completed ? 'completed' : ''}" data-id="${event.id}">
                <div class="event-category category-${event.category}"></div>
                <div class="event-time">${event.time || '未安排'}</div>
                <div class="event-title">${StringUtils.truncate(event.title, 20)}</div>
                <div class="event-actions">
                    <button class="btn-icon" onclick="app.editEvent(${event.id})" title="编辑">✏️</button>
                    <button class="btn-icon" onclick="app.deleteEvent(${event.id})" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染待办事项列表
     */
    renderTodoList() {
        const allEvents = [...scheduleDB.events];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 首先过滤掉空白事项（无标题或标题为空字符串）
        const validEvents = allEvents.filter(event => {
            return event.title && event.title.trim() !== '' && event.title !== null && event.title !== undefined;
        });
        
        // 过滤重复事项：对于相同repeatId的事件，只保留日期最近的一项
        const filteredEvents = [];
        const repeatGroups = {};
        
        validEvents.forEach(event => {
            if (event.repeatId > 0) {
                // 如果是重复事项
                if (!repeatGroups[event.repeatId]) {
                    repeatGroups[event.repeatId] = [];
                }
                repeatGroups[event.repeatId].push(event);
            } else {
                // 非重复事项直接添加
                filteredEvents.push(event);
            }
        });
        
        // 处理每个重复组，选择日期最近的一项（排除已完成的实例）
        Object.values(repeatGroups).forEach(group => {
            // 过滤掉已完成的实例
            const incompleteEvents = group.filter(event => !event.completed);
            
            if (incompleteEvents.length > 0) {
                // 如果有未完成的实例，选择日期最近的一项
                incompleteEvents.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    
                    // 计算与今天的日期差
                    const diffA = Math.abs(dateA - today);
                    const diffB = Math.abs(dateB - today);
                    
                    return diffA - diffB; // 日期差越小越靠前
                });
                
                filteredEvents.push(incompleteEvents[0]);
            } else {
                // 如果所有实例都已完成，选择日期最近的一项
                group.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    const diffA = Math.abs(dateA - today);
                    const diffB = Math.abs(dateB - today);
                    return diffA - diffB;
                });
                
                filteredEvents.push(group[0]);
            }
        });
        
        // 排序：未安排时间的在前，然后按日期和时间排序
        filteredEvents.sort((a, b) => {
            // 未安排时间的在前
            if (!a.time && b.time) return -1;
            if (a.time && !b.time) return 1;
            
            // 按日期和时间排序
            return EventUtils.compareEvents(a, b);
        });
        
        // 渲染待办事项
        const html = filteredEvents.map(event => `
            <div class="todo-item ${!event.time ? 'unscheduled' : ''} ${event.completed ? 'completed' : ''}" 
                 data-id="${event.id}" onclick="app.editEvent(${event.id})">
                <div class="todo-header">
                    <div class="event-category category-${event.category}"></div>
                    <div class="todo-title">${StringUtils.truncate(event.title, 25)}</div>
                    <div class="todo-date">${DateUtils.formatDate(event.date, 'MM/DD')}</div>
                </div>
                <div class="todo-meta">
                    <div class="todo-time">${event.time || '未安排时间'}</div>
                    ${event.repeatId > 0 ? `<div class="todo-repeat">重复</div>` : ''}
                    <div class="todo-category">${CategoryUtils.getCategoryName(event.category)}</div>
                </div>
            </div>
        `).join('');
        
        this.todoList.innerHTML = html || '<p style="text-align: center; color: #6c757d; padding: 20px;">暂无待办事项</p>';
        
        // 记录调试信息
        console.log(`待办事项渲染完成: 总共${allEvents.length}个事件，有效事件${validEvents.length}个，最终显示${filteredEvents.length}个`);
        if (allEvents.length !== validEvents.length) {
            console.warn(`过滤掉了${allEvents.length - validEvents.length}个空白事项`);
        }
    }

    /**
     * 渲染日历视图
     */
    renderCalendar() {
        const today = this.currentDate;
        const todayStr = DateUtils.getLocalDateString(today);
        const todayEvents = scheduleDB.getEventsByDate(todayStr);
        const stats = scheduleDB.getStats();
        
        // 更新日期信息
        this.dayNumber.textContent = today.getDate();
        this.monthYear.textContent = DateUtils.formatDate(today, 'YYYY年MM月');
        this.weekday.textContent = DateUtils.formatDate(today, '星期X');
        
        // 更新统计信息
        const todayStats = todayEvents.reduce((acc, event) => {
            acc.total++;
            if (event.completed) acc.completed++;
            return acc;
        }, { total: 0, completed: 0 });
        
        this.todoStats.innerHTML = `
            <div>今日待办</div>
            <div style="font-size: 1.2em; font-weight: bold; color: #4a90e2;">
                已完成 ${todayStats.completed}/${todayStats.total}
            </div>
        `;
        
        // 渲染今日事项
        todayEvents.sort(EventUtils.compareEvents);
        const html = todayEvents.map(event => `
            <div class="event-item ${event.completed ? 'completed' : ''}" data-id="${event.id}">
                <div class="event-header">
                    <div class="event-category category-${event.category}"></div>
                    <div class="event-title">${event.title}</div>
                    <div class="event-status">
                        <span style="font-size: 0.9em; color: #6c757d;">${event.time || '未安排'}</span>
                        <div class="status-toggle ${event.completed ? 'active' : ''}" 
                             onclick="app.toggleEventComplete(${event.id})"></div>
                    </div>
                </div>
                ${event.details ? `<div class="event-details">${StringUtils.truncate(event.details, 100)}</div>` : ''}
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button class="btn-icon" onclick="app.editEvent(${event.id})" title="编辑">✏️</button>
                    <button class="btn-icon" onclick="app.deleteEvent(${event.id})" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');
        
        this.dayEvents.innerHTML = html || '<p style="text-align: center; color: #6c757d; padding: 20px;">今日暂无事项</p>';
    }

    /**
     * 渲染月历视图
     */
    renderMonth() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 更新月份标题
        this.monthTitle.textContent = `${year}年${month + 1}月`;
        
        // 生成月历网格
        const firstDay = DateUtils.getFirstDayOfMonth(year, month);
        const daysInMonth = DateUtils.getDaysInMonth(year, month);
        const todayStr = DateUtils.getLocalDateString(new Date());
        
        // 获取当月所有事件
        const monthRange = DateUtils.getMonthRange(year, month);
        const monthEvents = scheduleDB.getEventsByDateRange(monthRange.start, monthRange.end);
        
        // 按日期分组事件
        const eventsByDate = ArrayUtils.groupBy(monthEvents, 'date');
        
        let html = '';
        
        // 星期标题
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            html += `<div class="month-weekday">${day}</div>`;
        });
        
        // 填充月初空白
        for (let i = 0; i < firstDay; i++) {
            const prevDate = new Date(year, month, -firstDay + i + 1);
            html += this.renderMonthDay(prevDate, [], true);
        }
        
        // 填充当月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = DateUtils.getLocalDateString(date); // 使用本地日期字符串
            const dayEvents = eventsByDate[dateStr] || [];
            const isToday = dateStr === DateUtils.getLocalDateString(new Date());
            html += this.renderMonthDay(date, dayEvents, false, isToday);
        }
        
        // 填充月末空白
        const remainingCells = 42 - (firstDay + daysInMonth);
        for (let i = 1; i <= remainingCells; i++) {
            const nextDate = new Date(year, month + 1, i);
            html += this.renderMonthDay(nextDate, [], true);
        }
        
        this.monthGrid.innerHTML = html;
    }

    /**
     * 渲染月历中的某一天
     */
    renderMonthDay(date, events, isOtherMonth, isToday) {
        const dateStr = DateUtils.getLocalDateString(date);
        const dayDots = events.slice(0, 6).map(event => 
            `<div class="day-dot category-${event.category}"></div>`
        ).join('');
        
        return `
            <div class="month-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
                 data-date="${dateStr}" onclick="app.goToDate('${dateStr}')">
                <div class="day-number">${date.getDate()}</div>
                <div class="day-dots">${dayDots}</div>
            </div>
        `;
    }

    /**
     * 导航到指定日期
     */
    goToDate(dateStr) {
        this.currentDate = new Date(dateStr);
        this.switchView('calendar');
        // 确保日历视图重新渲染以显示新日期的事件
        this.renderCalendar();
    }

    /**
     * 月份导航
     */
    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderMonth();
    }

    /**
     * 显示事件模态框
     */
    showEventModal(isRepeat = false, event = null) {
        this.selectedEvent = event;
        
        if (event) {
            this.modalTitle.textContent = '编辑事项';
            this.populateEventForm(event);
        } else {
            this.modalTitle.textContent = '添加事项';
            this.resetEventForm();
            if (isRepeat) {
                this.isRepeatCheckbox.checked = true;
                this.toggleRepeatOptions(true);
            }
        }
        
        this.eventModal.classList.add('active');
    }

    /**
     * 隐藏事件模态框
     */
    hideEventModal() {
        this.eventModal.classList.remove('active');
        this.selectedEvent = null;
        this.resetEventForm();
    }

    /**
     * 填充事件表单
     */
    populateEventForm(event) {
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventCategory').value = event.category;
        document.getElementById('eventDetails').value = event.details || '';
        this.isRepeatCheckbox.checked = event.repeatId > 0;
        this.toggleRepeatOptions(event.repeatId > 0);
        
        // 设置暂不安排状态
        const noSchedule = !event.date && !event.time; // 没有日期和时间视为暂不安排
        this.noScheduleCheckbox.checked = noSchedule;
        this.toggleDateTimeInputs(!noSchedule);
    }

    /**
     * 重置事件表单
     */
    resetEventForm() {
        this.eventForm.reset();
        this.toggleRepeatOptions(false);
        this.toggleDateTimeInputs(true); // 重置时显示日期时间输入框
        // 清除验证状态
        const inputs = this.eventForm.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.classList.remove('error', 'valid');
        });
    }

    /**
     * 切换重复选项显示
     */
    toggleRepeatOptions(show) {
        this.repeatOptions.style.display = show ? 'block' : 'none';
        if (show) {
            // 重置永不结束选项
            this.neverEndCheckbox.checked = false;
            this.toggleEndDateInput(true);
        }
    }

    /**
     * 切换结束日期输入框显示
     */
    toggleEndDateInput(show) {
        this.endDateGroup.style.display = show ? 'block' : 'none';
        if (show) {
            this.repeatEndInput.required = true;
        } else {
            this.repeatEndInput.required = false;
            this.repeatEndInput.value = '';
        }
    }

    /**
     * 切换日期时间输入框显示
     */
    toggleDateTimeInputs(show) {
        if (show) {
            this.dateTimeGroup.classList.remove('disabled');
            this.dateTimeGroup.style.display = 'block';
            document.getElementById('eventDate').disabled = false;
            document.getElementById('eventTime').disabled = false;
        } else {
            this.dateTimeGroup.classList.add('disabled');
            this.dateTimeGroup.style.display = 'block';
            document.getElementById('eventDate').disabled = true;
            document.getElementById('eventTime').disabled = true;
            document.getElementById('eventDate').value = '';
            document.getElementById('eventTime').value = '';
        }
    }

    /**
     * 处理事件表单提交
     */
    async handleEventSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.eventForm);
        const noSchedule = this.noScheduleCheckbox.checked;
        
        const eventData = {
            title: formData.get('eventTitle'),
            date: noSchedule ? null : (formData.get('eventDate') || null),  // 暂不安排时强制为null
            time: noSchedule ? null : (formData.get('eventTime') || null),  // 暂不安排时强制为null
            category: formData.get('eventCategory'),
            details: formData.get('eventDetails'),
            completed: false,
            isScheduled: !noSchedule  // 根据暂不安排状态设置安排状态
        };
        
        // 调试信息
        console.log('表单数据:', {
            title: eventData.title,
            date: eventData.date,
            category: eventData.category,
            time: eventData.time,
            details: eventData.details,
            isScheduled: eventData.isScheduled,
            noSchedule: noSchedule
        });
        
        // 验证数据
        const errors = EventUtils.validateEvent(eventData);
        if (errors.length > 0) {
            this.showToast(errors.join('；'), 'error');
            return;
        }
        
        try {
            this.setLoading(true);
            
            if (this.selectedEvent) {
                // 编辑现有事件
                if (this.selectedEvent.repeatId > 0) {
                    // 重复事项需要特殊处理
                    this.editingRepeatEvent = { ...eventData };
                    this.showRepeatEditModal();
                } else {
                    await scheduleDB.updateEvent(this.selectedEvent.id, eventData);
                    this.showToast('事项更新成功', 'success');
                    this.hideEventModal();
                    // 使用智能刷新机制
                    this.smartRefresh('single_update', eventData);
                }
            } else {
                // 添加新事件
                if (this.isRepeatCheckbox.checked) {
                    // 创建重复事件
                    const repeatType = this.repeatTypeSelect.value;
                    const neverEnd = this.neverEndCheckbox.checked;
                    let repeatEnd = null;
                    
                    if (!neverEnd) {
                        repeatEnd = this.repeatEndInput.value;
                        if (!repeatEnd) {
                            this.showToast('请选择重复结束日期或勾选"永不结束"', 'error');
                            return;
                        }
                    }
                    
                    await scheduleDB.createRepeatEvents(eventData, repeatType, repeatEnd);
                    this.showToast('重复事项创建成功', 'success');
                    // 使用智能刷新机制
                    this.smartRefresh('repeat_create', eventData);
                } else {
                    // 创建单次事件
                    await scheduleDB.addEvent(eventData);
                    this.showToast('事项添加成功', 'success');
                    // 使用智能刷新机制
                    this.smartRefresh('single_add', eventData);
                }
                
                this.hideEventModal();
            }
        } catch (error) {
            console.error('保存事件失败:', error);
            this.showToast('保存失败，请重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 显示重复编辑选项模态框
     */
    showRepeatEditModal() {
        this.repeatEditModal.classList.add('active');
    }

    /**
     * 隐藏重复编辑选项模态框
     */
    hideRepeatEditModal() {
        this.repeatEditModal.classList.remove('active');
        this.editingRepeatEvent = null;
    }

    /**
     * 处理重复编辑确认
     */
    async handleRepeatEditConfirm() {
        const editScope = document.querySelector('input[name="editScope"]:checked').value;
        
        try {
            this.setLoading(true);
            
            if (editScope === 'single') {
                // 仅修改当前实例 - 转换为一次性事项
                const newEvent = {
                    ...this.editingRepeatEvent,
                    id: Date.now(), // 新ID
                    repeatId: 0, // 不再属于重复系列
                    isRepeatInstance: false,
                    originalRepeatId: this.selectedEvent.repeatId // 保留原始repeatId用于追踪
                };
                await scheduleDB.addEvent(newEvent);
                // 使用智能刷新机制
                this.smartRefresh('single_add', newEvent);
            } else {
                // 修改此后所有实例
                // 1. 删除原系列中当前日期及以后的所有实例
                await scheduleDB.deleteEventsByRepeatId(
                    this.selectedEvent.repeatId, 
                    this.selectedEvent.date
                );
                
                // 2. 基于修改后的参数创建新的重复系列
                const newRepeatEvent = {
                    ...this.editingRepeatEvent,
                    repeatId: Date.now(), // 新的重复ID
                    date: this.selectedEvent.date // 从当前日期开始
                };
                
                await scheduleDB.createRepeatEvents(
                    newRepeatEvent,
                    this.selectedEvent.repeatType || 'weekly',
                    this.editingRepeatEvent.repeatEnd || null
                );
                // 使用智能刷新机制
                this.smartRefresh('repeat_edit', newRepeatEvent);
            }
            
            this.showToast('事项更新成功', 'success');
            this.hideRepeatEditModal();
            this.hideEventModal();
        } catch (error) {
            console.error('更新重复事项失败:', error);
            this.showToast('更新失败，请重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 编辑事件
     */
    editEvent(id) {
        const event = scheduleDB.events.find(e => e.id === id);
        if (event) {
            this.showEventModal(false, event);
        }
    }

    /**
     * 删除事件
     */
    deleteEvent(id) {
        const event = scheduleDB.events.find(e => e.id === id);
        if (event) {
            this.selectedEvent = event;
            
            if (event.repeatId > 0) {
                // 重复事项显示删除选项
                this.repeatDeleteModal.classList.add('active');
            } else {
                // 普通事项显示简单确认
                this.deleteConfirmText.textContent = `确定要删除"${event.title}"吗？`;
                this.deleteConfirmModal.classList.add('active');
            }
        }
    }

    /**
     * 隐藏删除确认模态框
     */
    hideDeleteConfirmModal() {
        this.deleteConfirmModal.classList.remove('active');
        this.selectedEvent = null;
    }

    /**
     * 处理删除确认
     */
    async handleDeleteConfirm() {
        // 添加null检查并缓存selectedEvent到本地变量
        if (!this.selectedEvent) {
            console.warn('删除确认：selectedEvent为null，可能已被其他操作清除');
            return;
        }
        
        // 将selectedEvent缓存到本地变量，避免异步操作期间被修改
        const eventToDelete = this.selectedEvent;
        
        try {
            this.setLoading(true);
            console.log('开始删除事件:', eventToDelete.id);
            
            // 先隐藏模态框，避免用户重复点击
            this.hideDeleteConfirmModal();
            
            const result = await scheduleDB.deleteEvent(eventToDelete.id);
            console.log('删除事件结果:', result);
            
            // 确保删除操作完全完成后再显示成功消息
            if (result === eventToDelete.id) {
                this.showToast('事项删除成功', 'success');
                // 使用智能刷新机制
                this.smartRefresh('single_delete', { id: eventToDelete.id });
            } else {
                throw new Error('删除操作返回了意外的结果');
            }
        } catch (error) {
            console.error('删除事件失败:', error);
            this.showToast('删除失败，请重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 隐藏重复事项删除模态框
     */
    hideRepeatDeleteModal() {
        this.repeatDeleteModal.classList.remove('active');
        this.selectedEvent = null;
    }

    /**
     * 处理重复事项删除确认
     */
    async handleRepeatDeleteConfirm() {
        // 添加null检查并缓存selectedEvent到本地变量
        if (!this.selectedEvent) {
            console.warn('重复事项删除确认：selectedEvent为null，可能已被其他操作清除');
            return;
        }
        
        // 将selectedEvent缓存到本地变量，避免异步操作期间被修改
        const eventToDelete = this.selectedEvent;
        
        const deleteScope = document.querySelector('input[name="deleteScope"]:checked').value;
        
        try {
            this.setLoading(true);
            console.log(`开始删除重复事项，范围: ${deleteScope}, 事件ID: ${eventToDelete.id}`);
            
            let deleteResult = null;
            
            switch (deleteScope) {
                case 'single':
                    // 仅删除当前实例
                    deleteResult = await scheduleDB.deleteEvent(eventToDelete.id);
                    console.log('单个删除结果:', deleteResult);
                    // 使用智能刷新机制
                    this.smartRefresh('single_delete', { id: eventToDelete.id });
                    break;
                    
                case 'future':
                    // 删除此后所有实例
                    deleteResult = await scheduleDB.deleteEventsByRepeatId(
                        eventToDelete.repeatId, 
                        eventToDelete.date
                    );
                    console.log('未来删除结果:', deleteResult);
                    // 使用智能刷新机制
                    this.smartRefresh('batch_delete', { repeatId: eventToDelete.repeatId });
                    break;
                    
                case 'all':
                    // 删除整个重复系列
                    deleteResult = await scheduleDB.deleteEventsByRepeatId(eventToDelete.repeatId);
                    console.log('全部删除结果:', deleteResult);
                    // 使用智能刷新机制
                    this.smartRefresh('batch_delete', { repeatId: eventToDelete.repeatId });
                    break;
            }
            
            // 验证删除结果
            if (deleteResult !== null && deleteResult !== undefined) {
                // 先隐藏模态框
                this.hideRepeatDeleteModal();
                this.showToast('事项删除成功', 'success');
            } else {
                throw new Error('删除操作返回了无效的结果');
            }
            
        } catch (error) {
            console.error('删除重复事项失败:', error);
            this.showToast('删除失败，请重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 切换事件完成状态
     */
    async toggleEventComplete(id) {
        const event = scheduleDB.events.find(e => e.id === id);
        if (event) {
            try {
                // 如果是重复事项，直接更新状态，不创建新实例
                if (event.repeatId > 0) {
                    // 直接更新原事项的完成状态
                    await scheduleDB.updateEvent(id, { completed: !event.completed });
                    this.showToast(event.completed ? '标记为未完成' : '标记为已完成', 'success');
                    
                    // 使用智能刷新机制
                    this.smartRefresh('single_update', { id, date: event.date });
                } else {
                    // 普通事项直接更新状态
                    await scheduleDB.updateEvent(id, { completed: !event.completed });
                    this.showToast(event.completed ? '标记为未完成' : '标记为已完成', 'success');
                    
                    // 使用智能刷新机制
                    this.smartRefresh('single_update', { id, date: event.date });
                }
            } catch (error) {
                console.error('更新事件状态失败:', error);
                this.showToast('更新失败，请重试', 'error');
            }
        }
    }

    /**
     * 显示导入模态框
     */
    showImportModal() {
        this.importModal.classList.add('active');
    }

    /**
     * 隐藏导入模态框
     */
    hideImportModal() {
        this.importModal.classList.remove('active');
        this.importFile.value = '';
        this.importPreview.style.display = 'none';
        this.confirmImportBtn.disabled = true;
    }

    /**
     * 处理导入文件
     */
    async handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // 验证数据格式
            const result = await scheduleDB.importData(data);
            
            // 显示导入预览
            this.showImportPreview(result);
            
        } catch (error) {
            console.error('读取导入文件失败:', error);
            this.showToast('文件格式错误，请选择有效的JSON文件', 'error');
        }
    }

    /**
     * 显示导入预览
     */
    showImportPreview(result) {
        const { eventsToImport, conflicts, total } = result;
        
        this.importStats.innerHTML = `
            <p>总计: ${total} 个事项</p>
            <p>可导入: ${eventsToImport.length} 个事项</p>
            <p>冲突: ${conflicts.length} 个事项</p>
        `;
        
        if (conflicts.length > 0) {
            this.importConflicts.innerHTML = `
                <h5>冲突事项:</h5>
                ${conflicts.map(conflict => `
                    <div class="conflict-item">
                        <strong>${conflict.imported.title}</strong><br>
                        <small>${conflict.imported.date} ${conflict.imported.time || ''}</small><br>
                        <small>冲突原因: 已存在相同日期和时间的事项</small>
                    </div>
                `).join('')}
            `;
        } else {
            this.importConflicts.innerHTML = '';
        }
        
        this.importPreview.style.display = 'block';
        this.confirmImportBtn.disabled = eventsToImport.length === 0;
        
        // 保存导入数据供确认时使用
        this.importData = eventsToImport;
    }

    /**
     * 处理导入确认
     */
    async handleImportConfirm() {
        if (!this.importData || this.importData.length === 0) return;
        
        try {
            this.setLoading(true);
            
            const result = await scheduleDB.executeImport(this.importData);
            
            this.showToast(`成功导入 ${result.imported.length} 个事项`, 'success');
            this.hideImportModal();
            // 使用智能刷新机制
            this.smartRefresh('import', { count: result.imported.length });
            
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('导入失败，请重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 导出数据
     */
    exportData() {
        try {
            const data = scheduleDB.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `schedule_backup_${DateUtils.getTodayString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.showToast('数据导出成功', 'success');
        } catch (error) {
            console.error('导出失败:', error);
            this.showToast('导出失败，请重试', 'error');
        }
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        // 清除之前的定时器
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        // 设置消息内容和类型
        this.toast.textContent = message;
        this.toast.className = `toast ${type}`;
        
        // 强制重排以确保动画触发
        this.toast.offsetHeight;
        
        // 显示提示消息
        this.toast.classList.add('show');
        
        // 设置自动隐藏定时器
        this.toastTimeout = setTimeout(() => {
            this.hideToast();
        }, 4000); // 4秒后自动隐藏
    }
    
    /**
     * 隐藏提示消息
     */
    hideToast() {
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
            this.toastTimeout = null;
        }
        
        this.toast.classList.remove('show');
        
        // 在动画完成后确保完全隐藏
        setTimeout(() => {
            this.toast.style.visibility = 'hidden';
            setTimeout(() => {
                this.toast.style.visibility = 'visible';
            }, 100);
        }, 300);
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.isLoading = loading;
        document.body.style.cursor = loading ? 'wait' : 'default';
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        if (errorContainer && errorMessage) {
            errorMessage.textContent = message;
            errorContainer.style.display = 'block';
        }
    }

    /**
     * 隐藏所有模态框
     */
    hideAllModals() {
        this.hideEventModal();
        this.hideRepeatEditModal();
        this.hideDeleteConfirmModal();
        this.hideRepeatDeleteModal();
        this.hideImportModal();
    }
}

// 初始化应用
const app = new ScheduleApp();

// 全局函数供HTML调用
window.goToDate = (dateStr) => app.goToDate(dateStr);
window.editEvent = (id) => app.editEvent(id);
window.deleteEvent = (id) => app.deleteEvent(id);
window.toggleEventComplete = (id) => app.toggleEventComplete(id);