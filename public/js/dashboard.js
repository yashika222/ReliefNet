/* ======================================================
   ✅ Helper: Fetch JSON with Safe Error Handling
=========================================================*/
async function api(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${url}`);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err);
    return null; // prevents breaking UI
  }
}

/* ======================================================
   ✅ Page Loader
=========================================================*/
function setLoader(show) {
  const loader = document.getElementById("dashboardLoader");
  if (loader) loader.classList.toggle("active", show);
}

/* ======================================================
   ✅ Update Stat Helper
=========================================================*/
function setStat(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

/* ======================================================
   ✅ Empty State Toggle
=========================================================*/
function setEmptyState(name, hasData) {
  const el = document.querySelector(`[data-empty="${name}"]`);
  if (el) el.classList.toggle("active", !hasData);
}

/* ======================================================
   ✅ Fill Tables
=========================================================*/
function renderTable(target, rowsHTML) {
  const tbody = document.querySelector(`[data-table="${target}"]`);
  const empty = document.querySelector(`[data-empty="${target}"]`);

  if (!tbody) return;

  if (!rowsHTML || rowsHTML.trim() === "") {
    tbody.innerHTML = "";
    if (empty) empty.classList.add("active");
  } else {
    tbody.innerHTML = rowsHTML;
    if (empty) empty.classList.remove("active");
  }
}

/* ======================================================
   ✅ DRAW CHART (auto-destroy previous)
=========================================================*/
const chartRefs = {};

function drawChart(id, type, labels, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  // Destroy old chart if exists
  if (chartRefs[id]) {
    chartRefs[id].destroy();
  }

  chartRefs[id] = new Chart(canvas, {
    type: type,
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          borderWidth: 2,
          borderColor: "#2563eb",
          backgroundColor: [
            "#2563EB",
            "#4ADE80",
            "#F97316",
            "#F43F5E",
            "#A855F7",
            "#0EA5E9",
            "#14B8A6",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

/* ======================================================
   ✅ MAIN DASHBOARD LOADER
=========================================================*/
async function loadDashboard() {
  setLoader(true);

  /* ----------------------- ✅ Timestamp ----------------------- */
  const ts = document.getElementById("dashboardTimestamp");
  if (ts) ts.textContent = new Date().toLocaleString();

  /* ----------------------- ✅ Donation Summary ----------------------- */
  const today = await api("/admin/dashboard/summary/donations");
  const week = await api("/admin/dashboard/summary/donations-week");
  const month = await api("/admin/dashboard/summary/donations-month");
  const total = await api("/admin/dashboard/summary/donations-total");

  if (today) {
    setStat("[data-stat='donations-today-amount']", today.amount);
    setStat("[data-stat='donations-today-count']", today.count);
  }
  if (week) {
    setStat("[data-stat='donations-week-amount']", week.amount);
    setStat("[data-stat='donations-week-count']", week.count);
  }
  if (month) {
    setStat("[data-stat='donations-month-amount']", month.amount);
    setStat("[data-stat='donations-month-count']", month.count);
  }
  if (total) {
    setStat("[data-stat='donations-total-amount']", total.amount);
    setStat("[data-stat='donations-total-count']", total.count);
  }

  /* ----------------------- ✅ Volunteer Summary ----------------------- */
  const volunteers = await api("/admin/dashboard/summary/volunteers");
  if (volunteers) {
    setStat("[data-stat='volunteers-total']", volunteers.totalVolunteers);
    setStat("[data-stat='volunteers-active']", volunteers.activeVolunteers);
    setStat("[data-stat='volunteers-tasks']", volunteers.tasksCompleted + " tasks");
  }

  /* ----------------------- ✅ Disaster Summary ----------------------- */
  const disasters = await api("/admin/dashboard/summary/disasters");
  if (disasters) {
    setStat("[data-stat='disasters-active']", disasters.activeDisasters);
    setStat("[data-stat='disasters-closed']", disasters.closedDisasters);
  }

  /* ----------------------- ✅ Donation Trend Chart ----------------------- */
  const trend = await api("/admin/dashboard/chart/trend");
  if (trend && trend.daily) {
    setEmptyState("donationTrendChart", trend.daily.labels.length > 0);

    drawChart(
      "donationTrendChart",
      "line",
      trend.daily.labels,
      trend.daily.values
    );

    drawChart(
      "donationCumulativeChart",
      "bar",
      trend.monthlyCumulative.labels,
      trend.monthlyCumulative.values
    );
  }

  /* ----------------------- ✅ Disaster-wise Donations ----------------------- */
  const byDisaster = await api("/admin/dashboard/chart/disaster");
  if (byDisaster) {
    setEmptyState("disasterDonationsChart", byDisaster.labels.length > 0);
    drawChart(
      "disasterDonationsChart",
      "pie",
      byDisaster.labels,
      byDisaster.values
    );
  }

  /* ----------------------- ✅ Donations by State ----------------------- */
  const byState = await api("/admin/dashboard/chart/states");
  if (byState) {
    setEmptyState("donorStatesChart", byState.labels.length > 0);
    drawChart("donorStatesChart", "doughnut", byState.labels, byState.values);
  }

  /* ----------------------- ✅ Volunteer Ranking ----------------------- */
  const ranking = await api("/admin/dashboard/chart/volunteers");
  if (ranking) {
    setEmptyState("volunteerRankingChart", ranking.labels.length > 0);
    drawChart(
      "volunteerRankingChart",
      "bar",
      ranking.labels,
      ranking.values
    );
  }

  /* ----------------------- ✅ Disaster Severity ----------------------- */
  const severity = await api("/admin/dashboard/chart/severity");
  if (severity) {
    setEmptyState("severityChart", severity.labels.length > 0);
    drawChart("severityChart", "pie", severity.labels, severity.values);
  }

  /* ----------------------- ✅ Recent Donations Table ----------------------- */
  const recentDonations = await api("/admin/dashboard/table/donations");

  if (recentDonations) {
    const rows = recentDonations
      .map(
        (d) => `
        <tr>
          <td>${d.donorName}</td>
          <td>${d.amount}</td>
          <td>${d.disaster}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
        </tr>
      `
      )
      .join("");

    renderTable("recent-donations", rows);
  }

  /* ----------------------- ✅ Recent Disasters Table ----------------------- */
  const recentDisasters = await api("/admin/dashboard/table/disasters");

  if (recentDisasters) {
    const rows = recentDisasters
      .map(
        (d) => `
        <tr>
          <td>${d.title}</td>
          <td>${d.severity}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
        </tr>
      `
      )
      .join("");

    renderTable("disasters", rows);
  }

  setLoader(false);
}

/* ======================================================
   ✅ Start Loading After Page is Ready
=========================================================*/
document.addEventListener("DOMContentLoaded", loadDashboard);
