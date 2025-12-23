document.addEventListener("DOMContentLoaded", function () {
  const donateForm = document.getElementById("donateForm");
  const donationTrackId = document.getElementById("donationTrackId");
  const donationTrackBtn = document.getElementById("donationTrackBtn");
  const donationTrackError = document.getElementById("donationTrackError");
  const donationTracker = document.getElementById("donationTracker");
  const pastDonationsEl = document.getElementById("pastDonations");

  // ✅ Submit Donation Form with Razorpay
  if (donateForm) {
    donateForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = donateForm.querySelector("button[type='submit']");
      const statusBox = document.getElementById("status");

      submitBtn.disabled = true;
      submitBtn.innerHTML = "⏳ Processing...";
      statusBox.innerHTML = "";

      try {
        const formData = new FormData(donateForm);

        // 1. Prepare Payload
        const payload = {
          donorName: formData.get("donorName"),
          email: formData.get("email"),
          amount: Number(formData.get("amount")),
          state: formData.get("state"),
          disasterId: new URLSearchParams(window.location.search).get("disasterId") || null,
        };

        // 2. Create Donation Record (Pending)
        const res = await fetch("/api/donations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create donation");

        const donationId = data.donationId;
        const amount = payload.amount;

        // 3. Create Razorpay Order
        const orderRes = await fetch("/api/payment/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amount, donationId: donationId }),
        });

        const orderData = await orderRes.json();
        if (!orderData.success) {
          throw new Error(orderData.error || "Failed to initiate payment");
        }

        // 4. Open Razorpay Checkout
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: "INR",
          name: "Disaster Relief",
          description: "Donation for Ref: " + donationId,
          order_id: orderData.order_id,
          handler: async function (response) {
            // 5. Verify Payment on Server
            try {
              statusBox.innerHTML = "<div class='alert alert-info'>Verifying payment...</div>";

              const verifyRes = await fetch("/api/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  donationId: donationId
                })
              });

              const verifyData = await verifyRes.json();

              if (verifyData.success) {
                statusBox.innerHTML = `
                  <div class="alert alert-success">
                    ✅ <strong>Payment Successful!</strong><br>
                    Thank you for your donation. Receipt sent to your email.<br>
                    Donation ID: <strong>${donationId}</strong>
                  </div>
                `;
                saveToHistory(donationId);
                if (donationTrackId) {
                  donationTrackId.value = donationId;
                  updateDonationTracker(donationId);
                }
                donateForm.reset();
              } else {
                throw new Error("Payment verification failed. Please contact support.");
              }
            } catch (err) {
              statusBox.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
            }
          },
          prefill: {
            name: payload.donorName,
            email: payload.email
          },
          theme: {
            color: "#2563eb"
          },
          modal: {
            ondismiss: function () {
              statusBox.innerHTML = `<div class="alert alert-error">Transaction cancelled by user.</div>`;
              submitBtn.disabled = false;
              submitBtn.innerHTML = "💝 Submit Donation";
            }
          }
        };

        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response) {
          statusBox.innerHTML = `<div class="alert alert-error">❌ Payment Failed: ${response.error.description}</div>`;
          submitBtn.disabled = false;
          submitBtn.innerHTML = "💝 Submit Donation";
        });

        rzp1.open();

      } catch (err) {
        statusBox.innerHTML = `
          <div class="alert alert-error">
            ❌ ${err.message}
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.innerHTML = "💝 Submit Donation";
      }
    });
  }

  function saveToHistory(donationId) {
    const history = JSON.parse(localStorage.getItem("myDonationIds") || "[]");
    if (!history.includes(donationId)) {
      history.unshift(donationId);
      localStorage.setItem("myDonationIds", JSON.stringify(history));
    }
  }

  // Same tracking logic as before...
  async function fetchDonationById(id) {
    const res = await fetch(`/api/donations/${id}`);
    if (!res.ok) {
      let message = "Donation not found";
      try {
        const errData = await res.json();
        message = errData.error || errData.message || message;
      } catch (_) { }
      throw new Error(message);
    }
    return res.json();
  }

  async function updateDonationTracker(id) {
    const data = await fetchDonationById(id);
    const status = data.paymentStatus || "pending";
    highlightDonationStep(status);
  }

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

  if (pastDonationsEl) {
    loadPastDonations();
  }

  async function loadPastDonations() {
    try {
      const ids = JSON.parse(localStorage.getItem("myDonationIds") || "[]");
      if (!ids.length) {
        pastDonationsEl.innerHTML = "<p class='text-gray-600 text-center'>No past donations found.</p>";
        return;
      }
      const results = [];
      for (const id of ids) {
        try {
          const d = await fetchDonationById(id);
          results.push(d);
        } catch (_) { }
      }
      renderPastDonations(results);
    } catch (err) {
      pastDonationsEl.innerHTML = `<p class="text-center text-red-500">${err.message}</p>`;
    }
  }

  function renderPastDonations(list) {
    if (!list.length) {
      pastDonationsEl.innerHTML = "<p class='text-gray-600 text-center'>No donations found.</p>";
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

