document.addEventListener("DOMContentLoaded", function () {
  const donateForm = document.getElementById("donateForm");
  const donationTrackId = document.getElementById("donationTrackId");
  const donationTrackBtn = document.getElementById("donationTrackBtn");
  const donationTrackError = document.getElementById("donationTrackError");
  const donationTracker = document.getElementById("donationTracker");
  const pastDonationsEl = document.getElementById("pastDonations");

  // ✅ Submit Donation Form
  if (donateForm) {
    donateForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = donateForm.querySelector("button[type='submit']");
      const statusBox = document.getElementById("status");

      submitBtn.disabled = true;
      submitBtn.innerHTML = "⏳ Processing...";

      try {
        const formData = new FormData(donateForm);

        // ✅ Correct payload for donation schema
        const payload = {
          donorName: formData.get("donorName"),
          email: formData.get("email"),
          amount: Number(formData.get("amount")),
          state: formData.get("state"),
          disasterId: new URLSearchParams(window.location.search).get("disasterId") || null,
        };

        // ✅ Create Donation
        const res = await fetch("/api/donations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create donation");

        const donationId = data.donationId;

        // ✅ Mark payment as success (important for dashboard)
        await fetch(`/api/donations/${donationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentStatus: "success" }),
        });

        statusBox.innerHTML = `
          <div class="alert alert-success">
            ✅ Donation Successful!  
            <br>Donation ID: <strong>${donationId}</strong>
          </div>
        `;

        // ✅ Save ID in local storage (past donations)
        const history = JSON.parse(localStorage.getItem("myDonationIds") || "[]");
        if (!history.includes(donationId)) {
          history.unshift(donationId);
          localStorage.setItem("myDonationIds", JSON.stringify(history));
        }

        donationTrackId.value = donationId;
        await updateDonationTracker(donationId);

        donateForm.reset();
      } catch (err) {
        statusBox.innerHTML = `
          <div class="alert alert-error">
            ❌ ${err.message}
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "💝 Submit Donation";
      }
    });
  }

  // ✅ Fetch Donation by ID
  async function fetchDonationById(id) {
    const res = await fetch(`/api/donations/${id}`);
    if (!res.ok) {
      let message = "Donation not found";
      try {
        const errData = await res.json();
        message = errData.error || errData.message || message;
      } catch (_) {}
      throw new Error(message);
    }
    return res.json();
  }

  // ✅ Update donation tracker UI
  async function updateDonationTracker(id) {
    const data = await fetchDonationById(id);
    const status = data.paymentStatus || "pending";

    highlightDonationStep(status);
  }

  // ✅ Highlight active step
  function highlightDonationStep(status) {
    if (!donationTracker) return;

    const steps = donationTracker.querySelectorAll("[data-step]");
    steps.forEach((s) => {
      s.classList.remove("active");
      s.style.opacity = "0.4";
    });

    const activeStep = donationTracker.querySelector(`[data-step="${status}"]`);
    if (activeStep) {
      activeStep.classList.add("active");
      activeStep.style.opacity = "1";
    }
  }

  // ✅ "Track Donation" button
  if (donationTrackBtn && donationTrackId) {
    donationTrackBtn.addEventListener("click", async () => {
      donationTrackError.textContent = "";

      const id = donationTrackId.value.trim();
      if (!id) {
        donationTrackError.textContent = "Please enter a donation ID.";
        return;
      }

      try {
        await updateDonationTracker(id);
      } catch (err) {
        donationTrackError.textContent = err.message;
      }
    });
  }

  // ✅ Load Past Donations
  if (pastDonationsEl) {
    loadPastDonations();
  }

  async function loadPastDonations() {
    try {
      const ids = JSON.parse(localStorage.getItem("myDonationIds") || "[]");

      if (!ids.length) {
        pastDonationsEl.innerHTML =
          "<p class='text-gray-600 text-center'>No past donations found.</p>";
        return;
      }

      const results = [];
      for (const id of ids) {
        try {
          const d = await fetchDonationById(id);
          results.push(d);
        } catch (_) {}
      }

      renderPastDonations(results);
    } catch (err) {
      pastDonationsEl.innerHTML = `
        <p class="text-center text-red-500">${err.message}</p>
      `;
    }
  }

  // ✅ Render Past Donations
  function renderPastDonations(list) {
    if (!list.length) {
      pastDonationsEl.innerHTML =
        "<p class='text-gray-600 text-center'>No donations found.</p>";
      return;
    }

    pastDonationsEl.innerHTML = list
      .map(
        (d) => `
        <div class="bg-white rounded-lg shadow p-4 mb-3">
          <h3 class="font-semibold">${d.donorName || "Anonymous"}</h3>
          <p>Amount: ₹${d.amount}</p>
          <p>Status: ${d.paymentStatus}</p>
          <code>${d._id}</code>
          <br>
          <button data-track="${d._id}" class="bg-blue-600 text-white mt-2 px-4 py-1 rounded">
            Track
          </button>
        </div>
      `
      )
      .join("");

    document.querySelectorAll("[data-track]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-track");
        donationTrackId.value = id;
        updateDonationTracker(id);
      });
    });
  }
});
