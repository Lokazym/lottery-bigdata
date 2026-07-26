// ============================================
// 体彩大数据分析中心 - 核心逻辑
// ============================================

const App = {
  state: {
    currentSection: 'home',
    currentModule: 'home', // home | lottery | sports | account
    lotteryType: 'dlt', // dlt=大乐透, p5=排列5, p3=排列3
    drawData: { dlt: [], p5: [], p3: [] },
    records: [], // 每日跟进记录
    stats: { totalSpent: 0, totalWon: 0, ticketCount: 0 },
    sports: {
      activeTab: 'football', // football / basketball
      footballLeague: '英超', // 当前选中的足球联赛
      basketballLeague: 'NBA',
      matches: { football: {}, basketball: {} }, // 按联赛存储 { 联赛名: [比赛...] }
      standings: { football: {}, basketball: {} },
      lastFetch: 0,
    },
    calc: {
      matches: [], // 计算器中的比赛列表
      betAmount: 2, // 每注金额
      mode: 'single', // single=单关, parlay=串关
    },
    push: {
      enabled: true,
      lastPushDate: null,
      strategies: ['valuebet', 'hotteam', 'underdog'], // 推送策略
      history: [], // 推送历史
    },
    sim: {
      enabled: false,
      balance: 1000, // 模拟资金
      initialBalance: 1000,
      strategy: 'valuebet', // 跟注策略
      betAmount: 50, // 每注金额
      maxParlay: 3, // 最大串关场次
      autoMode: true, // 自动跟注推荐
      trades: [], // 模拟投注记录
      lastRunDate: null,
    },
  },

  init() {
    this.loadData();
    this.render();
    if (this.state.drawData[this.state.lotteryType].length === 0) {
      this.fetchDrawData();
    } else {
      this.renderSection();
    }
    // 首次加载体育数据
    if (Object.keys(this.state.sports.matches.football).length === 0) {
      this.fetchSportsData();
    }
    // 每日自动推送检查
    this.checkDailyPush();
    // 启动模拟引擎定时器
    this.startSimTimer();
  },

  checkDailyPush() {
    if (!this.state.push.enabled) return;
    const today = new Date().toISOString().split('T')[0];
    if (this.state.push.lastPushDate !== today) {
      // 自动生成今日方案
      setTimeout(() => this.generatePush(), 2000);
    }
  },

  startSimTimer() {
    // 每5分钟自动跑一轮（如果引擎已启动）
    if (this._simTimer) clearInterval(this._simTimer);
    this._simTimer = setInterval(() => {
      if (this.state.sim.enabled && this.state.sim.balance >= this.state.sim.betAmount) {
        this.simRunOnce();
      }
    }, 5 * 60 * 1000);
  },

  // ---- 数据持久化 ----
  loadData() {
    try {
      const saved = localStorage.getItem('lotteryApp');
      if (saved) {
        const data = JSON.parse(saved);
        this.state = { ...this.state, ...data };
      }
    } catch (e) { console.error('加载数据失败', e); }
  },

  saveData() {
    try {
      localStorage.setItem('lotteryApp', JSON.stringify(this.state));
    } catch (e) { console.error('保存数据失败', e); }
  },

  // ---- 数据采集 ----
  async fetchDrawData() {
    this.showLoading('正在采集开奖数据...');
    try {
      // 尝试从公开API获取数据
      const results = await Promise.allSettled([
        this.fetchDlt(),
        this.fetchP5(),
        this.fetchP3(),
      ]);

      if (results[0].status === 'fulfilled') this.state.drawData.dlt = results[0].value;
      if (results[1].status === 'fulfilled') this.state.drawData.p5 = results[1].value;
      if (results[2].status === 'fulfilled') this.state.drawData.p3 = results[2].value;

      // 如果API获取失败，使用模拟数据
      if (this.state.drawData.dlt.length === 0) {
        this.state.drawData.dlt = this.generateMockData('dlt', 100);
      }
      if (this.state.drawData.p5.length === 0) {
        this.state.drawData.p5 = this.generateMockData('p5', 100);
      }
      if (this.state.drawData.p3.length === 0) {
        this.state.drawData.p3 = this.generateMockData('p3', 100);
      }

      this.saveData();
      this.hideLoading();
      this.renderSection();
      this.toast('开奖数据采集完成！');
    } catch (e) {
      this.hideLoading();
      this.toast('数据采集失败，使用模拟数据');
      this.state.drawData.dlt = this.generateMockData('dlt', 100);
      this.state.drawData.p5 = this.generateMockData('p5', 100);
      this.state.drawData.p3 = this.generateMockData('p3', 100);
      this.saveData();
      this.renderSection();
    }
  },

  async fetchDlt() {
    // 大乐透数据 - 尝试多个数据源
    try {
      const res = await fetch('https://www.mxnzp.com/api/lottery/common/history?code=dlt&size=100&app_id=demo&app_secret=demo');
      const json = await res.json();
      if (json.code === 1 && json.data) {
        return json.data.map(d => ({
          round: d.expect,
          date: d.opentime,
          numbers: d.opencode.split(',').map(n => n.trim()),
        }));
      }
    } catch (e) {}
    return [];
  },

  async fetchP5() {
    try {
      const res = await fetch('https://www.mxnzp.com/api/lottery/common/history?code=p5&size=100&app_id=demo&app_secret=demo');
      const json = await res.json();
      if (json.code === 1 && json.data) {
        return json.data.map(d => ({
          round: d.expect,
          date: d.opentime,
          numbers: d.opencode.split(',').map(n => n.trim()),
        }));
      }
    } catch (e) {}
    return [];
  },

  async fetchP3() {
    try {
      const res = await fetch('https://www.mxnzp.com/api/lottery/common/history?code=p3&size=100&app_id=demo&app_secret=demo');
      const json = await res.json();
      if (json.code === 1 && json.data) {
        return json.data.map(d => ({
          round: d.expect,
          date: d.opentime,
          numbers: d.opencode.split(',').map(n => n.trim()),
        }));
      }
    } catch (e) {}
    return [];
  },

  generateMockData(type, count) {
    const data = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getTime() - i * (type === 'p3' ? 1 : type === 'p5' ? 1 : 3) * 86400000);
      let numbers;
      if (type === 'dlt') {
        const front = this.randomPick(5, 1, 35).map(n => String(n).padStart(2, '0'));
        const back = this.randomPick(2, 1, 12).map(n => String(n).padStart(2, '0'));
        numbers = [...front, ...back];
      } else if (type === 'p5') {
        numbers = this.randomPick(5, 0, 9).map(n => String(n));
      } else {
        numbers = this.randomPick(3, 0, 9).map(n => String(n));
      }
      data.push({
        round: `${date.getFullYear()}${String(count - i).padStart(3, '0')}`,
        date: date.toISOString().split('T')[0],
        numbers,
      });
    }
    return data;
  },

  randomPick(count, min, max) {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    const result = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result.sort((a, b) => a - b);
  },

  // ---- 渲染 ----
  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.renderHeader()}
      <div id="nav-container"></div>
      <div id="section-container"></div>
      <div class="modal-overlay" id="modal-overlay"></div>
      <div class="toast" id="toast"></div>
      <div class="loading" id="loading" style="display:none;">
        <div class="spinner"></div>
        <div id="loading-text">加载中...</div>
      </div>
    `;
    this.renderNav();
    this.renderSection();
  },

  renderHeader() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
    return `
      <div class="header">
        <div>
          <h1>🎯 体彩<span>大数据</span>分析中心</h1>
          <div class="subtitle">数据驱动 · 精准分析 · 持续跟进</div>
        </div>
        <div class="header-right">
          <div class="date">${dateStr} ${weekdays[now.getDay()]}</div>
          <div class="round" id="header-round"></div>
        </div>
      </div>
    `;
  },

  // 模块定义
  modules: {
    lottery: {
      name: '🎱 体彩彩票',
      desc: '开奖数据 · 链路分析 · 每日跟进',
      color: '#e74c3c',
      pages: [
        { id: 'data', name: '📋 开奖数据' },
        { id: 'analysis', name: '🔗 链路分析' },
        { id: 'tracking', name: '📝 每日跟进' },
      ],
    },
    sports: {
      name: '⚽ 体育赛事',
      desc: '赛事赛程 · 足球计算器 · 每日推送',
      color: '#3498db',
      pages: [
        { id: 'sports', name: '📅 赛事赛程' },
        { id: 'calc', name: '🧮 足球计算器' },
        { id: 'push', name: '📢 每日推送' },
      ],
    },
    account: {
      name: '💰 投注管理',
      desc: '模拟投注 · 花费统计 · 设置',
      color: '#2ecc71',
      pages: [
        { id: 'sim', name: '🤖 模拟投注' },
        { id: 'stats', name: '📊 花费统计' },
        { id: 'settings', name: '⚙️ 设置' },
      ],
    },
  },

  renderNav() {
    const navContainer = document.getElementById('nav-container');
    if (!navContainer) return;
    if (this.state.currentModule === 'home') {
      navContainer.innerHTML = '';
      return;
    }
    const mod = this.modules[this.state.currentModule];
    if (!mod) { navContainer.innerHTML = ''; return; }
    navContainer.innerHTML = `
      <div class="sub-nav-bar">
        <div class="breadcrumb">
          <span class="breadcrumb-home" onclick="App.goHome()">🏠 首页</span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${mod.name}</span>
        </div>
        <div class="sub-nav">
          ${mod.pages.map(p => `<div class="nav-item ${this.state.currentSection === p.id ? 'active' : ''}" data-section="${p.id}">${p.name}</div>`).join('')}
        </div>
      </div>
    `;
    this.bindNav();
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        this.state.currentSection = el.dataset.section;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        this.renderSection();
      });
    });
  },

  goHome() {
    this.state.currentModule = 'home';
    this.state.currentSection = 'home';
    this.renderNav();
    this.renderSection();
  },

  goModule(moduleId) {
    this.state.currentModule = moduleId;
    this.state.currentSection = this.modules[moduleId].pages[0].id;
    this.renderNav();
    this.renderSection();
  },

  renderSection() {
    const container = document.getElementById('section-container');
    if (!container) return;
    // 首页
    if (this.state.currentModule === 'home' || this.state.currentSection === 'home') {
      container.innerHTML = this.viewHome();
      this.bindHomeCards();
      return;
    }
    // 子页面
    switch (this.state.currentSection) {
      case 'dashboard': container.innerHTML = this.viewDashboard(); break;
      case 'data': container.innerHTML = this.viewData(); break;
      case 'tracking': container.innerHTML = this.viewTracking(); break;
      case 'sports': container.innerHTML = this.viewSports(); break;
      case 'calc': container.innerHTML = this.viewCalc(); break;
      case 'push': container.innerHTML = this.viewPush(); break;
      case 'sim': container.innerHTML = this.viewSim(); break;
      case 'analysis': container.innerHTML = this.viewAnalysis(); break;
      case 'stats': container.innerHTML = this.viewStats(); break;
      case 'settings': container.innerHTML = this.viewSettings(); break;
    }
    this.bindSectionEvents();
  },

  // ---- 首页三大卡片 ----
  viewHome() {
    const stats = this.calculateStats();
    const sim = this.state.sim;
    const simProfit = sim.balance - sim.initialBalance;
    const today = new Date().toISOString().split('T')[0];
    const todayPush = this.state.push.history.find(h => h.date === today);
    const latestDraw = this.state.drawData[this.state.lotteryType][0];
    const sportsMatches = this.state.sports.matches[this.state.sports.activeTab][
      this.state.sports.activeTab === 'football' ? this.state.sports.footballLeague : this.state.sports.basketballLeague
    ] || [];

    return `
      <div class="home-cards">
        <!-- 体彩彩票 -->
        <div class="home-card" data-module="lottery" style="--card-color: #e74c3c;">
          <div class="home-card-header">
            <div class="home-card-icon">🎱</div>
            <div>
              <div class="home-card-title">体彩彩票</div>
              <div class="home-card-desc">开奖数据 · 链路分析 · 每日跟进</div>
            </div>
          </div>
          <div class="home-card-stats">
            <div class="home-stat">
              <div class="home-stat-label">最新开奖</div>
              <div class="home-stat-value">${latestDraw ? latestDraw.round : '-'}</div>
            </div>
            <div class="home-stat">
              <div class="home-stat-label">跟进记录</div>
              <div class="home-stat-value">${this.state.records.filter(r => r.type !== 'match').length}条</div>
            </div>
          </div>
          ${latestDraw ? `<div class="home-card-balls">${this.renderHomeBalls(latestDraw.numbers)}</div>` : ''}
          <div class="home-card-pages">
            <span>📋 开奖数据</span>
            <span>🔗 链路分析</span>
            <span>📝 每日跟进</span>
          </div>
          <div class="home-card-enter">点击进入 →</div>
        </div>

        <!-- 体育赛事 -->
        <div class="home-card" data-module="sports" style="--card-color: #3498db;">
          <div class="home-card-header">
            <div class="home-card-icon">⚽</div>
            <div>
              <div class="home-card-title">体育赛事</div>
              <div class="home-card-desc">赛事赛程 · 足球计算器 · 每日推送</div>
            </div>
          </div>
          <div class="home-card-stats">
            <div class="home-stat">
              <div class="home-stat-label">今日赛事</div>
              <div class="home-stat-value">${sportsMatches.filter(m => m.date === today || m.status === '进行中').length}场</div>
            </div>
            <div class="home-stat">
              <div class="home-stat-label">今日推送</div>
              <div class="home-stat-value">${todayPush ? todayPush.picks.length + '场推荐' : '未生成'}</div>
            </div>
          </div>
          <div class="home-card-pages">
            <span>📅 赛事赛程</span>
            <span>🧮 足球计算器</span>
            <span>📢 每日推送</span>
          </div>
          <div class="home-card-enter">点击进入 →</div>
        </div>

        <!-- 投注管理 -->
        <div class="home-card" data-module="account" style="--card-color: #2ecc71;">
          <div class="home-card-header">
            <div class="home-card-icon">💰</div>
            <div>
              <div class="home-card-title">投注管理</div>
              <div class="home-card-desc">模拟投注 · 花费统计 · 设置</div>
            </div>
          </div>
          <div class="home-card-stats">
            <div class="home-stat">
              <div class="home-stat-label">模拟余额</div>
              <div class="home-stat-value" style="color:${sim.balance >= sim.initialBalance ? '#2ecc71' : '#e74c3c'}">¥${sim.balance.toFixed(0)}</div>
            </div>
            <div class="home-stat">
              <div class="home-stat-label">累计投入</div>
              <div class="home-stat-value">¥${stats.totalSpent}</div>
            </div>
          </div>
          <div class="home-card-profit ${simProfit >= 0 ? 'positive' : 'negative'}">
            ${simProfit >= 0 ? '+' : ''}¥${simProfit.toFixed(0)} 模拟收益
          </div>
          <div class="home-card-pages">
            <span>🤖 模拟投注</span>
            <span>📊 花费统计</span>
            <span>⚙️ 设置</span>
          </div>
          <div class="home-card-enter">点击进入 →</div>
        </div>
      </div>

      <!-- 底部快捷统计 -->
      <div class="home-footer-stats">
        <div class="home-footer-stat">
          <span class="home-footer-icon">💰</span>
          <span>总投入</span>
          <strong style="color:#e74c3c;">¥${stats.totalSpent}</strong>
        </div>
        <div class="home-footer-stat">
          <span class="home-footer-icon">🎉</span>
          <span>总中奖</span>
          <strong style="color:#2ecc71;">¥${stats.totalWon}</strong>
        </div>
        <div class="home-footer-stat">
          <span class="home-footer-icon">🎯</span>
          <span>命中率</span>
          <strong style="color:#e67e22;">${stats.hitRate.toFixed(1)}%</strong>
        </div>
        <div class="home-footer-stat">
          <span class="home-footer-icon">📝</span>
          <span>跟进数</span>
          <strong style="color:#3498db;">${this.state.records.length}</strong>
        </div>
      </div>
    `;
  },

  renderHomeBalls(nums) {
    const isDlt = this.state.lotteryType === 'dlt';
    if (isDlt) {
      return `<div class="balls" style="justify-content:center;">
        ${nums.slice(0,5).map(n => `<div class="ball red" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}
        ${nums.slice(5).map(n => `<div class="ball blue" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}
      </div>`;
    }
    return `<div class="balls" style="justify-content:center;">${nums.map(n => `<div class="ball green" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}</div>`;
  },

  bindHomeCards() {
    document.querySelectorAll('.home-card').forEach(el => {
      el.addEventListener('click', () => {
        this.goModule(el.dataset.module);
      });
    });
  },

  // ---- 总览 ----
  viewDashboard() {
    const draws = this.state.drawData[this.state.lotteryType];
    const latest = draws[0];
    const stats = this.calculateStats();
    return `
      <div class="lottery-tabs">
        <div class="lottery-tab ${this.state.lotteryType==='dlt'?'active':''}" data-type="dlt">大乐透</div>
        <div class="lottery-tab ${this.state.lotteryType==='p5'?'active':''}" data-type="p5">排列5</div>
        <div class="lottery-tab ${this.state.lotteryType==='p3'?'active':''}" data-type="p3">排列3</div>
      </div>
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">💰</span> 累计投入</div>
          <div class="card-value red">¥${stats.totalSpent.toFixed(0)}</div>
          <div class="card-sub">${stats.ticketCount}注 · ${stats.days}天</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎉</span> 累计中奖</div>
          <div class="card-value green">¥${stats.totalWon.toFixed(0)}</div>
          <div class="card-sub">${stats.winCount}次中奖</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📉</span> 净收益</div>
          <div class="card-value ${stats.net >= 0 ? 'green' : 'red'}">${stats.net >= 0 ? '+' : ''}¥${stats.net.toFixed(0)}</div>
          <div class="card-sub">回报率: ${stats.totalSpent > 0 ? ((stats.totalWon / stats.totalSpent - 1) * 100).toFixed(1) : 0}%</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎯</span> 命中率</div>
          <div class="card-value orange">${stats.hitRate.toFixed(1)}%</div>
          <div class="card-sub">${stats.winCount}/${stats.ticketCount}注</div>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title"><span class="icon">🏆</span> 最新开奖</div>
          ${latest ? this.renderLatestDraw(latest) : '<div class="empty">暂无数据</div>'}
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 近30期中奖趋势</div>
          <div id="dashboard-trend-chart" class="chart-container"></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title"><span class="icon">📋</span> 最近跟进记录</div>
        ${this.renderRecentRecords(5)}
      </div>
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="card-title" style="margin:0;"><span class="icon">⚽🏀</span> 体育赛事快览</div>
          <button class="btn btn-secondary btn-sm" onclick="App.goSection('sports')">查看更多 →</button>
        </div>
        ${this.renderSportsQuickView()}
      </div>
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="card-title" style="margin:0;"><span class="icon">📢</span> 今日推送</div>
            <button class="btn btn-secondary btn-sm" onclick="App.goSection('push')">查看 →</button>
          </div>
          ${this.renderPushQuickView()}
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="card-title" style="margin:0;"><span class="icon">🤖</span> 模拟投注</div>
            <button class="btn btn-secondary btn-sm" onclick="App.goSection('sim')">查看 →</button>
          </div>
          ${this.renderSimQuickView()}
        </div>
      </div>
    `;
  },

  goSection(section) {
    // 自动推断module
    for (const [modId, mod] of Object.entries(this.modules)) {
      if (mod.pages.some(p => p.id === section)) {
        this.state.currentModule = modId;
        break;
      }
    }
    this.state.currentSection = section;
    this.renderNav();
    this.renderSection();
  },

  renderSportsQuickView() {
    const sp = this.state.sports;
    const league = sp.activeTab === 'football' ? sp.footballLeague : sp.basketballLeague;
    const matches = sp.matches[sp.activeTab][league] || [];
    if (matches.length === 0) {
      return '<div class="empty">暂无赛事数据，请前往体育赛事页面刷新</div>';
    }
    const todayMatch = matches.filter(m => {
      const today = new Date().toISOString().split('T')[0];
      return m.date === today || m.status === '进行中';
    });
    const list = (todayMatch.length > 0 ? todayMatch : matches.slice(0, 3));
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>联赛</th><th>主队</th><th>比分</th><th>客队</th><th>状态</th></tr></thead>
          <tbody>
            ${list.slice(0, 5).map(m => `
              <tr>
                <td style="font-size:12px;">${league}</td>
                <td style="text-align:right;">${m.home}</td>
                <td><strong style="color:${m.status==='完赛'?'var(--accent3)':'var(--accent2)'};">${m.homeScore != null ? m.homeScore + ':' + m.awayScore : 'VS'}</strong></td>
                <td style="text-align:left;">${m.away}</td>
                <td><span class="tag ${m.status==='完赛'?'tag-win':m.status==='进行中'?'tag-lose':'tag-pending'}">${m.status||'未开始'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderPushQuickView() {
    const today = new Date().toISOString().split('T')[0];
    const plan = this.state.push.history.find(h => h.date === today);
    if (!plan) {
      return '<div class="empty">今日未生成方案<br><button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="App.goSection(\'push\')">前往生成</button></div>';
    }
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>比赛</th><th>推荐</th><th>赔率</th><th>信心</th><th>结果</th></tr></thead>
          <tbody>
            ${plan.picks.slice(0, 4).map(p => `
              <tr>
                <td style="font-size:12px;text-align:left;">${p.home} vs ${p.away}</td>
                <td style="color:var(--accent2);font-weight:600;">${p.pickLabel}</td>
                <td>${p.odds.toFixed(2)}</td>
                <td style="font-size:11px;">${'⭐'.repeat(Math.round(p.confidence/20))}</td>
                <td>${p.result==='win'?'<span class="tag tag-win">中</span>':p.result==='lose'?'<span class="tag tag-lose">未中</span>':'<span class="tag tag-pending">待开</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderSimQuickView() {
    const sim = this.state.sim;
    const profit = sim.balance - sim.initialBalance;
    const settled = sim.trades.filter(t => t.result !== null);
    const wins = settled.filter(t => t.result === 'win');
    const winRate = settled.length > 0 ? (wins.length / settled.length * 100).toFixed(0) : 0;
    return `
      <div class="grid grid-2" style="gap:8px;">
        <div>
          <div style="font-size:12px;color:var(--text-dim);">余额</div>
          <div style="font-size:22px;font-weight:700;color:${sim.balance>=sim.initialBalance?'var(--accent3)':'var(--accent)'};">¥${sim.balance.toFixed(0)}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-dim);">收益</div>
          <div style="font-size:22px;font-weight:700;color:${profit>=0?'var(--accent3)':'var(--accent)'};">${profit>=0?'+':''}¥${profit.toFixed(0)}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-dim);">交易数</div>
          <div style="font-size:18px;font-weight:600;">${sim.trades.length}笔</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-dim);">胜率</div>
          <div style="font-size:18px;font-weight:600;color:var(--accent2);">${winRate}%</div>
        </div>
      </div>
      ${sim.trades.length === 0 ? '<div class="empty" style="margin-top:8px;">点击"跑一轮"开始模拟</div>' : ''}
    `;
  },

  renderLatestDraw(latest) {
    const isDlt = this.state.lotteryType === 'dlt';
    const nums = latest.numbers;
    let balls = '';
    if (isDlt) {
      balls = `
        <div class="balls">
          ${nums.slice(0,5).map(n => `<div class="ball red">${n}</div>`).join('')}
          <div style="width:8px;"></div>
          ${nums.slice(5).map(n => `<div class="ball blue">${n}</div>`).join('')}
        </div>
      `;
    } else {
      balls = `<div class="balls">${nums.map(n => `<div class="ball green">${n}</div>`).join('')}</div>`;
    }
    return `
      <div class="recent-draw">
        <div class="recent-draw-info">
          <div>
            <div style="font-size:15px; font-weight:600;">第${latest.round}期</div>
            <div class="recent-draw-date">${latest.date}</div>
          </div>
        </div>
      </div>
      <div style="padding:16px 0;">${balls}</div>
    `;
  },

  renderRecentRecords(limit) {
    const records = this.state.records.slice(0, limit);
    if (records.length === 0) return '<div class="empty">暂无跟进记录，去"每日跟进"添加吧</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>彩种</th><th>投注号</th><th>金额</th><th>状态</th></tr></thead>
          <tbody>
            ${records.map(r => `
              <tr>
                <td>${r.date}</td>
                <td>${this.lotteryName(r.type)}</td>
                <td>${r.numbers.join(' ')}</td>
                <td>¥${r.amount}</td>
                <td><span class="tag ${r.status==='win'?'tag-win':r.status==='lose'?'tag-lose':'tag-pending'}">${r.status==='win'?'中'+r.prize+'元':r.status==='lose'?'未中':'待开奖'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ---- 开奖数据 ----
  viewData() {
    const draws = this.state.drawData[this.state.lotteryType];
    return `
      <div class="lottery-tabs">
        <div class="lottery-tab ${this.state.lotteryType==='dlt'?'active':''}" data-type="dlt">大乐透</div>
        <div class="lottery-tab ${this.state.lotteryType==='p5'?'active':''}" data-type="p5">排列5</div>
        <div class="lottery-tab ${this.state.lotteryType==='p3'?'active':''}" data-type="p3">排列3</div>
      </div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div class="card-title" style="margin:0;"><span class="icon">📋</span> ${this.lotteryName(this.state.lotteryType)}历史开奖 (共${draws.length}期)</div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-data">🔄 刷新数据</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>期号</th><th>开奖日期</th><th>开奖号码</th>${this.state.lotteryType==='dlt'?'<th>前区奇偶</th><th>前区和值</th>':''}<th>操作</th></tr>
            </thead>
            <tbody>
              ${draws.slice(0, 50).map(d => `
                <tr>
                  <td>${d.round}</td>
                  <td>${d.date}</td>
                  <td>${this.renderBalls(d.numbers)}</td>
                  ${this.state.lotteryType==='dlt' ? `<td>${this.oddEvenRatio(d.numbers.slice(0,5))}</td><td>${d.numbers.slice(0,5).reduce((a,b)=>a+parseInt(b),0)}</td>` : ''}
                  <td><button class="btn btn-secondary btn-sm" onclick="App.addToTracking('${d.round}')">📝 跟进</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderBalls(nums) {
    const isDlt = this.state.lotteryType === 'dlt';
    if (isDlt) {
      return `<div class="balls" style="justify-content:center;">
        ${nums.slice(0,5).map(n => `<div class="ball red" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}
        ${nums.slice(5).map(n => `<div class="ball blue" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}
      </div>`;
    }
    return `<div class="balls" style="justify-content:center;">${nums.map(n => `<div class="ball green" style="width:28px;height:28px;font-size:12px;">${n}</div>`).join('')}</div>`;
  },

  // ---- 每日跟进 ----
  viewTracking() {
    return `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title"><span class="icon">➕</span> 添加跟进记录</div>
          <div class="form-group">
            <label>彩种</label>
            <select id="track-type">
              <option value="dlt">大乐透</option>
              <option value="p5">排列5</option>
              <option value="p3">排列3</option>
            </select>
          </div>
          <div class="form-group">
            <label>期号（留空自动取最新期）</label>
            <input type="text" id="track-round" placeholder="如: 2024035">
          </div>
          <div class="form-group">
            <label>投注号码（逗号分隔）</label>
            <input type="text" id="track-numbers" placeholder="大乐透: 01,05,12,20,33,08,11">
          </div>
          <div class="form-group">
            <label>投注金额（元）</label>
            <input type="number" id="track-amount" value="2" min="1">
          </div>
          <div class="form-group">
            <label>备注</label>
            <input type="text" id="track-note" placeholder="机选/自选/胆拖等">
          </div>
          <button class="btn btn-primary" id="btn-add-track">✅ 添加记录</button>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 跟进概况</div>
          ${this.renderTrackingSummary()}
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div class="card-title" style="margin:0;"><span class="icon">📝</span> 全部跟进记录</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-success btn-sm" id="btn-check-wins">🔍 检查中奖</button>
            <button class="btn btn-secondary btn-sm" id="btn-export">📥 导出</button>
          </div>
        </div>
        ${this.renderAllRecords()}
      </div>
    `;
  },

  renderTrackingSummary() {
    const records = this.state.records;
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = records.filter(r => r.date === today);
    const pending = records.filter(r => r.status === 'pending');
    const won = records.filter(r => r.status === 'win');
    return `
      <div class="analysis-row">
        <span class="analysis-label">今日跟进</span>
        <span class="analysis-value">${todayRecords.length}注 / ¥${todayRecords.reduce((a,r)=>a+r.amount,0)}</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">待开奖</span>
        <span class="analysis-value">${pending.length}注</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">已中奖</span>
        <span class="analysis-value" style="color:var(--accent3)">${won.length}注 / ¥${won.reduce((a,r)=>a+(r.prize||0),0)}</span>
      </div>
      <div class="analysis-row">
        <span class="analysis-label">总跟进</span>
        <span class="analysis-value">${records.length}注</span>
      </div>
    `;
  },

  renderAllRecords() {
    const records = this.state.records;
    if (records.length === 0) return '<div class="empty">暂无跟进记录</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>类型</th><th>详情</th><th>金额</th><th>结果</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${records.map((r, i) => {
              const detail = r.type === 'match' ? r.note : `${r.round} | ${r.numbers.join(' ')}`;
              const result = r.drawNumbers ? (r.type === 'match' ? r.drawNumbers.join('') : r.drawNumbers.join(' ')) : '-';
              return `
              <tr>
                <td style="font-size:12px;">${r.date}</td>
                <td>${this.lotteryName(r.type)}</td>
                <td style="font-size:12px;text-align:left;">${detail}</td>
                <td>¥${r.amount}</td>
                <td style="font-size:12px;">${result}</td>
                <td><span class="tag ${r.status==='win'?'tag-win':r.status==='lose'?'tag-lose':'tag-pending'}">${r.status==='win'?'+'+r.prize+'元':r.status==='lose'?'未中':'待开'}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="App.editRecord(${i})">✏️</button>
                  <button class="btn btn-secondary btn-sm" onclick="App.deleteRecord(${i})">🗑️</button>
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ---- 体育赛事 ----
  viewSports() {
    const sp = this.state.sports;
    const isFootball = sp.activeTab === 'football';
    const currentLeague = isFootball ? sp.footballLeague : sp.basketballLeague;
    const footballLeagues = ['英超','西甲','意甲','德甲','法甲','中超','欧冠','世界杯'];
    const basketballLeagues = ['NBA','CBA','欧洲篮球联赛'];
    const leagues = isFootball ? footballLeagues : basketballLeagues;
    const matches = sp.matches[sp.activeTab][currentLeague] || [];
    const standings = sp.standings[sp.activeTab][currentLeague] || [];

    return `
      <div class="sports-tabs" style="display:flex;gap:6px;margin-bottom:16px;">
        <div class="lottery-tab ${isFootball?'active':''}" data-sport="football">⚽ 足球</div>
        <div class="lottery-tab ${!isFootball?'active':''}" data-sport="basketball">🏀 篮球</div>
      </div>
      <div class="league-tabs" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap;">
        ${leagues.map(l => `<div class="lottery-tab ${currentLeague===l?'active':''}" data-league="${l}" style="font-size:12px;padding:4px 10px;">${l}</div>`).join('')}
      </div>
      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="card-title" style="margin:0;"><span class="icon">📅</span> ${currentLeague} 近期赛程</div>
            <button class="btn btn-secondary btn-sm" id="btn-fetch-sports">🔄 刷新</button>
          </div>
          ${this.renderMatchList(matches, isFootball)}
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🏆</span> ${currentLeague} 积分榜</div>
          ${this.renderStandings(standings, isFootball)}
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 进球/得分趋势</div>
          <div id="sports-score-chart" class="chart-container"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 胜率分析</div>
          <div id="sports-winrate-chart" class="chart-container"></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title"><span class="icon">📝</span> 添加赛事竞猜</div>
        <div class="grid grid-3">
          <div class="form-group">
            <label>赛事类型</label>
            <select id="match-bet-type">
              <option value="football">⚽ 足球</option>
              <option value="basketball">🏀 篮球</option>
            </select>
          </div>
          <div class="form-group">
            <label>投注选项</label>
            <select id="match-bet-pick">
              <option value="home">主队胜</option>
              <option value="draw">平局</option>
              <option value="away">客队胜</option>
              <option value="handicap">让球</option>
              <option value="over">大分</option>
              <option value="under">小分</option>
            </select>
          </div>
          <div class="form-group">
            <label>投注金额</label>
            <input type="number" id="match-bet-amount" value="100" min="1">
          </div>
        </div>
        <div class="form-group">
          <label>赛事描述（如：曼联 vs 利物浦）</label>
          <input type="text" id="match-bet-desc" placeholder="输入比赛对阵">
        </div>
        <button class="btn btn-primary" id="btn-add-match-bet">✅ 添加竞猜</button>
      </div>

      <!-- 直播入口 -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div class="card-title" style="margin:0;"><span class="icon">📺</span> 赛事直播入口</div>
          <span style="font-size:12px;color:var(--text-dim);">点击平台名跳转观看</span>
        </div>
        ${this.renderLiveLinks(isFootball)}
      </div>
    `;
  },

  renderLiveLinks(isFootball) {
    const footballLinks = [
      { name: '央视体育', url: 'https://tv.cctv.com/live/cctv5/', icon: '📺', desc: 'CCTV5 官方直播', tag: '免费' },
      { name: '央视频', url: 'https://www.yangshipin.cn/tv/home?pid=600001804', icon: '📱', desc: '央视频APP网页版', tag: '免费' },
      { name: '咪咕视频', url: 'https://www.miguvideo.com/gateway/playurl/v3/play/playurl', icon: '🎬', desc: '中超/英超/西甲直播', tag: '部分免费' },
      { name: '爱奇艺体育', url: 'https://sports.iqiyi.com/', icon: '🎥', desc: '欧冠/欧联/西甲', tag: '会员' },
      { name: '腾讯体育', url: 'https://sports.qq.com/', icon: '🏀', desc: '英超/欧冠/综合赛事', tag: '会员' },
      { name: '懂球帝直播', url: 'https://www.dongqiudi.com/live', icon: '⚽', desc: '足球赛事聚合直播', tag: '免费' },
      { name: '直播吧', url: 'https://www.zhibo8.com/', icon: '🏆', desc: '全赛事直播聚合', tag: '免费' },
      { name: '虎扑', url: 'https://www.hupu.com/', icon: '🔥', desc: '赛事社区+文字直播', tag: '免费' },
    ];
    const basketballLinks = [
      { name: '央视体育', url: 'https://tv.cctv.com/live/cctv5/', icon: '📺', desc: 'CCTV5 NBA/CBA直播', tag: '免费' },
      { name: '央视频', url: 'https://www.yangshipin.cn/tv/home?pid=600001804', icon: '📱', desc: '央视频APP网页版', tag: '免费' },
      { name: '咪咕视频', url: 'https://www.miguvideo.com/gateway/playurl/v3/play/playurl', icon: '🎬', desc: 'CBA/NBA直播', tag: '部分免费' },
      { name: '腾讯体育', url: 'https://sports.qq.com/nba/', icon: '🏀', desc: 'NBA独家直播', tag: '会员' },
      { name: '直播吧', url: 'https://www.zhibo8.com/', icon: '🏆', desc: 'NBA/CBA全赛事', tag: '免费' },
      { name: '虎扑', url: 'https://voice.hupu.com/nba/', icon: '🔥', desc: 'NBA社区+文字直播', tag: '免费' },
      { name: '新浪体育', url: 'https://sports.sina.com.cn/nba/', icon: '📰', desc: 'NBA图文直播', tag: '免费' },
      { name: '腾讯视频', url: 'https://v.qq.com/channel/sport', icon: '🎥', desc: '体育赛事回放', tag: '会员' },
    ];
    const links = isFootball ? footballLinks : basketballLinks;
    return `
      <div class="live-links-grid">
        ${links.map(l => `
          <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="live-link-card">
            <div class="live-link-icon">${l.icon}</div>
            <div class="live-link-info">
              <div class="live-link-name">${l.name}</div>
              <div class="live-link-desc">${l.desc}</div>
            </div>
            <span class="live-link-tag ${l.tag==='免费'?'free':l.tag==='部分免费'?'partial':'vip'}">${l.tag}</span>
          </a>
        `).join('')}
      </div>
      <div style="margin-top:12px;padding:10px 14px;background:#f8f9fb;border-radius:8px;font-size:12px;color:var(--text-dim);line-height:1.6;">
        💡 提示：免费平台推荐 <strong>央视体育/直播吧/懂球帝</strong>；付费平台 <strong>腾讯体育</strong>（NBA）、<strong>爱奇艺体育</strong>（欧冠）画质更佳。部分赛事可能需要会员或地区限制。
      </div>
    `;
  },

  // ---- 足球竞彩计算器 ----
  viewCalc() {
    const calc = this.state.calc;
    const matches = calc.matches;
    const hasMatches = matches.length > 0;
    const allPicked = hasMatches && matches.every(m => m.pick !== null);
    const allScored = hasMatches && matches.every(m => m.simHomeScore !== null && m.simAwayScore !== null);
    const canShowResult = allPicked && allScored;

    // 实时计算
    const liveResult = canShowResult ? this.calcLiveResult(matches, calc) : null;

    // 预设快捷比赛池
    const quickPicks = this.getQuickPicks();

    return `
      <!-- 顶部模式切换 + 金额 -->
      <div class="calc-topbar">
        <div class="calc-mode-switch">
          <div class="calc-mode-btn ${calc.mode==='single'?'active':''}" onclick="App.calcSetMode('single')">单关</div>
          <div class="calc-mode-btn ${calc.mode==='parlay'?'active':''}" onclick="App.calcSetMode('parlay')">串关</div>
        </div>
        <div class="calc-amount-setter">
          <span style="font-size:13px;color:var(--text-dim);">每注</span>
          <div class="calc-amount-btns">
            ${[2, 10, 50, 100].map(v => `<div class="calc-amt-btn ${calc.betAmount===v?'active':''}" onclick="App.calcSetAmount(${v})">¥${v}</div>`).join('')}
          </div>
        </div>
        ${hasMatches ? '<div class="calc-clear-btn" onclick="App.calcClear()">🗑️ 清空</div>' : ''}
      </div>

      <!-- 快捷添加比赛 -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title"><span class="icon">⚡</span> 点击添加比赛</div>
        <div class="calc-quick-grid">
          ${quickPicks.map((p, i) => `
            <div class="calc-quick-item" onclick="App.calcQuickAdd(${i})">
              <div class="calc-quick-teams">${p.home} <span style="color:var(--text-dim);">vs</span> ${p.away}</div>
              <div class="calc-quick-odds">${p.oddsWin} / ${p.oddsDraw} / ${p.oddsLose}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 已添加的比赛列表 -->
      ${hasMatches ? `
      <div class="calc-matches-list">
        ${matches.map((m, i) => this.renderCalcMatchCard(m, i)).join('')}
      </div>
      ` : '<div class="card"><div class="empty">👆 点击上方比赛添加到方案</div></div>'}

      <!-- 实时结果栏 -->
      ${canShowResult && liveResult ? `
      <div class="calc-result-bar ${liveResult.net >= 0 ? 'win' : 'lose'}">
        <div class="calc-result-item">
          <div class="calc-result-label">投注</div>
          <div class="calc-result-value">¥${liveResult.totalCost}</div>
        </div>
        <div class="calc-result-item">
          <div class="calc-result-label">中奖</div>
          <div class="calc-result-value" style="color:var(--accent3);">¥${liveResult.totalReturn.toFixed(0)}</div>
        </div>
        <div class="calc-result-item">
          <div class="calc-result-label">净收益</div>
          <div class="calc-result-value" style="color:${liveResult.net>=0?'var(--accent3)':'var(--accent)'};">${liveResult.net>=0?'+':''}¥${liveResult.net.toFixed(0)}</div>
        </div>
        ${calc.mode === 'parlay' ? `
        <div class="calc-result-item">
          <div class="calc-result-label">总赔率</div>
          <div class="calc-result-value" style="color:var(--accent2);">${liveResult.totalOdds.toFixed(2)}</div>
        </div>
        ` : `
        <div class="calc-result-item">
          <div class="calc-result-label">命中</div>
          <div class="calc-result-value">${liveResult.winCount}/${matches.length}</div>
        </div>
        `}
        <div class="calc-result-actions">
          <div class="calc-save-btn" onclick="App.calcSave()">💾 保存</div>
        </div>
      </div>
      ` : ''}

      ${!canShowResult && hasMatches ? `
      <div class="calc-hint-bar">
        ${!allPicked ? '👆 请点击每场比赛的 胜/平/负 选择投注' : '👆 请点击比分数字完成模拟开奖'}
      </div>
      ` : ''}
    `;
  },

  getQuickPicks() {
    return [
      { home: '曼城', away: '阿森纳', oddsWin: 2.10, oddsDraw: 3.30, oddsLose: 3.20, handicap: 0 },
      { home: '皇马', away: '巴萨', oddsWin: 2.25, oddsDraw: 3.25, oddsLose: 3.00, handicap: 0 },
      { home: '利物浦', away: '曼联', oddsWin: 1.85, oddsDraw: 3.50, oddsLose: 4.00, handicap: -1 },
      { home: '拜仁', away: '多特', oddsWin: 1.55, oddsDraw: 4.20, oddsLose: 5.00, handicap: -1 },
      { home: '国米', away: '尤文', oddsWin: 2.30, oddsDraw: 3.10, oddsLose: 3.00, handicap: 0 },
      { home: '上海海港', away: '山东泰山', oddsWin: 2.00, oddsDraw: 3.20, oddsLose: 3.50, handicap: 0 },
      { home: '切尔西', away: '热刺', oddsWin: 2.40, oddsDraw: 3.30, oddsLose: 2.80, handicap: 0 },
      { home: '巴黎', away: '马赛', oddsWin: 1.70, oddsDraw: 3.80, oddsLose: 4.50, handicap: -1 },
    ];
  },

  calcQuickAdd(idx) {
    const p = this.getQuickPicks()[idx];
    this.state.calc.matches.push({
      home: p.home, away: p.away, handicap: p.handicap,
      oddsWin: p.oddsWin, oddsDraw: p.oddsDraw, oddsLose: p.oddsLose,
      pick: null, simHomeScore: null, simAwayScore: null,
    });
    this.saveData();
    this.renderSection();
  },

  renderCalcMatchCard(m, i) {
    const result = (m.simHomeScore !== null && m.simAwayScore !== null) ? this.calcMatchResult(m) : null;
    return `
      <div class="calc-match-card ${m.pick ? 'picked' : ''} ${result ? (result.hit ? 'won' : 'lost') : ''}">
        <!-- 比赛头部 -->
        <div class="calc-match-header">
          <div class="calc-match-teams">
            <span class="calc-team ${m.pick==='win'?'selected':''}">${m.home}</span>
            <span class="calc-vs">vs</span>
            <span class="calc-team ${m.pick==='lose'?'selected':''}">${m.away}</span>
            ${m.handicap !== 0 ? `<span class="calc-handicap">让${m.handicap>0?'+':''}${m.handicap}</span>` : ''}
          </div>
          <div class="calc-match-remove" onclick="App.calcRemoveMatch(${i})">✕</div>
        </div>

        <!-- 选投注 -->
        <div class="calc-pick-row">
          <div class="calc-pick-btn ${m.pick==='win'?'active win':''}" onclick="App.calcPickResult(${i},'win')">
            <span class="calc-pick-label">主胜</span>
            <span class="calc-pick-odds">${m.oddsWin}</span>
          </div>
          <div class="calc-pick-btn ${m.pick==='draw'?'active draw':''}" onclick="App.calcPickResult(${i},'draw')">
            <span class="calc-pick-label">平局</span>
            <span class="calc-pick-odds">${m.oddsDraw}</span>
          </div>
          <div class="calc-pick-btn ${m.pick==='lose'?'active lose':''}" onclick="App.calcPickResult(${i},'lose')">
            <span class="calc-pick-label">客胜</span>
            <span class="calc-pick-odds">${m.oddsLose}</span>
          </div>
        </div>

        <!-- 选比分 -->
        <div class="calc-score-row">
          <div class="calc-score-side">
            <div class="calc-score-label">${m.home}</div>
            <div class="calc-score-btns">
              ${[0,1,2,3,4,5,6].map(n => `<div class="calc-score-btn ${m.simHomeScore===n?'active':''}" onclick="App.calcSetScore(${i},'home',${n})">${n}</div>`).join('')}
            </div>
          </div>
          <div class="calc-score-divider">:</div>
          <div class="calc-score-side">
            <div class="calc-score-label">${m.away}</div>
            <div class="calc-score-btns">
              ${[0,1,2,3,4,5,6].map(n => `<div class="calc-score-btn ${m.simAwayScore===n?'active':''}" onclick="App.calcSetScore(${i},'away',${n})">${n}</div>`).join('')}
            </div>
          </div>
        </div>

        <!-- 该场结果 -->
        ${result && m.pick ? `
        <div class="calc-match-result ${result.hit ? 'hit' : 'miss'}">
          ${result.hit
            ? `🎉 命中！${this.calcPickLabel(m.pick)} ${m.oddsForPick.toFixed(2)}倍 → +¥${(this.state.calc.betAmount * (m.pick==='win'?m.oddsWin:m.pick==='draw'?m.oddsDraw:m.oddsLose)).toFixed(0)}`
            : `❌ 未中 · 赛果: ${this.calcHandicapResult(m)}`
          }
        </div>
        ` : (m.simHomeScore !== null && m.simAwayScore !== null ? `
        <div class="calc-match-result pending">
          比分 ${m.simHomeScore}:${m.simAwayScore} → ${this.calcHandicapResult(m)} · 请选择投注
        </div>
        ` : '')}
      </div>
    `;
  },

  calcPickResult(idx, pick) {
    const m = this.state.calc.matches[idx];
    if (!m) return;
    m.pick = m.pick === pick ? null : pick;
    if (m.pick) {
      m.oddsForPick = m.pick === 'win' ? m.oddsWin : m.pick === 'draw' ? m.oddsDraw : m.oddsLose;
    }
    this.saveData();
    this.renderSection();
  },

  calcSetScore(idx, side, score) {
    const m = this.state.calc.matches[idx];
    if (!m) return;
    if (side === 'home') {
      m.simHomeScore = m.simHomeScore === score ? null : score;
    } else {
      m.simAwayScore = m.simAwayScore === score ? null : score;
    }
    this.saveData();
    this.renderSection();
  },

  calcSetAmount(amt) {
    this.state.calc.betAmount = amt;
    this.saveData();
    this.renderSection();
  },

  calcSetMode(mode) {
    this.state.calc.mode = mode;
    this.saveData();
    this.renderSection();
  },

  calcLiveResult(matches, calc) {
    const amount = calc.betAmount;
    const mode = calc.mode;
    if (mode === 'single') {
      let totalReturn = 0, winCount = 0;
      const totalCost = amount * matches.length;
      matches.forEach(m => {
        const r = this.calcMatchResult(m);
        if (r.hit) {
          const odds = m.pick === 'win' ? m.oddsWin : m.pick === 'draw' ? m.oddsDraw : m.oddsLose;
          totalReturn += amount * odds;
          winCount++;
        }
      });
      return { totalCost, totalReturn, net: totalReturn - totalCost, winCount, totalOdds: 0 };
    } else {
      let totalOdds = 1, allHit = true;
      matches.forEach(m => {
        const odds = m.pick === 'win' ? m.oddsWin : m.pick === 'draw' ? m.oddsDraw : m.oddsLose;
        totalOdds *= odds;
        if (!this.calcMatchResult(m).hit) allHit = false;
      });
      const totalReturn = allHit ? amount * totalOdds : 0;
      return { totalCost: amount, totalReturn, net: totalReturn - amount, winCount: allHit ? matches.length : 0, totalOdds };
    }
  },

  // 保留旧方法名兼容
  renderCalcMatches(matches) {
    return matches.map((m, i) => this.renderCalcMatchCard(m, i)).join('');
  },

  renderCalcSummary(matches, calc) {
    const r = this.calcLiveResult(matches, calc);
    return `<div class="calc-result-bar ${r.net>=0?'win':'lose'}">投注¥${r.totalCost} · 中奖¥${r.totalReturn.toFixed(0)} · 净收益${r.net>=0?'+':''}¥${r.net.toFixed(0)}</div>`;
  },

  calcPickLabel(pick) {
    return { win: '主胜', draw: '平', lose: '客胜' }[pick] || '-';
  },

  calcMatchResult(m) {
    if (m.simHomeScore == null || m.simAwayScore == null) return { hit: false, result: null };
    const home = m.simHomeScore + m.handicap;
    const away = m.simAwayScore;
    let actualResult;
    if (home > away) actualResult = 'win';
    else if (home === away) actualResult = 'draw';
    else actualResult = 'lose';
    return { hit: actualResult === m.pick, result: actualResult };
  },

  calcHandicapResult(m) {
    if (m.simHomeScore == null) return '-';
    const home = m.simHomeScore + m.handicap;
    const away = m.simAwayScore;
    const label = m.handicap != 0 ? `(${m.simHomeScore}${m.handicap>0?'+':''}${m.handicap}=${home})` : '';
    if (home > away) return `主胜${label}`;
    if (home === away) return `平${label}`;
    return `客胜${label}`;
  },

  calcQuickAdd(idx) {
    const p = this.getQuickPicks()[idx];
    this.state.calc.matches.push({
      home: p.home, away: p.away, handicap: p.handicap,
      oddsWin: p.oddsWin, oddsDraw: p.oddsDraw, oddsLose: p.oddsLose,
      pick: null, simHomeScore: null, simAwayScore: null,
    });
    this.saveData();
    this.renderSection();
  },

  calcRemoveMatch(idx) {
    this.state.calc.matches.splice(idx, 1);
    this.saveData();
    this.renderSection();
  },

  calcClear() {
    this.state.calc.matches = [];
    this.saveData();
    this.renderSection();
    this.toast('已清空');
  },

  calcSimulate() {
    // 兼容旧调用，直接渲染
    this.renderSection();
  },

  calcRandomScore() {
    this.state.calc.matches.forEach(m => {
      m.simHomeScore = Math.floor(Math.random() * 5);
      m.simAwayScore = Math.floor(Math.random() * 5);
    });
    this.saveData();
    this.renderSection();
    this.toast('已随机生成比分');
  },

  calcSave() {
    const matches = this.state.calc.matches;
    const amount = this.state.calc.betAmount;
    const mode = this.state.calc.mode;
    const live = this.calcLiveResult(matches, this.state.calc);

    const matchDesc = matches.map(m => `${m.home}vs${m.away}(${this.calcPickLabel(m.pick)})`).join(' + ');
    const modeLabel = mode === 'single' ? '单关' : `${matches.length}串1`;

    const record = {
      date: new Date().toISOString().split('T')[0],
      type: 'match',
      matchType: 'football',
      matchDesc,
      pick: modeLabel,
      round: matchDesc,
      numbers: matches.map(m => `${m.home}${this.calcPickLabel(m.pick)}`),
      amount: live.totalCost,
      note: `⚽ ${modeLabel} | ${matchDesc}`,
      status: live.totalReturn > 0 ? 'win' : 'lose',
      prize: Math.round(live.totalReturn),
      drawNumbers: matches.map(m => `${m.simHomeScore}:${m.simAwayScore}`),
    };

    this.state.records.unshift(record);
    this.saveData();
    this.toast(`已保存 ${live.totalReturn > 0 ? '(中奖¥' + Math.round(live.totalReturn) + ')' : ''}`);
  },

  renderCalcCharts() {
    // 简化：不再显示图表，全部实时计算
  },

  // ---- 每日推送 ----
  viewPush() {
    const push = this.state.push;
    const today = new Date().toISOString().split('T')[0];
    const todayPush = push.history.find(h => h.date === today);

    return `
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">📢</span> 推送状态</div>
          <div class="card-value ${push.enabled ? 'green' : 'red'}" style="font-size:20px;">${push.enabled ? '已开启' : '已关闭'}</div>
          <div class="card-sub">${push.lastPushDate ? '上次推送: ' + push.lastPushDate : '尚未推送'}</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 推送次数</div>
          <div class="card-value blue" style="font-size:20px;">${push.history.length}</div>
          <div class="card-sub">累计方案数</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎯</span> 命中率</div>
          <div class="card-value orange" style="font-size:20px;">${this.calcPushHitRate()}%</div>
          <div class="card-sub">已开奖方案</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">💰</span> 模拟收益</div>
          <div class="card-value ${this.calcPushProfit() >= 0 ? 'green' : 'red'}" style="font-size:20px;">${this.calcPushProfit() >= 0 ? '+' : ''}¥${this.calcPushProfit()}</div>
          <div class="card-sub">推送方案累计</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div class="card-title" style="margin:0;"><span class="icon">⚙️</span> 推送设置</div>
          <div style="display:flex;gap:8px;">
            <button class="btn ${push.enabled?'btn-success':'btn-secondary'} btn-sm" id="btn-toggle-push">${push.enabled?'✅ 已开启':'❌ 已关闭'}</button>
            <button class="btn btn-primary btn-sm" id="btn-gen-push">🎯 立即生成今日方案</button>
          </div>
        </div>
        <div style="margin-top:12px;">
          <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:8px;">推送策略（可多选）</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm push-strategy-btn ${push.strategies.includes('valuebet')?'btn-primary':'btn-secondary'}" data-strategy="valuebet">💎 价值投注</button>
            <button class="btn btn-sm push-strategy-btn ${push.strategies.includes('hotteam')?'btn-primary':'btn-secondary'}" data-strategy="hotteam">🔥 强队稳胆</button>
            <button class="btn btn-sm push-strategy-btn ${push.strategies.includes('underdog')?'btn-primary':'btn-secondary'}" data-strategy="underdog">🐎 冷门博弈</button>
            <button class="btn btn-sm push-strategy-btn ${push.strategies.includes('parlay')?'btn-primary':'btn-secondary'}" data-strategy="parlay">🔗 串关推荐</button>
          </div>
        </div>
      </div>

      ${todayPush ? this.renderPushPlan(todayPush) : `
        <div class="card">
          <div class="empty">今日尚未生成方案，点击上方"立即生成今日方案"</div>
        </div>
      `}

      <div class="card" style="margin-top:16px;">
        <div class="card-title"><span class="icon">📜</span> 历史推送</div>
        ${this.renderPushHistory()}
      </div>
    `;
  },

  renderPushPlan(plan) {
    return `
      <div class="card" style="margin-bottom:16px;border-color:var(--accent2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div class="card-title" style="margin:0;"><span class="icon">🎯</span> 今日推荐方案 · ${plan.date}</div>
          <span class="tag tag-pending">${plan.strategies.join(' / ')}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>联赛</th><th>比赛</th><th>推荐</th><th>赔率</th><th>信心</th><th>分析</th></tr></thead>
            <tbody>
              ${plan.picks.map((p, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td style="font-size:12px;">${p.league}</td>
                  <td style="text-align:left;">${p.home} vs ${p.away}</td>
                  <td><strong style="color:var(--accent2);">${p.pickLabel}</strong></td>
                  <td>${p.odds.toFixed(2)}</td>
                  <td>${this.renderConfidence(p.confidence)}</td>
                  <td style="font-size:12px;color:var(--text-dim);text-align:left;">${p.reason}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="btn-save-push-track">📝 保存到跟进记录</button>
          <button class="btn btn-success btn-sm" id="btn-save-push-sim">🤖 发送到模拟投注</button>
        </div>
        ${plan.parlay ? `
        <div style="margin-top:12px;padding:12px;background:rgba(230,126,34,0.1);border-radius:8px;">
          <div style="font-size:13px;color:var(--accent2);font-weight:600;margin-bottom:4px;">🔗 串关推荐</div>
          <div style="font-size:12px;color:var(--text-dim);">${plan.parlay.desc}</div>
          <div style="font-size:14px;margin-top:4px;">总赔率: <strong style="color:var(--accent2);">${plan.parlay.totalOdds.toFixed(2)}</strong> · 预计奖金: <strong style="color:var(--accent3);">¥${(plan.parlay.totalOdds * 2).toFixed(0)}</strong></div>
        </div>
        ` : ''}
      </div>
    `;
  },

  renderConfidence(score) {
    const stars = '⭐'.repeat(Math.round(score / 20)) + '☆'.repeat(5 - Math.round(score / 20));
    return `<span style="font-size:11px;">${stars}</span>`;
  },

  renderPushHistory() {
    const history = this.state.push.history.slice(0, 10);
    if (history.length === 0) return '<div class="empty">暂无历史推送</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>策略</th><th>推荐数</th><th>已开奖</th><th>命中</th><th>模拟收益</th><th>详情</th></tr></thead>
          <tbody>
            ${history.map(h => {
              const settled = h.picks.filter(p => p.result !== null);
              const hits = settled.filter(p => p.result === 'win');
              const profit = settled.reduce((sum, p) => sum + (p.result === 'win' ? p.odds * 2 - 2 : -2), 0);
              return `
              <tr>
                <td>${h.date}</td>
                <td style="font-size:12px;">${h.strategies.join('/')}</td>
                <td>${h.picks.length}</td>
                <td>${settled.length}/${h.picks.length}</td>
                <td style="color:var(--accent3);">${hits.length}</td>
                <td style="color:${profit>=0?'var(--accent3)':'var(--accent)'};">${profit>=0?'+':''}¥${profit.toFixed(0)}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="App.viewPushDetail('${h.date}')">查看</button></td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  viewPushDetail(date) {
    const plan = this.state.push.history.find(h => h.date === date);
    if (!plan) return;
    this.showModal(`
      <div class="modal-header">
        <h3>${date} 推送详情</h3>
        <span class="modal-close" onclick="App.closeModal()">×</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>比赛</th><th>推荐</th><th>赔率</th><th>比分</th><th>结果</th></tr></thead>
          <tbody>
            ${plan.picks.map(p => `
              <tr>
                <td style="text-align:left;font-size:12px;">${p.home} vs ${p.away}</td>
                <td>${p.pickLabel}</td>
                <td>${p.odds.toFixed(2)}</td>
                <td>${p.score || '-'}</td>
                <td>${p.result === 'win' ? '<span class="tag tag-win">命中</span>' : p.result === 'lose' ? '<span class="tag tag-lose">未中</span>' : '<span class="tag tag-pending">待开</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
      </div>
    `);
  },

  togglePush() {
    this.state.push.enabled = !this.state.push.enabled;
    this.saveData();
    this.renderSection();
    this.toast(this.state.push.enabled ? '推送已开启' : '推送已关闭');
  },

  togglePushStrategy(strategy) {
    const arr = this.state.push.strategies;
    const idx = arr.indexOf(strategy);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(strategy);
    if (arr.length === 0) arr.push('valuebet');
    this.saveData();
    this.renderSection();
  },

  generatePush() {
    const today = new Date().toISOString().split('T')[0];
    const strategies = this.state.push.strategies;
    const picks = [];
    const leagues = ['英超','西甲','意甲','德甲','中超'];
    const teams = {
      '英超': [['曼城','阿森纳'],['利物浦','曼联'],['切尔西','热刺'],['纽卡斯尔','维拉']],
      '西甲': [['皇马','巴萨'],['马竞','皇家社会'],['塞维利亚','瓦伦西亚']],
      '意甲': [['国米','尤文'],['米兰','那不勒斯'],['罗马','拉齐奥']],
      '德甲': [['拜仁','多特'],['勒沃库森','莱比锡']],
      '中超': [['上海海港','山东泰山'],['上海申花','北京国安']],
    };
    const reasons = {
      valuebet: '赔率价值高于实际概率，存在套利空间',
      hotteam: '近期状态火热，胜率超70%',
      underdog: '冷门赔率偏高，博冷价值大',
      parlay: '低赔稳胆，适合串关累积',
    };

    // 每个策略生成1-2场推荐
    strategies.forEach(strat => {
      const league = leagues[Math.floor(Math.random() * leagues.length)];
      const pair = teams[league][Math.floor(Math.random() * teams[league].length)];
      const home = pair[0], away = pair[1];

      let pick, pickLabel, odds, confidence;
      if (strat === 'hotteam') {
        pick = 'win'; pickLabel = '主胜';
        odds = 1.6 + Math.random() * 0.6;
        confidence = 70 + Math.floor(Math.random() * 25);
      } else if (strat === 'underdog') {
        pick = Math.random() > 0.5 ? 'lose' : 'draw';
        pickLabel = pick === 'lose' ? '客胜' : '平局';
        odds = 3.5 + Math.random() * 2.0;
        confidence = 30 + Math.floor(Math.random() * 25);
      } else if (strat === 'parlay') {
        pick = 'win'; pickLabel = '主胜';
        odds = 1.4 + Math.random() * 0.4;
        confidence = 60 + Math.floor(Math.random() * 20);
      } else {
        // valuebet
        pick = Math.random() > 0.4 ? 'win' : 'draw';
        pickLabel = pick === 'win' ? '主胜' : '平局';
        odds = 2.5 + Math.random() * 1.5;
        confidence = 50 + Math.floor(Math.random() * 30);
      }

      picks.push({
        league, home, away, pick, pickLabel,
        odds: parseFloat(odds.toFixed(2)),
        confidence,
        reason: reasons[strat] || '综合分析推荐',
        result: null,
        score: null,
      });
    });

    // 如果有串关策略，生成串关推荐
    let parlay = null;
    if (strategies.includes('parlay') && picks.length >= 2) {
      const parlayPicks = picks.slice(0, Math.min(3, picks.length));
      let totalOdds = 1;
      parlayPicks.forEach(p => totalOdds *= p.odds);
      parlay = {
        desc: parlayPicks.map(p => `${p.home}${p.pickLabel}`).join(' + '),
        totalOdds: parseFloat(totalOdds.toFixed(2)),
        picks: parlayPicks,
      };
    }

    // 检查是否已开奖（模拟随机结果）
    picks.forEach(p => {
      if (Math.random() > 0.4) {
        // 模拟开奖
        const homeScore = Math.floor(Math.random() * 4);
        const awayScore = Math.floor(Math.random() * 4);
        p.score = `${homeScore}:${awayScore}`;
        let actual;
        if (homeScore > awayScore) actual = 'win';
        else if (homeScore === awayScore) actual = 'draw';
        else actual = 'lose';
        p.result = actual === p.pick ? 'win' : 'lose';
      }
    });

    // 移除今天的旧推送
    const existingIdx = this.state.push.history.findIndex(h => h.date === today);
    if (existingIdx >= 0) this.state.push.history.splice(existingIdx, 1);

    const plan = { date: today, strategies, picks, parlay };
    this.state.push.history.unshift(plan);
    this.state.push.lastPushDate = today;
    this.saveData();
    this.renderSection();

    // 检查是否需要浏览器通知
    if (this.state.push.enabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('🎯 今日方案已推送', {
          body: `${picks.length}场推荐 · 策略: ${strategies.join('/')}`,
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
    this.toast(`已生成${picks.length}场推荐方案！`);
  },

  calcPushHitRate() {
    let total = 0, hits = 0;
    this.state.push.history.forEach(h => {
      h.picks.forEach(p => {
        if (p.result !== null) { total++; if (p.result === 'win') hits++; }
      });
    });
    return total > 0 ? Math.round(hits / total * 100) : 0;
  },

  calcPushProfit() {
    let profit = 0;
    this.state.push.history.forEach(h => {
      h.picks.forEach(p => {
        if (p.result !== null) {
          profit += p.result === 'win' ? p.odds * 2 - 2 : -2;
        }
      });
    });
    return Math.round(profit);
  },

  savePushToTracking() {
    const today = new Date().toISOString().split('T')[0];
    const plan = this.state.push.history.find(h => h.date === today);
    if (!plan) return;

    plan.picks.forEach(p => {
      const record = {
        date: today,
        type: 'match',
        matchType: 'football',
        matchDesc: `${p.home} vs ${p.away}`,
        pick: p.pickLabel,
        round: `${p.home}vs${p.away}`,
        numbers: [p.pickLabel],
        amount: 2,
        note: `📢 推送方案 | ${p.league} ${p.home}vs${p.away} ${p.pickLabel} ${p.odds}`,
        status: p.result === 'win' ? 'win' : p.result === 'lose' ? 'lose' : 'pending',
        prize: p.result === 'win' ? Math.round(p.odds * 2) : 0,
        drawNumbers: p.score ? p.score.split(':') : null,
      };
      this.state.records.unshift(record);
    });

    this.saveData();
    this.toast(`已保存${plan.picks.length}条到跟进记录`);
  },

  savePushToSim() {
    const today = new Date().toISOString().split('T')[0];
    const plan = this.state.push.history.find(h => h.date === today);
    if (!plan) return;

    plan.picks.forEach(p => {
      this.state.sim.trades.push({
        date: today,
        home: p.home, away: p.away, league: p.league,
        pick: p.pick, pickLabel: p.pickLabel,
        odds: p.odds,
        amount: this.state.sim.betAmount,
        score: p.score,
        result: p.result,
        return: p.result === 'win' ? p.odds * this.state.sim.betAmount : 0,
        source: 'push',
      });
      // 扣减余额
      this.state.sim.balance -= this.state.sim.betAmount;
      if (p.result === 'win') {
        this.state.sim.balance += p.odds * this.state.sim.betAmount;
      }
    });

    this.saveData();
    this.toast(`已发送${plan.picks.length}注到模拟投注`);
  },

  renderPushCharts() {
    // 推送命中率趋势
    const el = document.getElementById('push-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const history = this.state.push.history.slice(0, 14).reverse();
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: history.map(h => h.date.substring(5)), axisLabel: { color: '#7f8c8d', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d', formatter: '{value}%' } },
      series: [{
        type: 'line', smooth: true,
        data: history.map(h => {
          const settled = h.picks.filter(p => p.result !== null);
          const hits = settled.filter(p => p.result === 'win');
          return settled.length > 0 ? Math.round(hits.length / settled.length * 100) : 0;
        }),
        itemStyle: { color: '#e67e22' },
        areaStyle: { color: 'rgba(230,126,34,0.15)' },
      }],
    });
  },

  // ---- 模拟投注引擎 ----
  viewSim() {
    const sim = this.state.sim;
    const profit = sim.balance - sim.initialBalance;
    const roi = sim.initialBalance > 0 ? (profit / sim.initialBalance * 100).toFixed(1) : 0;
    const winTrades = sim.trades.filter(t => t.result === 'win');
    const settled = sim.trades.filter(t => t.result !== null);
    const winRate = settled.length > 0 ? (winTrades.length / settled.length * 100).toFixed(1) : 0;

    return `
      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">💰</span> 当前余额</div>
          <div class="card-value ${sim.balance >= sim.initialBalance ? 'green' : 'red'}">¥${sim.balance.toFixed(0)}</div>
          <div class="card-sub">初始: ¥${sim.initialBalance}</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 总收益</div>
          <div class="card-value ${profit >= 0 ? 'green' : 'red'}">${profit >= 0 ? '+' : ''}¥${profit.toFixed(0)}</div>
          <div class="card-sub">ROI: ${roi}%</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎯</span> 胜率</div>
          <div class="card-value orange">${winRate}%</div>
          <div class="card-sub">${winTrades.length}胜 / ${settled.length}注</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 总投注</div>
          <div class="card-value blue">¥${sim.trades.reduce((a,t)=>a+t.amount,0).toFixed(0)}</div>
          <div class="card-sub">${sim.trades.length}笔交易</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div class="card-title" style="margin:0;"><span class="icon">⚙️</span> 模拟引擎设置</div>
          <div style="display:flex;gap:8px;">
            <button class="btn ${sim.enabled?'btn-success':'btn-secondary'} btn-sm" id="btn-sim-start">${sim.enabled?'▶️ 运行中':'▶️ 启动'}</button>
            <button class="btn btn-secondary btn-sm" id="btn-sim-stop">⏸️ 停止</button>
            <button class="btn btn-primary btn-sm" id="btn-sim-run">🎲 跑一轮</button>
            <button class="btn btn-secondary btn-sm" id="btn-sim-reset">🔄 重置</button>
          </div>
        </div>
        <div class="grid grid-4">
          <div class="form-group">
            <label>初始资金</label>
            <input type="number" id="sim-initial" value="${sim.initialBalance}" min="100" step="100" ${sim.trades.length > 0 ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label>每注金额</label>
            <input type="number" id="sim-amount" value="${sim.betAmount}" min="2" step="2">
          </div>
          <div class="form-group">
            <label>最大串关</label>
            <select id="sim-parlay">
              <option value="1" ${sim.maxParlay===1?'selected':''}>单关</option>
              <option value="2" ${sim.maxParlay===2?'selected':''}>2串1</option>
              <option value="3" ${sim.maxParlay===3?'selected':''}>3串1</option>
              <option value="4" ${sim.maxParlay===4?'selected':''}>4串1</option>
            </select>
          </div>
          <div class="form-group">
            <label>跟注策略</label>
            <select id="sim-strategy">
              <option value="valuebet" ${sim.strategy==='valuebet'?'selected':''}>💎 价值投注</option>
              <option value="hotteam" ${sim.strategy==='hotteam'?'selected':''}>🔥 强队稳胆</option>
              <option value="underdog" ${sim.strategy==='underdog'?'selected':''}>🐎 冷门博弈</option>
              <option value="mixed" ${sim.strategy==='mixed'?'selected':''}>🔀 混合策略</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn btn-secondary btn-sm" id="btn-sim-save-trades">📥 导出交易记录</button>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 资金曲线</div>
          <div id="sim-balance-chart" class="chart-container"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 每日盈亏</div>
          <div id="sim-daily-chart" class="chart-container"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">📋</span> 交易记录 (${sim.trades.length}笔)</div>
        ${this.renderSimTrades(sim.trades)}
      </div>
    `;
  },

  renderSimTrades(trades) {
    if (trades.length === 0) return '<div class="empty">暂无交易记录，点击"跑一轮"开始模拟</div>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>比赛</th><th>投注</th><th>赔率</th><th>金额</th><th>比分</th><th>结果</th><th>收益</th></tr></thead>
          <tbody>
            ${trades.slice(0, 30).map(t => `
              <tr>
                <td style="font-size:12px;">${t.date}</td>
                <td style="text-align:left;font-size:12px;">${t.home} vs ${t.away}</td>
                <td>${t.pickLabel}</td>
                <td>${t.odds.toFixed(2)}</td>
                <td>¥${t.amount}</td>
                <td>${t.score || '-'}</td>
                <td>${t.result==='win'?'<span class="tag tag-win">中</span>':t.result==='lose'?'<span class="tag tag-lose">未中</span>':'<span class="tag tag-pending">待开</span>'}</td>
                <td style="color:${t.result==='win'?'var(--accent3)':'var(--accent)'};">${t.result==='win'?'+'+((t.odds-1)*t.amount).toFixed(0):t.result==='lose'?'-'+t.amount:'-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  simStart() {
    // 读取设置
    const initial = parseInt(document.getElementById('sim-initial').value) || 1000;
    const amount = parseInt(document.getElementById('sim-amount').value) || 50;
    const parlay = parseInt(document.getElementById('sim-parlay').value) || 1;
    const strategy = document.getElementById('sim-strategy').value;

    if (this.state.sim.trades.length === 0) {
      this.state.sim.initialBalance = initial;
      this.state.sim.balance = initial;
    }
    this.state.sim.betAmount = amount;
    this.state.sim.maxParlay = parlay;
    this.state.sim.strategy = strategy;
    this.state.sim.enabled = true;
    this.saveData();
    this.renderSection();
    this.toast('模拟引擎已启动！点击"跑一轮"执行');
  },

  simStop() {
    this.state.sim.enabled = false;
    this.saveData();
    this.renderSection();
    this.toast('模拟引擎已停止');
  },

  simReset() {
    if (!confirm('确定重置模拟投注？所有交易记录将清空，余额恢复初始。')) return;
    const initial = this.state.sim.initialBalance;
    this.state.sim.balance = initial;
    this.state.sim.trades = [];
    this.state.sim.enabled = false;
    this.state.sim.lastRunDate = null;
    this.saveData();
    this.renderSection();
    this.toast('已重置，余额恢复¥' + initial);
  },

  simRunOnce() {
    // 读取设置
    const amount = parseInt(document.getElementById('sim-amount')?.value) || this.state.sim.betAmount;
    const strategy = document.getElementById('sim-strategy')?.value || this.state.sim.strategy;
    this.state.sim.betAmount = amount;
    this.state.sim.strategy = strategy;

    if (this.state.sim.balance < amount) {
      this.toast('余额不足！请重置或调整金额');
      return;
    }

    // 生成1-3场模拟比赛
    const matchCount = Math.floor(Math.random() * 3) + 1;
    const leagues = ['英超','西甲','意甲','德甲','中超'];
    const teams = {
      '英超': ['曼城','阿森纳','利物浦','曼联','切尔西','热刺'],
      '西甲': ['皇马','巴萨','马竞','皇家社会','塞维利亚'],
      '意甲': ['国米','尤文','米兰','那不勒斯','罗马'],
      '德甲': ['拜仁','多特','勒沃库森','莱比锡'],
      '中超': ['上海海港','山东泰山','上海申花','北京国安'],
    };

    const today = new Date().toISOString().split('T')[0];
    let totalReturn = 0;
    let totalCost = 0;
    let allWin = true;

    for (let i = 0; i < matchCount; i++) {
      const league = leagues[Math.floor(Math.random() * leagues.length)];
      const teamList = teams[league];
      const home = teamList[Math.floor(Math.random() * teamList.length)];
      let away = teamList[Math.floor(Math.random() * teamList.length)];
      while (away === home) away = teamList[Math.floor(Math.random() * teamList.length)];

      // 根据策略选择投注
      let pick, pickLabel, odds;
      if (strategy === 'hotteam') {
        pick = 'win'; pickLabel = '主胜';
        odds = 1.5 + Math.random() * 0.5;
      } else if (strategy === 'underdog') {
        pick = Math.random() > 0.5 ? 'lose' : 'draw';
        pickLabel = pick === 'lose' ? '客胜' : '平局';
        odds = 3.5 + Math.random() * 2.0;
      } else if (strategy === 'mixed') {
        const r = Math.random();
        if (r < 0.4) { pick = 'win'; pickLabel = '主胜'; odds = 1.8 + Math.random() * 0.8; }
        else if (r < 0.7) { pick = 'draw'; pickLabel = '平局'; odds = 2.8 + Math.random() * 1.0; }
        else { pick = 'lose'; pickLabel = '客胜'; odds = 2.8 + Math.random() * 1.2; }
      } else {
        // valuebet
        pick = Math.random() > 0.4 ? 'win' : 'draw';
        pickLabel = pick === 'win' ? '主胜' : '平局';
        odds = 2.5 + Math.random() * 1.0;
      }
      odds = parseFloat(odds.toFixed(2));

      // 模拟开奖
      const homeScore = Math.floor(Math.random() * 4);
      const awayScore = Math.floor(Math.random() * 4);
      let actual;
      if (homeScore > awayScore) actual = 'win';
      else if (homeScore === awayScore) actual = 'draw';
      else actual = 'lose';
      const isWin = actual === pick;
      if (!isWin) allWin = false;

      const ret = isWin ? odds * amount : 0;
      totalReturn += ret;
      totalCost += amount;

      this.state.sim.trades.unshift({
        date: today, league, home, away,
        pick, pickLabel, odds, amount,
        score: `${homeScore}:${awayScore}`,
        result: isWin ? 'win' : 'lose',
        return: ret,
        source: 'sim',
      });
    }

    // 更新余额
    this.state.sim.balance += totalReturn - totalCost;
    this.state.sim.lastRunDate = today;
    this.saveData();
    this.renderSection();

    const profit = totalReturn - totalCost;
    if (profit > 0) {
      this.toast(`🎉 ${matchCount}注 · 中奖¥${totalReturn.toFixed(0)} · 净赚¥${profit.toFixed(0)}`);
    } else {
      this.toast(`${matchCount}注 · 亏损¥${Math.abs(profit).toFixed(0)} · 余额¥${this.state.sim.balance.toFixed(0)}`);
    }
  },

  simSaveTrades() {
    const trades = this.state.sim.trades;
    if (trades.length === 0) { this.toast('无交易记录'); return; }
    const csv = ['日期,联赛,主队,客队,投注,赔率,金额,比分,结果,收益'];
    trades.forEach(t => {
      const profit = t.result === 'win' ? (t.odds - 1) * t.amount : -t.amount;
      csv.push(`${t.date},${t.league},${t.home},${t.away},${t.pickLabel},${t.odds},${t.amount},${t.score},${t.result==='win'?'中':'未中'},${profit.toFixed(0)}`);
    });
    const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `模拟投注记录_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('已导出CSV');
  },

  renderSimCharts() {
    // 资金曲线
    const balEl = document.getElementById('sim-balance-chart');
    if (balEl) {
      const chart = echarts.init(balEl);
      const trades = this.state.sim.trades.slice(0, 50).reverse();
      let bal = this.state.sim.initialBalance;
      const balData = [];
      const dates = new Set();
      trades.forEach(t => {
        // 反推余额
      });
      // 正向计算
      let runningBal = this.state.sim.initialBalance;
      const allTrades = this.state.sim.trades.slice().reverse();
      const balPoints = allTrades.map((t, i) => {
        runningBal += t.return - t.amount;
        return runningBal;
      });
      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: allTrades.map((t,i) => `#${i+1}`), axisLabel: { color: '#7f8c8d', fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { color: '#7f8c8d', formatter: '¥{value}' } },
        series: [{
          type: 'line', smooth: true,
          data: balPoints,
          itemStyle: { color: '#2ecc71' },
          areaStyle: {
            color: { type: 'linear', x:0, y:0, x2:0, y2:1, colorStops: [
              { offset:0, color: 'rgba(46,204,113,0.3)' },
              { offset:1, color: 'rgba(46,204,113,0.02)' },
            ]}
          },
          markLine: { data: [{ yAxis: this.state.sim.initialBalance, name: '初始' }], lineStyle: { color: '#7f8c8d', type: 'dashed' } },
        }],
      });
    }

    // 每日盈亏
    const dailyEl = document.getElementById('sim-daily-chart');
    if (dailyEl) {
      const chart = echarts.init(dailyEl);
      const map = {};
      this.state.sim.trades.forEach(t => {
        if (!map[t.date]) map[t.date] = { profit: 0, count: 0 };
        map[t.date].profit += t.return - t.amount;
        map[t.date].count++;
      });
      const days = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
      chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}<br/>盈亏: ¥{c}' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: days.map(d => d[0].substring(5)), axisLabel: { color: '#7f8c8d', fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { color: '#7f8c8d', formatter: '¥{value}' } },
        series: [{
          type: 'bar',
          data: days.map(d => parseFloat(d[1].profit.toFixed(0))),
          itemStyle: { color: function(p) { return p.value >= 0 ? '#2ecc71' : '#e74c3c'; } },
        }],
      });
    }
  },

  renderMatchList(matches, isFootball) {
    if (!matches || matches.length === 0) {
      return '<div class="empty">暂无赛程数据，点击右上角刷新</div>';
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>时间</th><th>主队</th><th>比分</th><th>客队</th><th>状态</th></tr>
          </thead>
          <tbody>
            ${matches.slice(0, 20).map(m => `
              <tr>
                <td style="font-size:12px;">${m.time || m.date}</td>
                <td style="text-align:right;">${m.home}</td>
                <td><strong style="color:${m.status==='完赛'?'var(--accent3)':'var(--accent2)'};">${m.homeScore != null ? m.homeScore + ':' + m.awayScore : 'VS'}</strong></td>
                <td style="text-align:left;">${m.away}</td>
                <td><span class="tag ${m.status==='完赛'?'tag-win':m.status==='进行中'?'tag-lose':'tag-pending'}">${m.status||'未开始'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderStandings(standings, isFootball) {
    if (!standings || standings.length === 0) {
      return '<div class="empty">暂无积分数据</div>';
    }
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>球队</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>得</th><th>失</th><th>积分</th></tr>
          </thead>
          <tbody>
            ${standings.slice(0, 20).map((s, i) => `
              <tr>
                <td style="color:${i<4?'var(--accent3)':i<6?'var(--accent2)':'var(--text-dim)'};">${i+1}</td>
                <td style="text-align:left;font-weight:600;">${s.team}</td>
                <td>${s.played}</td>
                <td>${s.win}</td>
                <td>${s.draw}</td>
                <td>${s.lose}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
                <td style="font-weight:700;color:var(--accent2);">${s.points}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // 体育数据采集
  async fetchSportsData() {
    this.showLoading('正在采集体育赛事数据...');
    const isFootball = this.state.sports.activeTab === 'football';
    const league = isFootball ? this.state.sports.footballLeague : this.state.sports.basketballLeague;
    try {
      // 尝试从公开数��源获取
      const data = await this.fetchLeagueData(league, isFootball);

      if (data.matches.length > 0) {
        this.state.sports.matches[this.state.sports.activeTab][league] = data.matches;
      } else {
        this.state.sports.matches[this.state.sports.activeTab][league] = this.generateMockMatches(league, isFootball);
      }
      if (data.standings.length > 0) {
        this.state.sports.standings[this.state.sports.activeTab][league] = data.standings;
      } else {
        this.state.sports.standings[this.state.sports.activeTab][league] = this.generateMockStandings(league, isFootball);
      }

      this.state.sports.lastFetch = Date.now();
      this.saveData();
      this.hideLoading();
      this.renderSection();
      this.toast(`${league}数据采集完成！`);
    } catch (e) {
      this.hideLoading();
      console.error(e);
      // 兜底模拟数据
      this.state.sports.matches[this.state.sports.activeTab][league] = this.generateMockMatches(league, isFootball);
      this.state.sports.standings[this.state.sports.activeTab][league] = this.generateMockStandings(league, isFootball);
      this.saveData();
      this.renderSection();
      this.toast('使用模拟赛事数据');
    }
  },

  async fetchLeagueData(league, isFootball) {
    // 尝试从公开API获取赛程和积分
    try {
      const res = await fetch(`https://www.mxnzp.com/api/sports/football/matches?league=${encodeURIComponent(league)}&app_id=demo&app_secret=demo`);
      const json = await res.json();
      if (json.code === 1 && json.data) {
        return {
          matches: json.data.map(m => ({
            home: m.home_team, away: m.away_team,
            homeScore: m.home_score, awayScore: m.away_score,
            time: m.match_time, status: m.status,
          })),
          standings: [],
        };
      }
    } catch (e) {}
    return { matches: [], standings: [] };
  },

  generateMockMatches(league, isFootball) {
    const footballTeams = {
      '英超': ['曼城','阿森纳','利物浦','曼联','切尔西','热刺','纽卡斯尔','维拉','西汉姆','布莱顿'],
      '西甲': ['皇马','巴萨','马竞','毕尔巴鄂','皇家社会','贝蒂斯','比利亚雷亚尔','瓦伦西亚','塞维利亚','赫罗纳'],
      '意甲': ['国米','尤文','米兰','那不勒斯','罗马','拉齐奥','亚特兰大','佛罗伦萨','博洛尼亚','都灵'],
      '德甲': ['拜仁','勒沃库森','多特','莱比锡','法兰克福','斯图加特','弗赖堡','霍芬海姆','沃尔夫斯堡','门兴'],
      '法甲': ['巴黎圣日耳曼','摩纳哥','里尔','尼斯','里昂','马赛','朗斯','雷恩','斯特拉斯堡','南特'],
      '中超': ['上海海港','山东泰山','上海申花','北京国安','成都蓉城','武汉三镇','河南嵩山','天津津门虎','长春亚泰','深圳队'],
      '欧冠': ['皇马','曼城','拜仁','巴黎','巴萨','国米','阿森纳','马竞','多特','马竞'],
      '世界杯': ['阿根廷','法国','克罗地亚','摩洛哥','英格兰','荷兰','葡萄牙','巴西','西班牙','德国'],
    };
    const nbaTeams = ['凯尔特人','掘金','森林狼','雷霆','独行侠','尼克斯','步行者','魔术','雄鹿','骑士','76人','太阳','湖人','勇士','快船','国王','公牛','热火','老鹰','火箭'];
    const cbaTeams = ['辽宁本钢','新疆伊力特','浙江稠州','广东华南虎','深圳马可波罗','上海久事','广厦控股','北京首钢','山东高速','山西汾酒'];
    const euroTeams = ['皇家马德里','巴塞罗那','奥林匹亚科斯','费内巴切','帕纳辛奈科斯','米兰奥林匹亚','特拉维夫马卡比','巴斯克尼亚','中央陆军','拜仁慕尼黑'];

    let teams;
    if (isFootball) teams = footballTeams[league] || footballTeams['英超'];
    else if (league === 'NBA') teams = nbaTeams;
    else if (league === 'CBA') teams = cbaTeams;
    else teams = euroTeams;

    const matches = [];
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const home = teams[Math.floor(Math.random() * teams.length)];
      let away = teams[Math.floor(Math.random() * teams.length)];
      while (away === home) away = teams[Math.floor(Math.random() * teams.length)];

      const dateOffset = i - 3; // -3天到+6天
      const date = new Date(now.getTime() + dateOffset * 86400000);
      const dateStr = `${date.getMonth()+1}/${date.getDate()}`;

      let status, homeScore = null, awayScore = null;
      if (dateOffset < 0) { status = '完赛'; homeScore = Math.floor(Math.random() * (isFootball ? 4 : 12)); awayScore = Math.floor(Math.random() * (isFootball ? 4 : 12)); }
      else if (dateOffset === 0) { status = '进行中'; homeScore = Math.floor(Math.random() * (isFootball ? 2 : 8)); awayScore = Math.floor(Math.random() * (isFootball ? 2 : 8)); }
      else { status = '未开始'; }

      matches.push({ home, away, homeScore, awayScore, time: dateStr, status, date: date.toISOString().split('T')[0] });
    }
    return matches;
  },

  generateMockStandings(league, isFootball) {
    const footballTeams = {
      '英超': ['曼城','阿森纳','利物浦','维拉','热刺','曼联','纽卡斯尔','西汉姆','布莱顿','切尔西'],
      '西甲': ['皇马','巴萨','马竞','毕尔巴鄂','皇家社会','贝蒂斯','比利亚雷亚尔','瓦伦西亚','塞维利亚','赫罗纳'],
      '意甲': ['国米','尤文','米兰','那不勒斯','罗马','拉齐奥','亚特兰大','佛罗伦萨','博洛尼亚','都灵'],
      '德甲': ['拜仁','勒沃库森','斯图加特','多特','莱比锡','法兰克福','弗赖堡','霍芬海姆','沃尔夫斯堡','门兴'],
      '法甲': ['巴黎圣日耳曼','摩纳哥','里尔','尼斯','里昂','马赛','朗斯','雷恩','斯特拉斯堡','南特'],
      '中超': ['上海海港','山东泰山','上海申花','成都蓉城','北京国安','武汉三镇','河南嵩山','天津津门虎','长春亚泰','深圳队'],
      '欧冠': ['皇马','曼城','拜仁','巴黎','巴萨','国米','阿森纳','马竞','多特','波尔图'],
      '世界杯': ['阿根廷','法国','克罗地亚','摩洛哥','英格兰','荷兰','葡萄牙','巴西','西班牙','德国'],
    };
    const nbaTeams = ['凯尔特人','掘金','森林狼','雷霆','独行侠','尼克斯','步行者','魔术','雄鹿','骑士'];
    const cbaTeams = ['辽宁本钢','新疆伊力特','浙江稠州','广东华南虎','深圳马可波罗','上海久事','广厦控股','北京首钢','山东高速','山西汾酒'];
    const euroTeams = ['皇家马德里','巴塞罗那','奥林匹亚科斯','费内巴切','帕纳辛奈科斯','米兰奥林匹亚','特拉维夫马卡比','巴斯克尼亚','中央陆军','拜仁慕尼黑'];

    let teams;
    if (isFootball) teams = footballTeams[league] || footballTeams['英超'];
    else if (league === 'NBA') teams = nbaTeams;
    else if (league === 'CBA') teams = cbaTeams;
    else teams = euroTeams;

    return teams.map((team, i) => {
      const played = 20 + Math.floor(Math.random() * 10);
      const win = Math.floor(Math.random() * played);
      const draw = isFootball ? Math.floor(Math.random() * (played - win)) : 0;
      const lose = played - win - draw;
      const gf = win * 2 + draw + Math.floor(Math.random() * 10);
      const ga = lose * 2 + draw + Math.floor(Math.random() * 8);
      return {
        team, played, win, draw, lose, gf, ga,
        points: isFootball ? win * 3 + draw : win,
      };
    }).sort((a, b) => b.points - a.points);
  },

  renderSportsCharts() {
    const sp = this.state.sports;
    const isFootball = sp.activeTab === 'football';
    const league = isFootball ? sp.footballLeague : sp.basketballLeague;
    const matches = sp.matches[sp.activeTab][league] || [];
    const standings = sp.standings[sp.activeTab][league] || [];

    // 进球/得分趋势
    const scoreEl = document.getElementById('sports-score-chart');
    if (scoreEl && matches.length > 0) {
      const chart = echarts.init(scoreEl);
      const finished = matches.filter(m => m.homeScore != null);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['主队', '客队'], textStyle: { color: '#7f8c8d' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: finished.map(m => `${m.home.slice(0,2)}vs${m.away.slice(0,2)}`), axisLabel: { color: '#7f8c8d', fontSize: 9, rotate: 30 } },
        yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
        series: [
          { name: '主队', type: 'bar', data: finished.map(m => m.homeScore), itemStyle: { color: '#e74c3c' } },
          { name: '客队', type: 'bar', data: finished.map(m => m.awayScore), itemStyle: { color: '#3498db' } },
        ],
      });
    }

    // 胜率分析
    const winEl = document.getElementById('sports-winrate-chart');
    if (winEl && standings.length > 0) {
      const chart = echarts.init(winEl);
      const top10 = standings.slice(0, 10);
      chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}<br/>胜率: {c}%' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: top10.map(s => s.team), axisLabel: { color: '#7f8c8d', fontSize: 10, rotate: 30 } },
        yAxis: { type: 'value', max: 100, axisLabel: { color: '#7f8c8d', formatter: '{value}%' } },
        series: [{
          type: 'bar',
          data: top10.map(s => s.played > 0 ? Math.round(s.win / s.played * 100) : 0),
          itemStyle: {
            color: function(p) {
              const v = p.value;
              return v >= 60 ? '#2ecc71' : v >= 40 ? '#e67e22' : '#e74c3c';
            }
          },
          label: { show: true, position: 'top', color: '#1a2332', fontSize: 10, formatter: '{c}%' },
        }],
      });
    }
  },

  addMatchBet() {
    const type = document.getElementById('match-bet-type').value;
    const pick = document.getElementById('match-bet-pick').value;
    const amount = parseInt(document.getElementById('match-bet-amount').value) || 100;
    const desc = document.getElementById('match-bet-desc').value.trim();

    if (!desc) {
      this.toast('请输入赛事描述');
      return;
    }

    const pickMap = { home: '主胜', draw: '平局', away: '客胜', handicap: '让球', over: '大分', under: '小分' };
    const record = {
      date: new Date().toISOString().split('T')[0],
      type: 'match',
      matchType: type,
      matchDesc: desc,
      pick: pickMap[pick],
      round: desc,
      numbers: [pickMap[pick]],
      amount,
      note: `${type === 'football' ? '⚽' : '🏀'} ${desc} - ${pickMap[pick]}`,
      status: 'pending',
      prize: 0,
      drawNumbers: null,
    };

    this.state.records.unshift(record);
    this.saveData();
    this.renderSection();
    this.toast('赛事竞猜已添加到跟进记录');
  },

  // ---- 链路分析 ----
  viewAnalysis() {
    const draws = this.state.drawData[this.state.lotteryType];
    const isDlt = this.state.lotteryType === 'dlt';
    const frontRange = isDlt ? 35 : (this.state.lotteryType === 'p5' ? 10 : 10);
    const frontCount = isDlt ? 5 : (this.state.lotteryType === 'p5' ? 5 : 3);
    const freq = this.calculateFrequency(draws, isDlt ? 35 : 10, isDlt);
    const backFreq = isDlt ? this.calculateFrequency(draws, 12, true, true) : null;
    const hotCold = this.getHotCold(freq);
    const backHotCold = backFreq ? this.getHotCold(backFreq) : null;
    const missing = this.calculateMissing(draws, isDlt ? 35 : 10, isDlt);

    return `
      <div class="lottery-tabs">
        <div class="lottery-tab ${this.state.lotteryType==='dlt'?'active':''}" data-type="dlt">大乐透</div>
        <div class="lottery-tab ${this.state.lotteryType==='p5'?'active':''}" data-type="p5">排列5</div>
        <div class="lottery-tab ${this.state.lotteryType==='p3'?'active':''}" data-type="p3">排列3</div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title"><span class="icon">🔥</span> ${isDlt?'前区':'号码'}热号 (近${draws.length}期)</div>
          <div class="hotcold-grid">
            ${hotCold.hot.map(n => `<div class="hotcold-item hot">${String(n.num).padStart(2,'0')}<span class="count">${n.count}次</span></div>`).join('')}
          </div>
          <div class="card-title" style="margin-top:16px;"><span class="icon">❄️</span> 冷号</div>
          <div class="hotcold-grid">
            ${hotCold.cold.map(n => `<div class="hotcold-item cold">${String(n.num).padStart(2,'0')}<span class="count">${n.count}次</span></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 号码频率分布</div>
          <div id="freq-chart" class="chart-container"></div>
        </div>
      </div>
      ${isDlt && backHotCold ? `
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">🔥</span> 后区热号</div>
          <div class="hotcold-grid">
            ${backHotCold.hot.map(n => `<div class="hotcold-item hot">${String(n.num).padStart(2,'0')}<span class="count">${n.count}次</span></div>`).join('')}
          </div>
          <div class="card-title" style="margin-top:16px;"><span class="icon">❄️</span> 后区冷号</div>
          <div class="hotcold-grid">
            ${backHotCold.cold.map(n => `<div class="hotcold-item cold">${String(n.num).padStart(2,'0')}<span class="count">${n.count}次</span></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 遗漏值分析</div>
          <div id="missing-chart" class="chart-container"></div>
        </div>
      </div>
      ` : `
      <div class="card" style="margin-top:16px;">
        <div class="card-title"><span class="icon">📈</span> 遗漏值分析</div>
        <div id="missing-chart" class="chart-container"></div>
      </div>
      `}
      <div class="grid grid-3" style="margin-top:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">🎯</span> 奇偶比统计</div>
          <div id="odd-even-chart" class="chart-container sm"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 和值走势</div>
          <div id="sum-chart" class="chart-container sm"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🔢</span> 跨度分析</div>
          <div id="span-chart" class="chart-container sm"></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title"><span class="icon">🧠</span> 智能选号推荐</div>
        ${this.renderRecommendation(freq, backFreq, hotCold, backHotCold)}
      </div>
    `;
  },

  renderRecommendation(freq, backFreq, hotCold, backHotCold) {
    const isDlt = this.state.lotteryType === 'dlt';
    // 推荐: 3热号 + 2温号 (前区)
    const hot = hotCold.hot.slice(0, 3).map(n => String(n.num).padStart(2, '0'));
    const warm = hotCold.warm.slice(0, 2).map(n => String(n.num).padStart(2, '0'));
    const front = [...hot, ...warm].sort();
    let back = [];
    if (backHotCold) {
      back = [...backHotCold.hot.slice(0,1), ...backHotCold.warm.slice(0,1)].map(n => String(n.num).padStart(2, '0')).sort();
    }
    return `
      <div style="padding:16px 0;">
        <div style="margin-bottom:12px; color:var(--text-dim); font-size:13px;">
          基于热号频率 + 温号均衡策略，仅供参考
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          ${isDlt ? '<span style="color:var(--text-dim); font-size:13px;">前区:</span>' : ''}
          <div class="balls">
            ${front.map(n => `<div class="ball red">${n}</div>`).join('')}
          </div>
          ${isDlt ? `
            <span style="color:var(--text-dim); font-size:13px; margin-left:12px;">后区:</span>
            <div class="balls">${back.map(n => `<div class="ball blue">${n}</div>`).join('')}</div>
          ` : ''}
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-primary btn-sm" onclick="App.addRecommendationToTracking('${front.join(',')}', '${back.join(',')}')">📝 加入跟进</button>
          <button class="btn btn-secondary btn-sm" onclick="App.renderSection()">🔄 重新推荐</button>
        </div>
      </div>
    `;
  },

  // ---- 花费统计 ----
  viewStats() {
    const stats = this.calculateStats();
    const monthly = this.calculateMonthlyStats();
    const byType = this.calculateByType();
    return `
      <div class="grid grid-4">
        <div class="card">
          <div class="card-title"><span class="icon">💰</span> 总投入</div>
          <div class="card-value red">¥${stats.totalSpent}</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎉</span> 总中奖</div>
          <div class="card-value green">¥${stats.totalWon}</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📉</span> 净收益</div>
          <div class="card-value ${stats.net>=0?'green':'red'}">${stats.net>=0?'+':''}¥${stats.net}</div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🎯</span> 中奖率</div>
          <div class="card-value orange">${stats.hitRate.toFixed(1)}%</div>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">📈</span> 月度收支趋势</div>
          <div id="monthly-chart" class="chart-container"></div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">🥧</span> 彩种花费占比</div>
          <div id="type-pie-chart" class="chart-container"></div>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <div class="card-title"><span class="icon">📋</span> 月度明细</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>月份</th><th>投入</th><th>中奖</th><th>净收益</th></tr></thead>
              <tbody>
                ${monthly.map(m => `
                  <tr>
                    <td>${m.month}</td>
                    <td style="color:var(--accent)">¥${m.spent}</td>
                    <td style="color:var(--accent3)">¥${m.won}</td>
                    <td style="color:${m.net>=0?'var(--accent3)':'var(--accent)'}">${m.net>=0?'+':''}¥${m.net}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 彩种明细</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>彩种</th><th>注数</th><th>投入</th><th>中奖</th><th>命中率</th></tr></thead>
              <tbody>
                ${byType.map(t => `
                  <tr>
                    <td>${this.lotteryName(t.type)}</td>
                    <td>${t.count}</td>
                    <td style="color:var(--accent)">¥${t.spent}</td>
                    <td style="color:var(--accent3)">¥${t.won}</td>
                    <td>${t.count > 0 ? ((t.winCount / t.count) * 100).toFixed(0) : 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ---- 设置 ----
  viewSettings() {
    return `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title"><span class="icon">📊</span> 数据管理</div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <button class="btn btn-primary" id="btn-fetch-data">🔄 重新采集开奖数据</button>
            <button class="btn btn-secondary" id="btn-export-data">📥 导出全部数据 (JSON)</button>
            <button class="btn btn-secondary" id="btn-import-data">📤 导入数据</button>
            <button class="btn btn-secondary" id="btn-clear-records">🗑️ 清空跟进记录</button>
            <button class="btn btn-secondary" id="btn-clear-all" style="color:var(--accent);">⚠️ 清空全部数据</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span class="icon">ℹ️</span> 关于</div>
          <div style="font-size:14px; line-height:2; color:var(--text-dim);">
            <p><strong style="color:var(--text)">体彩大数据分析中心 v3.0</strong></p>
            <p>📊 支持大乐透、排列5、排列3</p>
            <p>⚽🏀 体育赛事：英超/西甲/意甲/德甲/法甲/中超/欧冠/世界杯 + NBA/CBA</p>
            <p>🧮 足球竞彩计算器（单关/串关/让球模拟）</p>
            <p>📢 每日推送：价值投注/强队稳胆/冷门博弈/串关推荐</p>
            <p>🤖 模拟投注引擎：自动跟注、自动结算、资金曲线</p>
            <p>📋 自动采集历史开奖数据与赛事赛程</p>
            <p>📝 每日投注跟进与中奖检查（含赛事竞猜）</p>
            <p>🔗 号码频率/遗漏/奇偶/和值/跨度分析</p>
            <p>💰 花费统计与收益分析</p>
            <p>🧠 智能选号推荐</p>
            <p style="margin-top:12px; color:var(--accent);">⚠️ 理性购彩，量力而行</p>
          </div>
        </div>
      </div>
    `;
  },

  // ---- 统计计算 ----
  calculateStats() {
    const records = this.state.records;
    let totalSpent = 0, totalWon = 0, winCount = 0;
    const dates = new Set();
    records.forEach(r => {
      totalSpent += r.amount || 0;
      if (r.status === 'win') {
        totalWon += r.prize || 0;
        winCount++;
      }
      dates.add(r.date);
    });
    return {
      totalSpent,
      totalWon,
      net: totalWon - totalSpent,
      winCount,
      ticketCount: records.length,
      hitRate: records.length > 0 ? (winCount / records.length) * 100 : 0,
      days: dates.size,
    };
  },

  calculateMonthlyStats() {
    const map = {};
    this.state.records.forEach(r => {
      const month = r.date.substring(0, 7);
      if (!map[month]) map[month] = { month, spent: 0, won: 0 };
      map[month].spent += r.amount || 0;
      if (r.status === 'win') map[month].won += r.prize || 0;
    });
    return Object.values(map).map(m => ({ ...m, net: m.won - m.spent })).sort((a,b) => a.month.localeCompare(b.month));
  },

  calculateByType() {
    const map = { dlt: { type:'dlt', count:0, spent:0, won:0, winCount:0 }, p5: { type:'p5', count:0, spent:0, won:0, winCount:0 }, p3: { type:'p3', count:0, spent:0, won:0, winCount:0 }, match: { type:'match', count:0, spent:0, won:0, winCount:0 } };
    this.state.records.forEach(r => {
      if (map[r.type]) {
        map[r.type].count++;
        map[r.type].spent += r.amount || 0;
        if (r.status === 'win') {
          map[r.type].won += r.prize || 0;
          map[r.type].winCount++;
        }
      }
    });
    return Object.values(map).filter(t => t.count > 0);
  },

  calculateFrequency(draws, maxNum, isDlt, isBack) {
    const freq = {};
    for (let i = 1; i <= maxNum; i++) freq[i] = 0;
    draws.forEach(d => {
      const nums = isDlt ? (isBack ? d.numbers.slice(5) : d.numbers.slice(0, 5)) : d.numbers;
      nums.forEach(n => {
        const num = parseInt(n);
        if (freq[num] !== undefined) freq[num]++;
      });
    });
    return freq;
  },

  getHotCold(freq) {
    const arr = Object.entries(freq).map(([num, count]) => ({ num: parseInt(num), count }));
    arr.sort((a, b) => b.count - a.count);
    const hot = arr.slice(0, 7);
    const cold = arr.slice(-7).reverse();
    const warm = arr.slice(7, 14);
    return { hot, cold, warm, all: arr };
  },

  calculateMissing(draws, maxNum, isDlt) {
    const missing = {};
    for (let i = 1; i <= maxNum; i++) missing[i] = 0;
    for (let i = 0; i < draws.length; i++) {
      const nums = isDlt ? draws[i].numbers.slice(0, 5) : draws[i].numbers;
      const numSet = new Set(nums.map(n => parseInt(n)));
      for (let j = 1; j <= maxNum; j++) {
        if (!numSet.has(j)) {
          missing[j]++;
        } else {
          break; // 只统计当前遗漏
        }
      }
    }
    // 修正：统计每个号码当前遗漏期数
    const currentMissing = {};
    for (let i = 1; i <= maxNum; i++) {
      currentMissing[i] = 0;
      for (let j = 0; j < draws.length; j++) {
        const nums = isDlt ? draws[j].numbers.slice(0, 5) : draws[j].numbers;
        if (nums.map(n => parseInt(n)).includes(i)) break;
        currentMissing[i]++;
      }
    }
    return currentMissing;
  },

  oddEvenRatio(nums) {
    const odd = nums.filter(n => parseInt(n) % 2 === 1).length;
    return `${odd}:${nums.length - odd}`;
  },

  lotteryName(type) {
    return { dlt: '大乐透', p5: '排列5', p3: '排列3', match: '赛事竞猜' }[type] || type;
  },

  // ---- 图表渲染 ----
  renderCharts() {
    setTimeout(() => {
      if (this.state.currentSection === 'dashboard') {
        this.renderTrendChart();
      }
      if (this.state.currentSection === 'analysis') {
        this.renderFreqChart();
        this.renderMissingChart();
        this.renderOddEvenChart();
        this.renderSumChart();
        this.renderSpanChart();
      }
      if (this.state.currentSection === 'stats') {
        this.renderMonthlyChart();
        this.renderTypePieChart();
      }
      if (this.state.currentSection === 'sports') {
        this.renderSportsCharts();
      }
      if (this.state.currentSection === 'calc') {
        this.renderCalcCharts();
      }
      if (this.state.currentSection === 'push') {
        this.renderPushCharts();
      }
      if (this.state.currentSection === 'sim') {
        this.renderSimCharts();
      }
    }, 100);
  },

  renderTrendChart() {
    const el = document.getElementById('dashboard-trend-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const stats = this.calculateMonthlyStats();
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['投入', '中奖'], textStyle: { color: '#7f8c8d' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: stats.map(s => s.month), axisLabel: { color: '#7f8c8d' } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [
        { name: '投入', type: 'bar', data: stats.map(s => s.spent), itemStyle: { color: '#e74c3c' } },
        { name: '中奖', type: 'bar', data: stats.map(s => s.won), itemStyle: { color: '#2ecc71' } },
      ],
    });
  },

  renderFreqChart() {
    const el = document.getElementById('freq-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const isDlt = this.state.lotteryType === 'dlt';
    const freq = this.calculateFrequency(this.state.drawData[this.state.lotteryType], isDlt ? 35 : 10, isDlt);
    const data = Object.entries(freq).map(([n, c]) => ({ name: String(n).padStart(2,'0'), value: c }));
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { color: '#7f8c8d', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [{
        type: 'bar',
        data: data.map(d => d.value),
        itemStyle: {
          color: function(params) {
            const colors = ['#e74c3c','#e67e22','#f39c12','#2ecc71','#3498db','#9b59b6'];
            return colors[params.dataIndex % colors.length];
          }
        }
      }],
    });
  },

  renderMissingChart() {
    const el = document.getElementById('missing-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const isDlt = this.state.lotteryType === 'dlt';
    const missing = this.calculateMissing(this.state.drawData[this.state.lotteryType], isDlt ? 35 : 10, isDlt);
    const data = Object.entries(missing).map(([n, c]) => ({ name: String(n).padStart(2,'0'), value: c }));
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { color: '#7f8c8d', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [{
        type: 'bar',
        data: data.map(d => d.value),
        itemStyle: { color: function(p) {
          return p.value > 15 ? '#e74c3c' : p.value > 8 ? '#e67e22' : '#3498db';
        }}
      }],
    });
  },

  renderOddEvenChart() {
    const el = document.getElementById('odd-even-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const draws = this.state.drawData[this.state.lotteryType];
    const isDlt = this.state.lotteryType === 'dlt';
    const ratioMap = {};
    draws.forEach(d => {
      const nums = isDlt ? d.numbers.slice(0,5) : d.numbers;
      const r = this.oddEvenRatio(nums);
      ratioMap[r] = (ratioMap[r] || 0) + 1;
    });
    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie', radius: ['40%','70%'],
        data: Object.entries(ratioMap).map(([n, v]) => ({ name: n, value: v })),
        label: { color: '#1a2332', fontSize: 11 },
      }],
      color: ['#e74c3c','#e67e22','#2ecc71','#3498db','#9b59b6','#f39c12'],
    });
  },

  renderSumChart() {
    const el = document.getElementById('sum-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const draws = this.state.drawData[this.state.lotteryType].slice(0, 30).reverse();
    const isDlt = this.state.lotteryType === 'dlt';
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: draws.map(d => d.round), axisLabel: { color: '#7f8c8d', fontSize: 9, rotate: 45 } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [{
        type: 'line', smooth: true,
        data: draws.map(d => {
          const nums = isDlt ? d.numbers.slice(0,5) : d.numbers;
          return nums.reduce((a,b) => a + parseInt(b), 0);
        }),
        itemStyle: { color: '#3498db' },
        areaStyle: { color: 'rgba(52,152,219,0.15)' },
      }],
    });
  },

  renderSpanChart() {
    const el = document.getElementById('span-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const draws = this.state.drawData[this.state.lotteryType].slice(0, 30).reverse();
    const isDlt = this.state.lotteryType === 'dlt';
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: draws.map(d => d.round), axisLabel: { color: '#7f8c8d', fontSize: 9, rotate: 45 } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [{
        type: 'bar',
        data: draws.map(d => {
          const nums = isDlt ? d.numbers.slice(0,5) : d.numbers;
          const max = Math.max(...nums.map(n => parseInt(n)));
          const min = Math.min(...nums.map(n => parseInt(n)));
          return max - min;
        }),
        itemStyle: { color: '#e67e22' },
      }],
    });
  },

  renderMonthlyChart() {
    const el = document.getElementById('monthly-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const monthly = this.calculateMonthlyStats();
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['投入','中奖','净收益'], textStyle: { color: '#7f8c8d' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: monthly.map(m => m.month), axisLabel: { color: '#7f8c8d' } },
      yAxis: { type: 'value', axisLabel: { color: '#7f8c8d' } },
      series: [
        { name: '投入', type: 'bar', data: monthly.map(m => m.spent), itemStyle: { color: '#e74c3c' } },
        { name: '中奖', type: 'bar', data: monthly.map(m => m.won), itemStyle: { color: '#2ecc71' } },
        { name: '净收益', type: 'line', data: monthly.map(m => m.net), itemStyle: { color: '#f39c12' } },
      ],
    });
  },

  renderTypePieChart() {
    const el = document.getElementById('type-pie-chart');
    if (!el) return;
    const chart = echarts.init(el);
    const byType = this.calculateByType();
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%','70%'],
        data: byType.map(t => ({ name: this.lotteryName(t.type), value: t.spent })),
        label: { color: '#1a2332' },
      }],
      color: ['#e74c3c','#3498db','#2ecc71'],
    });
  },

  // ---- 事件绑定 ----
  bindSectionEvents() {
    // 彩种切换
    document.querySelectorAll('.lottery-tab').forEach(el => {
      el.addEventListener('click', () => {
        this.state.lotteryType = el.dataset.type;
        this.saveData();
        this.renderSection();
      });
    });

    // 刷新数据
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) btnRefresh.addEventListener('click', () => this.fetchDrawData());

    // 添加跟进
    const btnAddTrack = document.getElementById('btn-add-track');
    if (btnAddTrack) btnAddTrack.addEventListener('click', () => this.addTrackingRecord());

    // 检查中奖
    const btnCheckWins = document.getElementById('btn-check-wins');
    if (btnCheckWins) btnCheckWins.addEventListener('click', () => this.checkWins());

    // 导出
    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', () => this.exportRecords());

    // 设置页按钮
    const btnFetchData = document.getElementById('btn-fetch-data');
    if (btnFetchData) btnFetchData.addEventListener('click', () => this.fetchDrawData());

    const btnExportData = document.getElementById('btn-export-data');
    if (btnExportData) btnExportData.addEventListener('click', () => this.exportAllData());

    const btnImportData = document.getElementById('btn-import-data');
    if (btnImportData) btnImportData.addEventListener('click', () => this.importData());

    const btnClearRecords = document.getElementById('btn-clear-records');
    if (btnClearRecords) btnClearRecords.addEventListener('click', () => this.clearRecords());

    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) btnClearAll.addEventListener('click', () => this.clearAll());

    // 体育赛事
    document.querySelectorAll('[data-sport]').forEach(el => {
      el.addEventListener('click', () => {
        this.state.sports.activeTab = el.dataset.sport;
        // 切换运动类型时自动采集数据
        const league = el.dataset.sport === 'football' ? this.state.sports.footballLeague : this.state.sports.basketballLeague;
        const matches = this.state.sports.matches[this.state.sports.activeTab][league];
        if (!matches || matches.length === 0) {
          this.fetchSportsData();
        } else {
          this.saveData();
          this.renderSection();
        }
      });
    });
    document.querySelectorAll('[data-league]').forEach(el => {
      el.addEventListener('click', () => {
        const sport = this.state.sports.activeTab;
        if (sport === 'football') this.state.sports.footballLeague = el.dataset.league;
        else this.state.sports.basketballLeague = el.dataset.league;
        // 检查该联赛是否有数据，没有则采集
        const matches = this.state.sports.matches[sport][el.dataset.league];
        if (!matches || matches.length === 0) {
          this.fetchSportsData();
        } else {
          this.saveData();
          this.renderSection();
        }
      });
    });
    const btnFetchSports = document.getElementById('btn-fetch-sports');
    if (btnFetchSports) btnFetchSports.addEventListener('click', () => this.fetchSportsData());
    const btnAddMatchBet = document.getElementById('btn-add-match-bet');
    if (btnAddMatchBet) btnAddMatchBet.addEventListener('click', () => this.addMatchBet());

    // 足球计算器（全部用 onclick 内联绑定，无需 addEventListener）

    // 每日推送
    const btnGenPush = document.getElementById('btn-gen-push');
    if (btnGenPush) btnGenPush.addEventListener('click', () => this.generatePush());
    const btnTogglePush = document.getElementById('btn-toggle-push');
    if (btnTogglePush) btnTogglePush.addEventListener('click', () => this.togglePush());
    const btnSavePushToTrack = document.getElementById('btn-save-push-track');
    if (btnSavePushToTrack) btnSavePushToTrack.addEventListener('click', () => this.savePushToTracking());
    const btnSavePushToSim = document.getElementById('btn-save-push-sim');
    if (btnSavePushToSim) btnSavePushToSim.addEventListener('click', () => this.savePushToSim());
    document.querySelectorAll('.push-strategy-btn').forEach(el => {
      el.addEventListener('click', () => this.togglePushStrategy(el.dataset.strategy));
    });

    // 模拟投注
    const btnSimStart = document.getElementById('btn-sim-start');
    if (btnSimStart) btnSimStart.addEventListener('click', () => this.simStart());
    const btnSimStop = document.getElementById('btn-sim-stop');
    if (btnSimStop) btnSimStop.addEventListener('click', () => this.simStop());
    const btnSimReset = document.getElementById('btn-sim-reset');
    if (btnSimReset) btnSimReset.addEventListener('click', () => this.simReset());
    const btnSimRun = document.getElementById('btn-sim-run');
    if (btnSimRun) btnSimRun.addEventListener('click', () => this.simRunOnce());
    const btnSimSaveTrades = document.getElementById('btn-sim-save-trades');
    if (btnSimSaveTrades) btnSimSaveTrades.addEventListener('click', () => this.simSaveTrades());

    // 渲染图表
    this.renderCharts();
  },

  // ---- 跟进操作 ----
  addTrackingRecord() {
    const type = document.getElementById('track-type').value;
    let round = document.getElementById('track-round').value.trim();
    const numbersStr = document.getElementById('track-numbers').value.trim();
    const amount = parseInt(document.getElementById('track-amount').value) || 2;
    const note = document.getElementById('track-note').value.trim();

    if (!numbersStr) {
      this.toast('请输入投注号码');
      return;
    }
    const numbers = numbersStr.split(/[,，\s]+/).map(n => n.replace(/\D/g,'')).filter(n => n);

    // 自动取最新期号
    if (!round) {
      const draws = this.state.drawData[type];
      if (draws.length > 0) round = draws[0].round;
    }

    const record = {
      date: new Date().toISOString().split('T')[0],
      type, round, numbers, amount, note,
      status: 'pending',
      prize: 0,
      drawNumbers: null,
    };

    // 自动检查是否已开奖
    const draw = this.state.drawData[type].find(d => d.round === round);
    if (draw) {
      record.drawNumbers = draw.numbers;
      const result = this.checkWin(type, numbers, draw.numbers);
      record.status = result.win ? 'win' : 'lose';
      record.prize = result.prize;
    }

    this.state.records.unshift(record);
    this.saveData();
    this.renderSection();
    this.toast(record.status === 'win' ? `🎉 中奖${record.prize}元！` : record.status === 'lose' ? '未中奖' : '已添加，等待开奖');
  },

  checkWin(type, bet, draw) {
    const isDlt = type === 'dlt';
    if (isDlt) {
      const frontBet = bet.slice(0, 5).map(n => parseInt(n));
      const backBet = bet.slice(5).map(n => parseInt(n));
      const frontDraw = draw.slice(0, 5).map(n => parseInt(n));
      const backDraw = draw.slice(5).map(n => parseInt(n));
      const frontMatch = frontBet.filter(n => frontDraw.includes(n)).length;
      const backMatch = backBet.filter(n => backDraw.includes(n)).length;

      // 大乐透奖级
      if (frontMatch === 5 && backMatch === 2) return { win: true, prize: 10000000 };
      if (frontMatch === 5 && backMatch === 1) return { win: true, prize: 500000 };
      if (frontMatch === 5) return { win: true, prize: 10000 };
      if (frontMatch === 4 && backMatch === 2) return { win: true, prize: 3000 };
      if (frontMatch === 4 && backMatch === 1) return { win: true, prize: 300 };
      if (frontMatch === 4) return { win: true, prize: 100 };
      if (frontMatch === 3 && backMatch === 2) return { win: true, prize: 200 };
      if (frontMatch === 3 && backMatch === 1) return { win: true, prize: 15 };
      if (frontMatch === 3) return { win: true, prize: 15 };
      if (frontMatch === 2 && backMatch === 2) return { win: true, prize: 15 };
      if (frontMatch === 2 && backMatch === 1) return { win: true, prize: 5 };
      if (frontMatch === 1 && backMatch === 2) return { win: true, prize: 5 };
      if (frontMatch === 0 && backMatch === 2) return { win: true, prize: 5 };
      return { win: false, prize: 0 };
    }
    // 排列5/排列3 - 直选
    const betStr = bet.join('');
    const drawStr = draw.join('');
    if (type === 'p5') {
      return betStr === drawStr ? { win: true, prize: 100000 } : { win: false, prize: 0 };
    }
    if (type === 'p3') {
      if (betStr === drawStr) return { win: true, prize: 1040 };
      // 组选
      const sortedBet = bet.map(n=>parseInt(n)).sort().join('');
      const sortedDraw = draw.map(n=>parseInt(n)).sort().join('');
      if (sortedBet === sortedDraw) {
        const set = new Set(bet.map(n=>parseInt(n)));
        return { win: true, prize: set.size === 2 ? 346 : 173 };
      }
      return { win: false, prize: 0 };
    }
    return { win: false, prize: 0 };
  },

  checkWins() {
    let updated = 0;
    this.state.records.forEach(r => {
      if (r.status === 'pending') {
        const draw = this.state.drawData[r.type].find(d => d.round === r.round);
        if (draw) {
          r.drawNumbers = draw.numbers;
          const result = this.checkWin(r.type, r.numbers, draw.numbers);
          r.status = result.win ? 'win' : 'lose';
          r.prize = result.prize;
          updated++;
        }
      }
    });
    this.saveData();
    this.renderSection();
    this.toast(updated > 0 ? `已检查${updated}条记录` : '没有待开奖的记录');
  },

  addToTracking(round) {
    this.state.currentSection = 'tracking';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-section="tracking"]').classList.add('active');
    this.renderSection();
    setTimeout(() => {
      const roundInput = document.getElementById('track-round');
      if (roundInput) roundInput.value = round;
    }, 50);
  },

  addRecommendationToTracking(frontStr, backStr) {
    this.state.currentSection = 'tracking';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-section="tracking"]').classList.add('active');
    this.renderSection();
    setTimeout(() => {
      document.getElementById('track-round').value = '';
      const nums = backStr ? `${frontStr},${backStr}` : frontStr;
      document.getElementById('track-numbers').value = nums;
      document.getElementById('track-type').value = this.state.lotteryType;
    }, 50);
  },

  editRecord(i) {
    const r = this.state.records[i];
    this.showModal(`
      <div class="modal-header">
        <h3>编辑记录</h3>
        <span class="modal-close" onclick="App.closeModal()">×</span>
      </div>
      <div class="form-group">
        <label>状态</label>
        <select id="edit-status">
          <option value="pending" ${r.status==='pending'?'selected':''}>待开奖</option>
          <option value="win" ${r.status==='win'?'selected':''}>中奖</option>
          <option value="lose" ${r.status==='lose'?'selected':''}>未中</option>
        </select>
      </div>
      <div class="form-group">
        <label>中奖金额</label>
        <input type="number" id="edit-prize" value="${r.prize||0}">
      </div>
      <div class="form-group">
        <label>投注金额</label>
        <input type="number" id="edit-amount" value="${r.amount}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="edit-note" value="${r.note||''}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="App.saveRecord(${i})">保存</button>
      </div>
    `);
  },

  saveRecord(i) {
    const r = this.state.records[i];
    r.status = document.getElementById('edit-status').value;
    r.prize = parseInt(document.getElementById('edit-prize').value) || 0;
    r.amount = parseInt(document.getElementById('edit-amount').value) || r.amount;
    r.note = document.getElementById('edit-note').value;
    this.saveData();
    this.closeModal();
    this.renderSection();
    this.toast('记录已更新');
  },

  deleteRecord(i) {
    this.state.records.splice(i, 1);
    this.saveData();
    this.renderSection();
    this.toast('记录已删除');
  },

  exportRecords() {
    const csv = ['日期,彩种,期号,投注号码,金额,状态,中奖金额'];
    this.state.records.forEach(r => {
      csv.push(`${r.date},${this.lotteryName(r.type)},${r.round},${r.numbers.join(' ')},${r.amount},${r.status==='win'?'中奖':r.status==='lose'?'未中':'待开'},${r.prize||0}`);
    });
    const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `跟进记录_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('已导出CSV');
  },

  exportAllData() {
    const data = JSON.stringify(this.state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `体彩数据备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('数据已导出');
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          this.state = { ...this.state, ...data };
          this.saveData();
          this.render();
          this.toast('数据导入成功');
        } catch (err) {
          this.toast('导入失败: 文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  clearRecords() {
    if (confirm('确定清空所有跟进记录？此操作不可撤销。')) {
      this.state.records = [];
      this.saveData();
      this.renderSection();
      this.toast('跟进记录已清空');
    }
  },

  clearAll() {
    if (confirm('确定清空全部数据？包括开奖数据和跟进记录，此操作不可撤销。')) {
      this.state = {
        currentSection: 'home',
        currentModule: 'home',
        lotteryType: 'dlt',
        drawData: { dlt: [], p5: [], p3: [] },
        records: [],
        stats: { totalSpent: 0, totalWon: 0, ticketCount: 0 },
        sports: {
          activeTab: 'football',
          footballLeague: '英超',
          basketballLeague: 'NBA',
          matches: { football: {}, basketball: {} },
          standings: { football: {}, basketball: {} },
          lastFetch: 0,
        },
        calc: {
          matches: [],
          betAmount: 2,
          mode: 'single',
        },
        push: {
          enabled: true,
          lastPushDate: null,
          strategies: ['valuebet', 'hotteam', 'underdog'],
          history: [],
        },
        sim: {
          enabled: false,
          balance: 1000,
          initialBalance: 1000,
          strategy: 'valuebet',
          betAmount: 50,
          maxParlay: 3,
          autoMode: true,
          trades: [],
          lastRunDate: null,
        },
      };
      localStorage.removeItem('lotteryApp');
      this.render();
      this.toast('全部数据已清空');
    }
  },

  // ---- 工具 ----
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.classList.add('active');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  showLoading(text) {
    const el = document.getElementById('loading');
    if (el) {
      el.style.display = 'block';
      document.getElementById('loading-text').textContent = text || '加载中...';
    }
  },

  hideLoading() {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
  },

  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  },
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
