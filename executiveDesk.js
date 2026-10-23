/**
 * executiveDesk.js - Bàn Làm Việc: Bộ Động Cơ Phân Tích AI & Dự Báo Điều Hành Cao Cấp
 * 
 * Tính năng chính:
 * 1. AI Tự Động Phân Tích & Báo Cáo Nhân Sự Trễ Hẹn & Có Nguy Cơ (Personnel Intelligence & Diagnostics)
 * 2. Dự Báo Tiến Độ & Sức Khỏe Hoạt Động Các Phòng Ban (Department Predictive Analytics 7-30 Ngày)
 * 3. Bản Tin Điều Hành AI Realtime (Executive Briefing & Daily Insights)
 * 4. Bộ Cân Bằng Tải Nhân Lực Thông Minh 1-Click (Smart Workload Rebalancer)
 * 5. Trợ Lý AI Hỏi Đáp Điều Hành Trực Tuyến (Interactive Executive AI Assistant)
 */

class ExecutiveDeskEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Sinh toàn bộ dữ liệu phân tích và dự báo điều hành cấp cao
   * @param {Object} options { department, riskFilter, timeHorizon }
   */
  generateAnalytics(options = {}) {
    const tasks = this.db.getTasks();
    const users = this.db.getUsers();
    const departments = this.db.data.departments || [];
    const now = new Date();

    const targetDept = options.department && options.department !== 'all' ? options.department : null;

    // Filter tasks if department selected
    const scopeTasks = targetDept ? tasks.filter(t => t.department === targetDept) : tasks;
    const scopeUsers = targetDept ? users.filter(u => u.department === targetDept) : users;

    // 1. Phân Tích Chi Tiết Từng Nhân Sự (Personnel Intelligence)
    const personnelList = scopeUsers.map(user => {
      const userTasks = scopeTasks.filter(t => t.assignedTo === user.id);
      const activeTasks = userTasks.filter(t => t.status !== 'completed');
      const completedTasks = userTasks.filter(t => t.status === 'completed');
      
      // Tasks overdue
      const overdueTasks = activeTasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due < now;
      }).map(t => {
        const due = new Date(t.dueDate);
        const daysOverdue = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          id: t.id,
          title: t.title,
          priority: t.priority || 'medium',
          status: t.status,
          progress: t.progress || 0,
          dueDate: t.dueDate,
          daysOverdue,
          department: t.department
        };
      }).sort((a, b) => b.daysOverdue - a.daysOverdue);

      // Tasks at risk (due in <= 48 hours, progress < 50%)
      const atRiskTasks = activeTasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursLeft >= 0 && hoursLeft <= 48 && (t.progress || 0) < 50;
      }).map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority || 'medium',
        status: t.status,
        progress: t.progress || 0,
        dueDate: t.dueDate,
        department: t.department
      }));

      const reviewTasks = activeTasks.filter(t => t.status === 'review');
      const urgentOverdueCount = overdueTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      
      // Tỷ lệ hoàn thành đúng hạn (On-time Delivery Rate)
      let onTimeCount = 0;
      completedTasks.forEach(t => {
        if (!t.dueDate || !t.completedAt) onTimeCount++;
        else if (new Date(t.completedAt) <= new Date(t.dueDate)) onTimeCount++;
      });
      const onTimeRate = completedTasks.length > 0 
        ? Math.round((onTimeCount / completedTasks.length) * 100) 
        : (overdueTasks.length === 0 ? 100 : Math.max(0, 100 - overdueTasks.length * 20));

      // Điểm Rủi Ro AI (AI Risk Index 0 - 100)
      let riskScore = 0;
      riskScore += overdueTasks.length * 15;
      riskScore += urgentOverdueCount * 22;
      riskScore += atRiskTasks.length * 12;
      if (activeTasks.length > 5) riskScore += (activeTasks.length - 5) * 8;
      if (reviewTasks.length >= 3) riskScore += 10;
      riskScore = Math.min(100, Math.max(0, riskScore));

      // Phân nhóm mức độ rủi ro
      let riskLevel = 'healthy'; // healthy, warning, critical
      if (riskScore >= 50 || urgentOverdueCount > 0 || overdueTasks.length >= 3) {
        riskLevel = 'critical';
      } else if (riskScore >= 20 || overdueTasks.length >= 1 || atRiskTasks.length >= 1 || activeTasks.length >= 5) {
        riskLevel = 'warning';
      }

      // 🧠 AI Chẩn Đoán Nguyên Nhân Gốc Rễ (Root Cause Diagnostics)
      const rootCauses = [];
      if (activeTasks.length >= 5) {
        rootCauses.push(`⚠️ Quá tải công việc: Đang phụ trách đồng thời ${activeTasks.length} việc (vượt 150% ngưỡng hiệu quả khuyến nghị).`);
      }
      if (reviewTasks.length >= 2) {
        rootCauses.push(`⏳ Tắc nghẽn nghiệm thu: ${reviewTasks.length} việc đã xong nhưng bị ứ đọng chờ duyệt, gây trễ hạn chuỗi.`);
      }
      const stalledTasks = overdueTasks.filter(t => t.progress < 25);
      if (stalledTasks.length >= 1) {
        rootCauses.push(`❄️ Tiến độ đình trệ: Có ${stalledTasks.length} việc quá hạn nhưng tiến độ < 25% (nguy cơ bế tắc phát sinh).`);
      }
      if (urgentOverdueCount >= 1) {
        rootCauses.push(`🔥 Áp lực nhiệm vụ trọng yếu: Đang gánh ${urgentOverdueCount} việc Khẩn cấp/Cao bị quá hạn cần chi viện nguồn lực.`);
      }
      if (rootCauses.length === 0 && overdueTasks.length > 0) {
        rootCauses.push(`⏱️ Lệch thời gian thực thi: Cần tái phân bổ thứ tự ưu tiên các việc trong ngày.`);
      }

      // ⚡ AI Đề Xuất Hành Động Can Thiệp Thông Minh (Actionable Recommendations)
      let recommendedAction = 'Tiến độ vận hành rất tốt, tiếp tục duy trì.';
      if (riskLevel === 'critical') {
        if (activeTasks.length >= 5) {
          recommendedAction = `San sẻ tải ngay: Chuyển bớt 1-2 việc không khẩn cấp cho nhân sự khác trong phòng để tập trung giải cứu ${overdueTasks.length} việc trễ.`;
        } else if (reviewTasks.length >= 2) {
          recommendedAction = `Thúc đẩy phê duyệt: Đề nghị Trưởng bộ phận duyệt ngay ${reviewTasks.length} việc chờ nghiệm thu trong hôm nay.`;
        } else {
          recommendedAction = `Can thiệp trực tiếp: Họp 1-on-1 tháo gỡ vướng mắc kỹ thuật và gia hạn thêm 2-3 ngày để dứt điểm việc khẩn cấp.`;
        }
      } else if (riskLevel === 'warning') {
        if (atRiskTasks.length > 0) {
          recommendedAction = `Cảnh báo hạn chót: Đôn đốc tập trung dồn sức vào ${atRiskTasks.length} việc sắp đến hạn trong 48h tới.`;
        } else {
          recommendedAction = `Điều chỉnh tiến độ: Cập nhật nhật ký và chốt hạn cụ thể cho từng đầu việc nhỏ.`;
        }
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar || '👤',
          role: user.role,
          department: user.department || 'Chưa phân bổ',
          position: user.position || 'Nhân viên',
          email: user.email
        },
        stats: {
          totalTasks: userTasks.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          overdueCount: overdueTasks.length,
          atRiskCount: atRiskTasks.length,
          reviewCount: reviewTasks.length,
          urgentOverdueCount,
          onTimeRate
        },
        riskScore,
        riskLevel,
        rootCauses,
        recommendedAction,
        overdueTasks,
        atRiskTasks
      };
    });

    // Sắp xếp nhân sự theo mức độ rủi ro giảm dần (Critical -> Warning -> Healthy)
    personnelList.sort((a, b) => b.riskScore - a.riskScore);

    // 2. Dự Báo & Sức Khỏe Hoạt Động Của Các Phòng Ban (Department Health & Forecasts)
    const departmentForecasts = departments.map(dept => {
      const deptTasks = tasks.filter(t => t.department === dept.name);
      const deptMembers = users.filter(u => u.department === dept.name);
      const activeTasks = deptTasks.filter(t => t.status !== 'completed');
      const completedTasks = deptTasks.filter(t => t.status === 'completed');
      const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
      const reviewTasks = activeTasks.filter(t => t.status === 'review');
      const urgentTasks = activeTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');

      const memberCount = Math.max(1, deptMembers.length);
      const workloadRatio = Math.round((activeTasks.length / memberCount) * 10) / 10; // Số việc / nhân sự

      // Tỷ lệ hoàn thành & Tỷ lệ trễ hạn
      const completionRate = deptTasks.length > 0 
        ? Math.round((completedTasks.length / deptTasks.length) * 100) 
        : 0;
      const overdueRate = activeTasks.length > 0 
        ? Math.round((overdueTasks.length / activeTasks.length) * 100) 
        : 0;

      // Điểm Sức Khỏe Phòng Ban (0 - 100)
      let healthScore = 100;
      healthScore -= overdueRate * 0.65;
      if (workloadRatio > 4) healthScore -= (workloadRatio - 4) * 7;
      if (reviewTasks.length >= 4) healthScore -= 10;
      healthScore = Math.max(20, Math.min(100, Math.round(healthScore)));

      let healthStatus = 'good';
      if (healthScore >= 80) healthStatus = 'excellent';
      else if (healthScore >= 65) healthStatus = 'good';
      else if (healthScore >= 50) healthStatus = 'warning';
      else healthStatus = 'critical';

      // Nút thắt cổ chai phát hiện được (Bottlenecks)
      const bottlenecks = [];
      if (overdueRate > 35) {
        bottlenecks.push(`🚨 Tỷ lệ trễ hạn cao: ${overdueRate}% việc đang chạy bị quá hạn.`);
      }
      if (workloadRatio > 4.5) {
        bottlenecks.push(`⚡ Căng thẳng nhân lực: Tải trọng bình quân ${workloadRatio} việc/người (vượt mức an toàn).`);
      }
      if (reviewTasks.length >= 3) {
        bottlenecks.push(`⏳ Tắc nghẽn nghiệm thu: ${reviewTasks.length} việc đang dồn ứ tại khâu Chờ Duyệt.`);
      }
      if (bottlenecks.length === 0) {
        bottlenecks.push(`🟢 Nhịp độ ổn định: Quy trình luân chuyển công việc diễn ra trôi chảy.`);
      }

      // Dự Báo 7 Ngày Tới (AI 7-Day Forecast)
      const projectedOnTimeRate = Math.max(40, Math.min(98, Math.round(100 - overdueRate * 0.75)));
      const projectedOverdueIn7Days = Math.round(overdueTasks.length * 0.8 + (activeTasks.length * 0.15));
      const projectedCompletions7Days = Math.round(activeTasks.length * 0.35 + completedTasks.length * 0.05);
      
      let trend = 'stable';
      if (healthScore >= 75 && overdueRate < 20) trend = 'improving';
      else if (healthScore < 55 || overdueRate > 40) trend = 'declining';

      // Dự Báo 30 Ngày Tới (AI 30-Day Forecast)
      const monthlyVelocity = Math.max(5, Math.round(completedTasks.length * 0.5 + activeTasks.length * 0.8));
      const capacityStatus = workloadRatio > 4 ? 'Quá tải (Overloaded)' : workloadRatio > 2.5 ? 'Tải tối ưu' : 'Còn dư công suất';

      // Lời khuyên chiến lược của AI cho Ban Giám Đốc / Trưởng Phòng
      let aiAdvisory = '';
      if (healthStatus === 'critical') {
        aiAdvisory = `Can thiệp khẩn cấp: Giảm tải ngay các task phụ, tập trung toàn bộ lực lượng giải phóng ${overdueTasks.length} việc trễ và duyệt ${reviewTasks.length} việc đang nghẽn.`;
      } else if (healthStatus === 'warning') {
        aiAdvisory = `Tái cấu trúc lịch trình: Rà soát lại thời hạn cam kết các dự án và bổ sung hỗ trợ liên phòng ban.`;
      } else {
        aiAdvisory = `Đang vận hành xuất sắc: Tiếp tục chuẩn hóa quy trình và có thể tiếp nhận thêm các dự án mới.`;
      }

      return {
        id: dept.id,
        name: dept.name,
        memberCount: deptMembers.length,
        stats: {
          totalTasks: deptTasks.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          overdueTasks: overdueTasks.length,
          reviewTasks: reviewTasks.length,
          urgentTasks: urgentTasks.length,
          workloadRatio,
          completionRate,
          overdueRate
        },
        healthScore,
        healthStatus,
        capacityStatus,
        bottlenecks,
        forecast7Days: {
          projectedOnTimeRate,
          projectedOverdue: projectedOverdueIn7Days,
          projectedCompletions: projectedCompletions7Days,
          trend,
          summary: `Dự báo trong 7 ngày tới: ${projectedCompletions7Days} việc sẽ hoàn tất; tỷ lệ đúng hạn kỳ vọng đạt ${projectedOnTimeRate}%.`
        },
        forecast30Days: {
          monthlyVelocity,
          capacityStatus,
          riskAlert: trend === 'declining' ? 'Cảnh báo nguy cơ vỡ tiến độ tháng nếu không san tải.' : 'Tiến độ an toàn theo kế hoạch.'
        },
        aiAdvisory
      };
    });

    // Sắp xếp phòng ban theo điểm sức khỏe (thấp nhất lên đầu để lãnh đạo can thiệp trước)
    departmentForecasts.sort((a, b) => a.healthScore - b.healthScore);

    // 3. Đề Xuất Cân Bằng Tải Thông Minh (Smart Workload Rebalancer)
    const rebalanceSuggestions = [];
    const overloadedList = personnelList.filter(p => p.stats.activeTasks >= 4 && p.stats.overdueCount > 0);
    const companyAvailableList = personnelList.filter(p => p.stats.activeTasks <= 2);

    overloadedList.slice(0, 8).forEach(source => {
      // 1. Tìm nhân sự cùng phòng ban trước
      let target = personnelList.find(p => p.user.id !== source.user.id && p.user.department === source.user.department && p.stats.activeTasks <= 3);
      // 2. Nếu không có cùng phòng, tìm nhân sự khả dụng toàn công ty
      if (!target) {
        target = companyAvailableList.find(p => p.user.id !== source.user.id);
      }

      if (target) {
        const candidateTask = scopeTasks.find(t => 
          t.assignedTo === source.user.id && 
          t.status !== 'completed' && 
          (t.progress || 0) < 50
        );
        if (candidateTask) {
          rebalanceSuggestions.push({
            department: source.user.department,
            taskId: candidateTask.id,
            taskTitle: candidateTask.title,
            priority: candidateTask.priority,
            fromUser: source.user,
            toUser: target.user,
            reason: `Nhân sự ${source.user.name} đang quá tải (${source.stats.activeTasks} việc, ${source.stats.overdueCount} việc trễ) ➔ Chuyển giao sang ${target.user.name} (${target.user.department}, đang có ${target.stats.activeTasks} việc) để san sẻ áp lực.`
          });
        }
      }
    });

    // 4. Tổng Quan Chỉ Số Doanh Nghiệp (Enterprise KPIs)
    const totalTasksCount = scopeTasks.length;
    const completedTasksCount = scopeTasks.filter(t => t.status === 'completed').length;
    const activeTasksCount = scopeTasks.filter(t => t.status !== 'completed').length;
    const totalOverdueCount = scopeTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
    const highRiskPersonnelCount = personnelList.filter(p => p.riskLevel === 'critical').length;
    const warningPersonnelCount = personnelList.filter(p => p.riskLevel === 'warning').length;
    const criticalDeptsCount = departmentForecasts.filter(d => d.healthStatus === 'critical').length;

    // Enterprise Health Score (0 - 100)
    let enterpriseHealthScore = 100;
    if (activeTasksCount > 0) {
      const globalOverdueRate = (totalOverdueCount / activeTasksCount) * 100;
      enterpriseHealthScore -= Math.round(globalOverdueRate * 0.6);
    }
    enterpriseHealthScore -= highRiskPersonnelCount * 4;
    enterpriseHealthScore = Math.max(30, Math.min(98, Math.round(enterpriseHealthScore)));

    // Top 3 Điểm Nóng Khẩn Cấp (Top Urgent Critical Matters)
    const topUrgentMatters = [];
    const urgentTasksOverdue = scopeTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now && (t.priority === 'urgent' || t.priority === 'high'))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 3);

    urgentTasksOverdue.forEach(t => {
      const assignee = users.find(u => u.id === t.assignedTo);
      topUrgentMatters.push({
        id: t.id,
        title: t.title,
        priority: t.priority,
        department: t.department,
        dueDate: t.dueDate,
        assigneeName: assignee ? assignee.name : 'Chưa phân công',
        alertText: `Công việc #${t.id} (${t.priority.toUpperCase()}) phụ trách bởi ${assignee ? assignee.name : 'N/A'} đã quá hạn cần chỉ đạo gấp.`
      });
    });

    // 5. Bản Tin Điều Hành AI Tự Động (AI Executive Summary)
    const worstDept = departmentForecasts[0];
    const bestDept = departmentForecasts[departmentForecasts.length - 1];

    const executiveSummary = {
      generatedAt: now.toISOString(),
      healthScore: enterpriseHealthScore,
      healthLabel: enterpriseHealthScore >= 80 ? 'Xuất sắc' : enterpriseHealthScore >= 65 ? 'Ổn định' : 'Cần can thiệp',
      narrative: `Hệ thống ghi nhận điểm sức khỏe vận hành đạt ${enterpriseHealthScore}/100. Hiện có ${totalOverdueCount} công việc quá hạn trên tổng số ${activeTasksCount} việc đang triển khai. Có ${highRiskPersonnelCount} nhân sự ở mức rủi ro cao và ${criticalDeptsCount} phòng ban cần hỗ trợ giải tỏa nút thắt. Phòng ban hoạt động tốt nhất là "${bestDept ? bestDept.name : 'N/A'}" (Điểm sức khỏe ${bestDept ? bestDept.healthScore : 0}), trong khi "${worstDept ? worstDept.name : 'N/A'}" đang chịu tải trọng cao nhất cần ưu tiên điều phối nguồn lực.`,
      topDecisions: [
        `Phê duyệt tái phân bổ ${rebalanceSuggestions.length} công việc để giảm tải ngay cho các nhân sự nhóm Rủi ro cao.`,
        `Yêu cầu Trưởng bộ phận ${worstDept ? worstDept.name : 'phòng ban nghẽn'} rà soát khâu nghiệm thu để giải phóng các công việc chờ duyệt.`,
        `Tập trung xử lý dứt điểm ${topUrgentMatters.length} đầu việc khẩn cấp trọng yếu trong 24 giờ tới.`
      ]
    };

    return {
      scope: {
        department: targetDept || 'all',
        deptName: targetDept || 'Toàn Doanh Nghiệp (16 Phòng Ban)',
        generatedAt: now.toISOString()
      },
      kpis: {
        enterpriseHealthScore,
        totalTasksCount,
        completedTasksCount,
        activeTasksCount,
        totalOverdueCount,
        highRiskPersonnelCount,
        warningPersonnelCount,
        criticalDeptsCount,
        onTimeRateOverall: activeTasksCount > 0 ? Math.max(0, 100 - Math.round((totalOverdueCount / activeTasksCount) * 100)) : 100
      },
      executiveSummary,
      topUrgentMatters,
      personnelList,
      departmentForecasts,
      rebalanceSuggestions
    };
  }

  /**
   * Trợ Lý AI Điều Hành Trực Tuyến: Trả lời câu hỏi của Lãnh Đạo bằng ngôn ngữ tự nhiên
   * @param {string} question 
   * @param {Object} options 
   */
  askExecutiveAi(question, options = {}) {
    const analytics = this.generateAnalytics(options);
    const qLower = (question || '').toLowerCase().trim();

    // Intent 1: Nhân sự trễ hạn / Ai trễ / Ai rủi ro cao
    if (qLower.includes('trễ') || qLower.includes('quá hạn') || qLower.includes('ai') || qLower.includes('nhân sự') || qLower.includes('rủi ro')) {
      const highRisk = analytics.personnelList.filter(p => p.riskLevel === 'critical').slice(0, 5);
      if (highRisk.length === 0) {
        return {
          answer: `🎉 **Tuyệt vời!** Hiện tại không có nhân sự nào ở mức rủi ro cao. Tất cả công việc đều đang được duy trì trong ngưỡng tiến độ an toàn.`,
          metrics: { count: 0, list: [] }
        };
      }

      let res = `### 🚨 Danh Sách Nhân Sự Có Nguy Cơ & Trễ Hạn Cao Nhất:\n\n`;
      highRisk.forEach((p, idx) => {
        res += `**${idx + 1}. ${p.user.name} (${p.user.department})**\n`;
        res += `- ⚠️ Số việc quá hạn: **${p.stats.overdueCount}** việc | Đang chạy: **${p.stats.activeTasks}** việc\n`;
        res += `- 🧠 Chẩn đoán AI: *${p.rootCauses.join(' ')}*\n`;
        res += `- ⚡ Đề xuất hành động: **${p.recommendedAction}**\n\n`;
      });
      res += `💡 **Khuyến nghị Lãnh đạo**: Bấm nút **"Cân Bằng Tải"** trên Bàn Làm Việc để san sẻ bớt việc sang các nhân sự đang còn dư công suất trong cùng phòng ban.`;

      return {
        answer: res,
        metrics: { count: highRisk.length, list: highRisk.map(h => h.user.name) }
      };
    }

    // Intent 2: Tình hình phòng ban / Dự báo phòng ban / Phòng nào yếu nhất
    if (qLower.includes('phòng ban') || qLower.includes('dự báo') || qLower.includes('sức khỏe') || qLower.includes('khối')) {
      const criticalDepts = analytics.departmentForecasts.slice(0, 3);
      let res = `### 🏢 Dự Báo & Tình Hình Hoạt Động Của Các Phòng Ban:\n\n`;
      criticalDepts.forEach((d, idx) => {
        res += `**${idx + 1}. ${d.name}** — Điểm sức khỏe: **${d.healthScore}/100** (${d.healthStatus.toUpperCase()})\n`;
        res += `- Tải trọng: **${d.stats.workloadRatio} việc/người** | Trễ hạn: **${d.stats.overdueTasks}/${d.stats.activeTasks} việc** (${d.stats.overdueRate}%)\n`;
        res += `- 🔮 Dự báo 7 ngày: *${d.forecast7Days.summary}*\n`;
        res += `- 💡 Lời khuyên chiến lược: *${d.aiAdvisory}*\n\n`;
      });

      return {
        answer: res,
        metrics: { depts: criticalDepts.map(d => ({ name: d.name, score: d.healthScore })) }
      };
    }

    // Intent 3: Cân bằng tải / San việc / Ai rảnh
    if (qLower.includes('san việc') || qLower.includes('cân bằng') || qLower.includes('rảnh') || qLower.includes('trống')) {
      const suggestions = analytics.rebalanceSuggestions;
      if (suggestions.length === 0) {
        return {
          answer: `⚖️ **Khối lượng công việc hiện đang khá đồng đều** giữa các nhân sự trong từng phòng ban. Chưa phát hiện điểm lệch tải nghiêm trọng cần chuyển giao việc.`,
          metrics: { count: 0 }
        };
      }

      let res = `### ⚖️ Đề Xuất Cân Bằng Tải Nhân Lực Thông Minh:\n\n`;
      suggestions.slice(0, 4).forEach((s, idx) => {
        res += `**Phương án ${idx + 1} (${s.department}):**\n`;
        res += `Chuyển công việc **#${s.taskId}: ${s.taskTitle}** từ **${s.fromUser.name}** ➔ sang cho **${s.toUser.name}**.\n`;
        res += `*Lý do:* ${s.reason}\n\n`;
      });
      res += `👉 **Lãnh đạo có thể bấm nút "⚡ Thực Hiện Chuyển Việc"** trực tiếp tại bảng Cân Bằng Tải trên Bàn Làm Việc để hệ thống tự động tái phân công ngay tức thì!`;

      return {
        answer: res,
        metrics: { count: suggestions.length }
      };
    }

    // Default: Toàn cảnh tổng quan điều hành
    return {
      answer: `### 💼 Bản Tin Tóm Tắt Tình Hình Điều Hành Toàn Doanh Nghiệp:\n\n` +
        `- 🎯 **Điểm Sức Khỏe Doanh Nghiệp:** **${analytics.kpis.enterpriseHealthScore}/100** (${analytics.executiveSummary.healthLabel})\n` +
        `- 📋 **Tiến độ tổng thể:** **${analytics.kpis.completedTasksCount}** việc hoàn thành / **${analytics.kpis.totalTasksCount}** tổng số việc.\n` +
        `- 🚨 **Công việc quá hạn:** **${analytics.kpis.totalOverdueCount}** việc (${analytics.kpis.highRiskPersonnelCount} nhân sự ở mức Rủi ro cao).\n` +
        `- 🏢 **Phòng ban cần chú ý:** **${analytics.departmentForecasts[0]?.name || 'N/A'}** (Điểm: ${analytics.departmentForecasts[0]?.healthScore || 0}).\n\n` +
        `**3 Hành Động Chỉ Đạo Trọng Tâm Hôm Nay:**\n` +
        analytics.executiveSummary.topDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n'),
      metrics: analytics.kpis
    };
  }

  /**
   * Thực hiện chuyển việc theo đề xuất cân bằng tải của AI
   */
  executeRebalance(taskId, targetUserId, currentUser) {
    const task = this.db.getTaskById(taskId);
    if (!task) throw new Error('Không tìm thấy công việc cần chuyển giao');
    const targetUser = this.db.getUserById(targetUserId);
    if (!targetUser) throw new Error('Nhân sự nhận việc không tồn tại');

    const oldAssigneeId = task.assignedTo;
    const oldAssignee = this.db.getUserById(oldAssigneeId);

    // Update task
    const updater = currentUser || { id: 'admin', name: 'Executive AI', role: 'admin', avatar: '⚖️' };
    const updated = this.db.updateTask(taskId, {
      assignedTo: targetUserId
    }, updater);

    // Log Activity
    this.db.logActivity({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: '⚖️',
      action: 'ai_workload_rebalance',
      category: 'executive_desk',
      taskId: task.id,
      taskTitle: task.title,
      details: `[Bàn Làm Việc AI] Đã cân bằng tải công việc #${task.id}: Chuyển giao từ ${oldAssignee ? oldAssignee.name : 'N/A'} sang ${targetUser.name}`
    });

    // Notify new assignee
    this.db.addNotification({
      userId: targetUserId,
      taskId: task.id,
      title: '🎯 Tiếp nhận công việc điều phối từ Bàn Làm Việc',
      message: `Bạn vừa được điều chuyển tiếp nhận công việc #${task.id}: "${task.title}" từ ${oldAssignee ? oldAssignee.name : 'đồng nghiệp'}.`,
      type: 'task_assigned',
      priority: task.priority || 'medium'
    });

    return { success: true, task: updated };
  }
}

module.exports = ExecutiveDeskEngine;
