document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;

      btn.disabled = true;
      btn.innerText = "Approving...";

      const res = await fetch(`/admin/api/manage-users/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ User approved");
        location.reload();
      } else {
        alert("❌ Failed");
        btn.disabled = false;
        btn.innerText = "Approve";
      }
    });
  });
});
