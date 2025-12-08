/* ===============================
   ✅ Helper: Fetch JSON
================================*/
async function loadJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", url, err);
    return null;
  }
}

/* ===============================
   ✅ Dashboard Loader
================================*/
function toggleLoader(show) {
  const loader = document.getElementById("dashboardLoader");
  if (!loader) return;
  loader.classList.toggle("active", show);
}

/* ===============================
   ✅ Update Stat Cards
================================*/
function updateStat(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

/* ===============================
   ✅ Empty State Toggle
================================*/
function toggleEmptyState(name, hasData) {
  const emptyEl = document.querySelector(`[data-empty="${name}"]`);
  if (!emptyEl) return;
  emptyEl.classList.toggle("active", !hasData);
}

/* ===============================
   ✅ Table Rendering Helper
================================*/
function fillTable(name, rowsHTML) {
  const tbody = document.querySelector(`[data-table="${name}"]`);
  const emptyEl = document.querySelector(`[data-empty="${name}"]`);

  if (!tbody) return;

  if (!rowsHTML || rowsHTML.trim() === "") {
    tbody.innerHTML = "";
    if (emptyEl) emptyEl.classList.add("active");
  } else {
    tbody.innerHTML = rowsHTML;
    if (emptyEl) emptyEl.classList.remove("active");
  }
}

/* ===============================
   ✅ Load Dashboard Data
================================*/
async function loadDashboard() {
  toggleLoader(true);

  // Timestamp
  const ts = document.getElementById("dashboardTimestamp");
  if (ts) ts.textContent = new Date().toLocaleString();

  /* ------------------------------
      ✅ 1. Donation Summary Cards
  ------------------------------*/
  const today = await loadJSON("/admin/api/donations/today");
  const week = await loadJSON("/admin/api/donations/week");
  const month = await loadJSON("/admin/api/donations/month");
  const total = await loadJSON("/admin/api/donations/total");

  if (today) {
    updateStat("[data-stat='donations-today-amount']", today.amount);
    updateStat("[data-stat='donations-today-count']", today.count);
  }
  if (week) {
    updateStat("[data-stat='donations-week-amount']", week.amount);
    updateStat("[data-stat='donations-week-count']", week.count);
  }
  if (month) {
    updateStat("[data-stat='donations-month-amount']", month.amount);
    updateStat("[data-stat='donations-month-count']", month.count);
  }
  if (total) {
    updateStat("[data-stat='donations-total-amount']", total.amount);
    updateStat("[data-stat='donations-total-count']", total.count);
  }

  /* ------------------------------
      ✅ 2. Volunteer Summary Cards
  ------------------------------*/
  const volunteers = await loadJSON("/admin/api/volunteers/summary");

  if (volunteers) {
    updateStat("[data-stat='volunteers-total']", volunteers.totalVolunteers);
    updateStat("[data-stat='volunteers-active']", volunteers.activeVolunteers);
    updateStat("[data-stat='volunteers-tasks']", volunteers.tasksCompleted + " tasks");
  }

  /* ------------------------------
      ✅ 3. Disaster Summary Cards
  ------------------------------*/
  const disasters = await loadJSON("/admin/api/disasters/summary");

  if (disasters) {
    updateStat("[data-stat='disasters-active']", disasters.activeDisasters);
    updateStat("[data-stat='disasters-closed']", disasters.closedDisasters);
  }

  /* ------------------------------
      ✅ 4. Donation Trend Chart
  ------------------------------*/
  const trend = await loadJSON("/admin/api/donations/trend");

  if (trend && trend.daily) {
    toggleEmptyState("donationTrendChart", trend.daily.labels.length > 0);

    if (window.Chart) new Chart(document.getElementById("donationTrendChart"), {
      type: "line",
      data: {
        labels: trend.daily.labels,
        datasets: [{
          label: "Donations",
          data: trend.daily.values,
          borderWidth: 2,
          borderColor: "#2563eb",
          fill: false,
          tension: 0.3
        }]
      }
    });

    // Monthly cumulative chart
    if (window.Chart) new Chart(document.getElementById("donationCumulativeChart"), {
      type: "bar",
      data: {
        labels: trend.monthlyCumulative.labels,
        datasets: [{
          label: "Cumulative Donations",
          data: trend.monthlyCumulative.values,
          borderWidth: 2
        }]
      }
    });
  }

  /* ------------------------------
      ✅ 5. Disaster-wise Donations
  ------------------------------*/
  const byDisaster = await loadJSON("/admin/api/donations/by-disaster");

  if (byDisaster) {
    toggleEmptyState("disasterDonationsChart", byDisaster.labels?.length > 0);

    if (window.Chart) new Chart(document.getElementById("disasterDonationsChart"), {
      type: "pie",
      data: {
        labels: byDisaster.labels,
        datasets: [{
          data: byDisaster.values
        }]
      }
    });
  }

  /* ------------------------------
      ✅ 6. Donor States Chart
  ------------------------------*/
  const byState = await loadJSON("/admin/api/donations/by-state");

  if (byState) {
    toggleEmptyState("donorStatesChart", byState.labels?.length > 0);

    if (window.Chart) new Chart(document.getElementById("donorStatesChart"), {
      type: "doughnut",
      data: {
        labels: byState.labels,
        datasets: [{
          data: byState.values
        }]
      }
    });
  }

  /* ------------------------------
      ✅ 7. Volunteer Ranking Chart
  ------------------------------*/
  const ranking = await loadJSON("/admin/api/volunteers/ranking");

  if (ranking) {
    toggleEmptyState("volunteerRankingChart", ranking.labels?.length > 0);

    if (window.Chart) new Chart(document.getElementById("volunteerRankingChart"), {
      type: "bar",
      data: {
        labels: ranking.labels,
        datasets: [{
          label: "Completed Tasks",
          data: ranking.values,
          borderWidth: 2
        }]
      }
    });
  }

  /* ------------------------------
      ✅ 8. Disaster Severity Chart
  ------------------------------*/
  const severity = await loadJSON("/admin/api/disasters/severity-distribution");

  if (severity) {
    toggleEmptyState("severityChart", severity.labels?.length > 0);

    if (window.Chart) new Chart(document.getElementById("severityChart"), {
      type: "pie",
      data: {
        labels: severity.labels,
        datasets: [{
          data: severity.values
        }]
      }
    });
  }

  /* ------------------------------
      ✅ 9. Recent Donations Table
  ------------------------------*/
  const recentDonations = await loadJSON("/admin/api/donations/recent");

  if (recentDonations && recentDonations.length > 0) {
    const rows = recentDonations
      .map((d) => `
        <tr>
          <td>${d.donorName}</td>
          <td>${d.amount}</td>
          <td>${d.disaster}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
        </tr>
      `)
      .join("");

    fillTable("recent-donations", rows);
  } else {
    fillTable("recent-donations", "");
  }

  /* ------------------------------
      ✅ 10. Recent Disasters Table
  ------------------------------*/
  const recentDisasters = await loadJSON("/admin/api/disasters/recent");

  if (recentDisasters && recentDisasters.length > 0) {
    const rows = recentDisasters
      .map((d) => `
        <tr>
          <td>${d.title}</td>
          <td>${d.severity}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
        </tr>
      `)
      .join("");

    fillTable("disasters", rows);
  } else {
    fillTable("disasters", "");
  }

  toggleLoader(false);
}

/* ===============================
   ✅ Start Loading Dashboard
================================*/
document.addEventListener("DOMContentLoaded", loadDashboard);
