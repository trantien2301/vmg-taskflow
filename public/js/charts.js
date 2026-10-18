// TaskFlow Charts Manager
const TaskCharts = {
  instances: {},

  destroyAll() {
    Object.keys(this.instances).forEach(key => {
      if (this.instances[key]) {
        this.instances[key].destroy();
        delete this.instances[key];
      }
    });
  },

  renderReports(reportData) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded, skipping chart rendering');
      return;
    }

    this.destroyAll();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Task Status Distribution (Doughnut)
    const ctxStatus = document.getElementById('chartStatus');
    if (ctxStatus) {
      const kpis = reportData.kpis;
      this.instances.status = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Cần làm', 'Đang làm', 'Chờ duyệt', 'Hoàn thành', 'Quá hạn'],
          datasets: [{
            data: [
              kpis.todo,
              kpis.inProgress,
              kpis.review,
              kpis.completed,
              kpis.overdue
            ],
            backgroundColor: [
              '#94a3b8', // Todo - Gray
              '#3b82f6', // In Progress - Blue
              '#f59e0b', // Review - Orange
              '#10b981', // Completed - Green
              '#ef4444'  // Overdue - Red
            ],
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, font: { size: 12 } }
            }
          },
          cutout: '70%'
        }
      });
    }

    // 2. Department Breakdown (Bar Chart)
    const ctxDept = document.getElementById('chartDept');
    if (ctxDept && reportData.departmentMap) {
      const labels = Object.keys(reportData.departmentMap);
      const totalData = labels.map(l => reportData.departmentMap[l].total);
      const completedData = labels.map(l => reportData.departmentMap[l].completed);
      const overdueData = labels.map(l => reportData.departmentMap[l].overdue);

      this.instances.dept = new Chart(ctxDept, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Tổng công việc',
              data: totalData,
              backgroundColor: '#6366f1',
              borderRadius: 6
            },
            {
              label: 'Đã hoàn thành',
              data: completedData,
              backgroundColor: '#10b981',
              borderRadius: 6
            },
            {
              label: 'Bị quá hạn',
              data: overdueData,
              backgroundColor: '#ef4444',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1 }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor }
            }
          }
        }
      });
    }

    // 3. Weekly Trend (Line Chart)
    const ctxTrend = document.getElementById('chartTrend');
    if (ctxTrend && reportData.trend) {
      const labels = reportData.trend.map(t => t.date);
      const completedData = reportData.trend.map(t => t.completed);
      const createdData = reportData.trend.map(t => t.created);

      this.instances.trend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Hoàn tất trong ngày',
              data: completedData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.35,
              borderWidth: 3
            },
            {
              label: 'Giao mới trong ngày',
              data: createdData,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              fill: true,
              tension: 0.35,
              borderWidth: 2,
              borderDash: [5, 5]
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1 }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor }
            }
          }
        }
      });
    }

    // 4. Member Performance (Horizontal Bar)
    const ctxMember = document.getElementById('chartMember');
    if (ctxMember && reportData.memberPerformance) {
      const members = reportData.memberPerformance.filter(m => m.total > 0);
      const labels = members.map(m => m.name);
      const completed = members.map(m => m.completed);
      const inProgress = members.map(m => m.inProgress);
      const overdue = members.map(m => m.overdue);

      this.instances.member = new Chart(ctxMember, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Hoàn thành',
              data: completed,
              backgroundColor: '#10b981'
            },
            {
              label: 'Đang làm',
              data: inProgress,
              backgroundColor: '#3b82f6'
            },
            {
              label: 'Trễ hạn',
              data: overdue,
              backgroundColor: '#ef4444'
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1 }
            },
            y: {
              stacked: true,
              grid: { display: false },
              ticks: { color: textColor }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor }
            }
          }
        }
      });
    }
  }
};
